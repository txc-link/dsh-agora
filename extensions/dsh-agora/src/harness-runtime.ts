import { randomUUID } from 'node:crypto'
import type { RuntimeDispatch, RuntimeNodeAgent } from './contracts.js'
import {
  DSH_AGORA_RUNTIME_PROTOCOL,
  type DshAgoraRuntimeAdapterV1,
  type RuntimeExecutionResult,
} from './extension-sdk.js'

export interface ConfiguredDshAgent {
  readonly id: string
  readonly displayName?: string
  readonly preset?: string
  readonly model?: string
  readonly workspace?: string
  readonly workspaceAlias?: string
  readonly roles?: readonly string[]
  readonly capabilities?: readonly string[]
}

export interface HarnessRuntimeOptions {
  readonly baseUrl: string
  readonly agents: readonly ConfiguredDshAgent[]
  readonly replyTimeoutMs?: number
  readonly fetch?: typeof globalThis.fetch
}

export class HarnessRuntimeAdapter implements DshAgoraRuntimeAdapterV1 {
  readonly protocol = DSH_AGORA_RUNTIME_PROTOCOL
  private readonly client: HarnessRpcClient
  private readonly agents: readonly NormalizedAgent[]
  private readonly replyTimeoutMs: number

  constructor(options: HarnessRuntimeOptions) {
    this.client = new HarnessRpcClient(options.baseUrl, options.fetch)
    this.agents = normalizeAgents(options.agents)
    this.replyTimeoutMs = normalizeReplyTimeout(options.replyTimeoutMs)
  }

  describeAgents(): readonly RuntimeNodeAgent[] {
    return this.agents.map(agent => ({
      agent_ref: agent.id,
      display_name: agent.displayName,
      preset: agent.preset,
      model: agent.model,
      workspace_alias: agent.workspaceAlias,
      roles: agent.roles,
      capabilities: agent.capabilities,
    }))
  }

  async execute(dispatch: RuntimeDispatch, signal: AbortSignal): Promise<RuntimeExecutionResult> {
    const agentRef = dispatch.runtime_target_ref.split(':').at(-1)
    const agent = this.agents.find(item => item.id === agentRef)
    if (!agent) throw new Error(`runtime target ${dispatch.runtime_target_ref} is not configured on this DSH node`)
    const sessionId = dispatch.session_id ?? await this.client.createSession({
      workspace: agent.workspace,
      agentPreset: dispatch.agent_preset ?? agent.preset,
      signal,
    })
    const result = await this.client.runPrompt(
      sessionId,
      formatDispatchPrompt(dispatch),
      this.replyTimeoutMs,
      signal,
      `agora-dispatch-${dispatch.id}`,
    )
    return {
      sessionId,
      answer: result.answer,
      reason: result.reason,
      metadata: { agent_ref: agent.id, runtime_target_ref: dispatch.runtime_target_ref },
    }
  }

  async cancel(sessionId: string, signal: AbortSignal): Promise<boolean> {
    await this.client.rpc('session.cancel', { sessionId, keepInbox: true }, 30_000, signal)
    return true
  }
}

interface NormalizedAgent {
  readonly id: string
  readonly displayName: string | null
  readonly preset: string | null
  readonly model: string | null
  readonly workspace: string
  readonly workspaceAlias: string | null
  readonly roles: readonly string[]
  readonly capabilities: readonly string[]
}

class HarnessRpcClient {
  private readonly origin: URL
  private readonly fetchImpl: typeof globalThis.fetch

  constructor(baseUrl: string, fetchImpl = globalThis.fetch) {
    this.origin = new URL(baseUrl)
    this.fetchImpl = fetchImpl
  }

  async rpc<T>(method: string, payload: Record<string, unknown>, timeoutMs: number, signal?: AbortSignal, rpcId?: string): Promise<T> {
    const requestId = rpcId ?? `agora-${randomUUID()}`
    const timeout = AbortSignal.timeout(timeoutMs)
    const combined = signal === undefined ? timeout : AbortSignal.any([signal, timeout])
    const response = await this.fetchImpl(new URL(`/api/${method}`, this.origin), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ type: 'client-request', rpcId: requestId, method, payload }),
      signal: combined,
    })
    if (!response.ok) throw new Error(`DSH ${method} returned HTTP ${response.status}`)
    const body = await response.json() as {
      type?: string
      rpcId?: string
      result?: { ok?: boolean; value?: T; error?: { message?: string; code?: string } }
    }
    if (body.type !== 'server-response' || body.rpcId !== requestId || typeof body.result?.ok !== 'boolean') {
      throw new Error(`DSH ${method} returned an invalid RPC envelope`)
    }
    if (!body.result.ok) {
      const error = new Error(body.result.error?.message ?? `DSH ${method} failed`)
      error.name = body.result.error?.code ?? 'HarnessRpcError'
      throw error
    }
    return body.result.value as T
  }

  async createSession(options: { workspace: string; agentPreset: string | null; signal: AbortSignal }): Promise<string> {
    const workspaces = await this.rpc<{ items?: Array<{ workspaceId?: string; path?: string }> }>(
      'workspace.list', {}, 30_000, options.signal,
    )
    let workspaceId = workspaces.items?.find(item => item.path === options.workspace)?.workspaceId
    if (!workspaceId) {
      const created = await this.rpc<{ workspace?: { workspaceId?: string } }>(
        'workspace.create', { path: options.workspace }, 30_000, options.signal,
      )
      workspaceId = created.workspace?.workspaceId
    }
    if (!workspaceId) throw new Error(`DSH could not resolve workspace ${options.workspace}`)
    const created = await this.rpc<{ sessionId?: string }>(
      'session.create',
      { workspaceId, ...(options.agentPreset ? { agentPreset: options.agentPreset } : {}) },
      30_000,
      options.signal,
    )
    if (!created.sessionId) throw new Error('DSH session.create returned no sessionId')
    return created.sessionId
  }

  async runPrompt(
    sessionId: string,
    prompt: string,
    timeoutMs: number,
    signal: AbortSignal,
    promptRpcId = `agora-dispatch-${randomUUID()}`,
  ): Promise<{ answer: string; reason: string | null }> {
    const timeout = AbortSignal.timeout(timeoutMs)
    const combined = AbortSignal.any([signal, timeout])
    const initial = await this.rpc<HistoryResponse>('session.history', { sessionId, maxMessages: 50 }, 30_000, combined)
    const tracker = new ReplyTracker(maxSeq(initial.events ?? []))
    tracker.promptRpcId = promptRpcId
    await this.rpc(
      'session.prompt',
      {
        sessionId,
        mode: 'queue',
        content: [{ type: 'text', text: prompt }],
        clientTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      30_000,
      combined,
      promptRpcId,
    )
    while (!tracker.finished) {
      await sleep(350, combined)
      const history = await this.rpc<HistoryResponse>('session.history', { sessionId, maxMessages: 50 }, 30_000, combined)
      tracker.consume(history.events ?? [])
    }
    return { answer: tracker.answer, reason: tracker.reason }
  }
}

interface HistoryResponse {
  readonly events?: readonly unknown[]
}

class ReplyTracker {
  promptRpcId = ''
  private lastSeq: number
  private openTurn: unknown = null
  private targetTurn: unknown = null
  private latestText = ''
  private readonly chunks = new Map<string, string>()
  finished = false
  reason: string | null = null

  constructor(afterSeq: number) {
    this.lastSeq = afterSeq
  }

  get answer(): string {
    return this.latestText.trim()
  }

  consume(entries: readonly unknown[]): void {
    const events = entries
      .map(entry => isRecord(entry) && isRecord(entry.event) ? entry.event : entry)
      .filter(isRecord)
      .sort((left, right) => numberValue(left.seq, -1) - numberValue(right.seq, -1))
    for (const event of events) {
      const seq = numberValue(event.seq, -1)
      if (seq <= this.lastSeq) continue
      this.lastSeq = seq
      const data = isRecord(event.data) ? event.data : {}
      if (event.type === 'turn/start') this.openTurn = data.turn ?? null
      if (event.type === 'user/message') {
        const source = isRecord(data.source) ? data.source : {}
        if (source.rpcId === this.promptRpcId) this.targetTurn = this.openTurn
        continue
      }
      if (this.targetTurn === null) continue
      if (event.type === 'turn/end' && data.turn === this.targetTurn) {
        this.finished = true
        this.reason = typeof data.reason === 'string' ? data.reason : null
        continue
      }
      if (data.turn !== this.targetTurn) continue
      if (event.type === 'assistant/message') {
        const message = isRecord(data.message) ? data.message : {}
        const content = Array.isArray(message.content) ? message.content : []
        const text = content.filter(isRecord)
          .filter(part => part.type === 'text' && typeof part.text === 'string')
          .map(part => String(part.text)).join('\n').trim()
        if (text) this.latestText = text
      }
      if (event.type === 'assistant/chunk') {
        const chunk = isRecord(data.chunk) ? data.chunk : {}
        if (chunk.type !== 'text-delta' || typeof chunk.text !== 'string') continue
        const key = `${numberValue(data.step, 0)}:${numberValue(chunk.index, 0)}`
        this.chunks.set(key, (this.chunks.get(key) ?? '') + chunk.text)
        const step = `${numberValue(data.step, 0)}:`
        const text = [...this.chunks.entries()]
          .filter(([part]) => part.startsWith(step))
          .sort(([left], [right]) => Number(left.split(':')[1]) - Number(right.split(':')[1]))
          .map(([, value]) => value).join('\n').trim()
        if (text) this.latestText = text
      }
    }
  }
}

function normalizeAgents(agents: readonly ConfiguredDshAgent[]): readonly NormalizedAgent[] {
  if (agents.length === 0) throw new TypeError('at least one DSH runtime agent must be configured')
  const seen = new Set<string>()
  return agents.map(agent => {
    const id = required(agent.id, 'runtime agent id')
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/u.test(id)) throw new TypeError(`invalid runtime agent id "${id}"`)
    if (seen.has(id)) throw new TypeError(`duplicate runtime agent id "${id}"`)
    seen.add(id)
    return Object.freeze({
      id,
      displayName: optional(agent.displayName),
      preset: optional(agent.preset),
      model: optional(agent.model),
      workspace: optional(agent.workspace) ?? process.cwd(),
      workspaceAlias: optional(agent.workspaceAlias),
      roles: unique(agent.roles ?? []),
      capabilities: unique(agent.capabilities ?? ['session.create', 'session.resume', 'session.prompt', 'session.cancel']),
    })
  })
}

function formatDispatchPrompt(dispatch: RuntimeDispatch): string {
  return [
    '[Agora cross-agent dispatch]',
    ...(dispatch.task_id ? [`Task: ${dispatch.task_id}`] : []),
    ...(dispatch.participant_binding_id ? [`Participant binding: ${dispatch.participant_binding_id}`] : []),
    `Dispatch: ${dispatch.id}`,
    '',
    dispatch.prompt,
    '',
    'Return a concise final result suitable for the requesting agent. Do not approve or reject human governance gates.',
  ].join('\n')
}

function maxSeq(entries: readonly unknown[]): number {
  return entries.reduce<number>((maximum, entry) => {
    const event = isRecord(entry) && isRecord(entry.event) ? entry.event : entry
    return isRecord(event) ? Math.max(maximum, numberValue(event.seq, -1)) : maximum
  }, -1)
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason)
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = (): void => {
      clearTimeout(timer)
      reject(signal.reason)
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

function normalizeReplyTimeout(value: number | undefined): number {
  const timeout = value ?? 600_000
  if (!Number.isSafeInteger(timeout) || timeout < 10_000 || timeout > 3_600_000) {
    throw new TypeError('runtimeReplyTimeoutMs must be an integer between 10000 and 3600000')
  }
  return timeout
}

function required(value: string, label: string): string {
  const normalized = optional(value)
  if (!normalized) throw new TypeError(`${label} is required`)
  return normalized
}

function optional(value: string | undefined): string | null {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))].sort()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}
