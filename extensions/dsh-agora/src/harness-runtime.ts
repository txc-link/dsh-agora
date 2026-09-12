import { randomUUID } from 'node:crypto'
import type {
  RuntimeDispatch,
  RuntimeNodeAgent,
  RuntimeResultClaim,
  RuntimeResultEnvelope,
  RuntimeResultEvidence,
} from './contracts.js'
import {
  DSH_AGORA_RUNTIME_PROTOCOL,
  type DshAgoraRuntimeAdapterV1,
  type RuntimeExecutionResult,
  type RuntimeExecutionContext,
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
  /**
   * Resolves the in-process dsh web launch URL. dsh web authenticates `/api`
   * with a cookie minted from a per-process launch token, so only a caller
   * inside that process can supply it.
   */
  readonly launchUrl?: (baseUrl: string) => string | undefined
  /** Test seam for the Remote stream socket; defaults to the global WebSocket. */
  readonly socketFactory?: WebSocketFactory
}

export class HarnessRuntimeAdapter implements DshAgoraRuntimeAdapterV1 {
  readonly protocol = DSH_AGORA_RUNTIME_PROTOCOL
  private readonly client: HarnessRpcClient
  private readonly agents: readonly NormalizedAgent[]
  private readonly replyTimeoutMs: number

  constructor(options: HarnessRuntimeOptions) {
    this.client = new HarnessRpcClient(options.baseUrl, options.fetch, options.launchUrl, options.socketFactory)
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

  async execute(
    dispatch: RuntimeDispatch,
    signal: AbortSignal,
    context?: RuntimeExecutionContext,
  ): Promise<RuntimeExecutionResult> {
    const startedAt = Date.now()
    const agentRef = dispatch.runtime_target_ref.split(':').at(-1)
    const agent = this.agents.find(item => item.id === agentRef)
    if (!agent) throw new Error(`runtime target ${dispatch.runtime_target_ref} is not configured on this DSH node`)
    const sessionId = dispatch.session_id ?? await this.client.createSession({
      workspace: agent.workspace,
      agentPreset: dispatch.agent_preset ?? agent.preset,
      signal,
    })
    try {
      await context?.reportProgress({
        phase: 'session_ready',
        message: dispatch.session_id ? 'Existing DSH Session resumed' : 'New DSH Session created',
        percent: 10,
        details: { session_id: sessionId },
      })
      const result = await this.client.runPrompt(
        sessionId,
        formatDispatchPrompt(dispatch),
        this.replyTimeoutMs,
        signal,
        `agora-dispatch-${dispatch.id}`,
        {
          onPromptAccepted: () => context?.reportProgress({
            phase: 'prompt_accepted',
            message: 'Prompt accepted by DeepSeek Harness',
            percent: 25,
          }),
          onResponseStarted: () => context?.reportProgress({
            phase: 'response_started',
            message: 'Agent started responding',
            percent: 60,
          }),
        },
      )
      await context?.reportProgress({
        phase: 'response_completed',
        message: 'Agent response completed',
        percent: 90,
      })
      const parsed = parseRuntimeResult(result.answer, agent, dispatch)
      return {
        sessionId,
        answer: parsed.answer,
        reason: result.reason,
        metadata: {
          agent_ref: agent.id,
          node_id: dispatch.node_id,
          runtime_target_ref: dispatch.runtime_target_ref,
          dispatch_id: dispatch.id,
        },
        resultEnvelope: {
          ...parsed.envelope,
          usage: {
            input_tokens: parsed.envelope.usage?.input_tokens ?? null,
            output_tokens: parsed.envelope.usage?.output_tokens ?? null,
            total_tokens: parsed.envelope.usage?.total_tokens ?? null,
            tool_calls: parsed.envelope.usage?.tool_calls ?? null,
            cost_usd: parsed.envelope.usage?.cost_usd ?? null,
            duration_ms: Date.now() - startedAt,
          },
        },
      }
    } catch (error) {
      if (signal.aborted) {
        try {
          await this.cancel(sessionId, AbortSignal.timeout(30_000))
        } catch {
          // Preserve the original lease-loss or shutdown error. The central
          // fencing token still prevents this abandoned execution from writing.
        }
      }
      throw error
    }
  }

  async cancel(sessionId: string, signal: AbortSignal): Promise<boolean> {
    await this.client.rpc('session/cancel', { request: { sessionId } }, 30_000, signal)
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

/** Structural view of the WebSocket API the Remote stream mux needs. */
interface DshSocketEvent {
  readonly data?: unknown
}

interface DshSocket {
  send(data: string): void
  close(code?: number, reason?: string): void
  addEventListener(type: string, listener: (event: DshSocketEvent) => void): void
}

type WebSocketFactory = (url: string, options: { headers: Record<string, string> }) => DshSocket

/**
 * Default socket factory over the runtime's global WebSocket. Node's undici
 * implementation accepts the extra `headers` option, which is the only way to
 * carry the browser-session cookie the API gateway's upgrade fence wants.
 */
function defaultWebSocketFactory(url: string, options: { headers: Record<string, string> }): DshSocket {
  const ctor = (globalThis as { WebSocket?: new (url: string, options?: { headers?: Record<string, string> }) => DshSocket }).WebSocket
  if (ctor === undefined) throw new Error('DSH Remote streams need a WebSocket implementation in this runtime')
  return new ctor(url, options)
}

/** FIFO of stream items with promise-based consumers and terminal states. */
class StreamQueue {
  private readonly items: unknown[] = []
  private readonly waiters: Array<{
    resolve: (result: IteratorResult<unknown>) => void
    reject: (error: Error) => void
  }> = []
  private terminal: IteratorResult<unknown> | undefined
  private failure: Error | undefined

  push(value: unknown): void {
    const waiter = this.waiters.shift()
    if (waiter !== undefined) {
      waiter.resolve({ done: false, value })
      return
    }
    if (this.terminal === undefined && this.failure === undefined) this.items.push(value)
  }

  end(): void {
    if (this.terminal !== undefined || this.failure !== undefined) return
    this.terminal = { done: true, value: undefined }
    for (const waiter of this.waiters.splice(0)) waiter.resolve(this.terminal)
  }

  fail(error: Error): void {
    if (this.terminal !== undefined || this.failure !== undefined) return
    this.failure = error
    for (const waiter of this.waiters.splice(0)) waiter.reject(error)
  }

  next(): Promise<IteratorResult<unknown>> {
    const item = this.items.shift()
    if (item !== undefined) return Promise.resolve({ done: false, value: item })
    if (this.failure !== undefined) return Promise.reject(this.failure)
    if (this.terminal !== undefined) return Promise.resolve(this.terminal)
    return new Promise((resolve, reject) => this.waiters.push({ resolve, reject }))
  }
}

/** One opened Remote stream: its opening snapshot plus the live frame reader. */
interface FollowStream<TSnapshot> {
  readonly snapshot: TSnapshot
  next(): Promise<IteratorResult<unknown>>
  close(): void
}

class HarnessRpcClient {
  private readonly origin: URL
  private readonly fetchImpl: typeof globalThis.fetch
  private readonly launchUrl: ((baseUrl: string) => string | undefined) | undefined
  private readonly socketFactory: WebSocketFactory
  private cookie: string | undefined

  constructor(
    baseUrl: string,
    fetchImpl = globalThis.fetch,
    launchUrl?: (baseUrl: string) => string | undefined,
    socketFactory: WebSocketFactory = defaultWebSocketFactory,
  ) {
    this.origin = new URL(baseUrl)
    this.fetchImpl = fetchImpl
    this.launchUrl = launchUrl
    this.socketFactory = socketFactory
  }

  /**
   * Resolve one browser-session cookie through the process launch-token
   * exchange. dsh web authenticates every /api request with a signed cookie
   * bound to the request authority; the launch token is minted per process and
   * held in memory only, so only an in-process caller can hand it over.
   */
  private async sessionCookie(): Promise<string> {
    if (this.cookie !== undefined) return this.cookie
    const launchUrl = this.launchUrl?.(this.origin.origin)
    if (launchUrl === undefined) {
      throw new Error('DSH web launch token is unavailable to this runtime adapter')
    }
    const response = await this.fetchImpl(launchUrl, { method: 'GET', redirect: 'manual' })
    const headers = response.headers as Headers & { getSetCookie?: () => string[] }
    const raw = headers.getSetCookie?.()[0] ?? response.headers.get('set-cookie') ?? undefined
    if (raw === undefined || raw === '') {
      throw new Error(`DSH web token exchange returned HTTP ${response.status} without a session cookie`)
    }
    const pair = raw.split(';')[0]?.trim() ?? ''
    if (pair === '') throw new Error('DSH web token exchange returned an empty session cookie')
    this.cookie = pair
    return pair
  }

  async rpc<T>(method: string, args: Record<string, unknown>, timeoutMs: number, signal?: AbortSignal, rpcId?: string): Promise<T> {
    const requestId = rpcId ?? `agora-${randomUUID()}`
    const timeout = AbortSignal.timeout(timeoutMs)
    const combined = signal === undefined ? timeout : AbortSignal.any([signal, timeout])
    for (let attempt = 0; ; attempt += 1) {
      const cookie = await this.sessionCookie()
      const response = await this.fetchImpl(new URL(`/api/${method}`, this.origin), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Cookie: cookie },
        body: JSON.stringify({ type: 'client-request', rpcId: requestId, method, payload: { args } }),
        signal: combined,
      })
      // The cookie outlives one process only while its signing secret is
      // unchanged; a 401 means the authority's session was rotated, so drop the
      // cached pair and exchange the launch token once more.
      if (response.status === 401 && attempt === 0) {
        this.cookie = undefined
        continue
      }
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
  }

  /**
   * Open one Remote stream on the gateway's multiplexed socket. The first item
   * is the endpoint's opening snapshot; later items are its live frames.
   */
  async openStream<TSnapshot>(
    endpoint: string,
    args: Record<string, unknown>,
    signal: AbortSignal,
  ): Promise<FollowStream<TSnapshot>> {
    const cookie = await this.sessionCookie()
    const url = new URL('/api/remote.mux', this.origin)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    const socket = this.socketFactory(url.href, { headers: { Cookie: cookie } })
    const queue = new StreamQueue()
    const streamId = `agora-${randomUUID()}`
    let closed = false
    socket.addEventListener('message', event => {
      const text = typeof event.data === 'string' ? event.data : String(event.data ?? '')
      let frame: { type?: string; streamId?: string; value?: unknown; error?: { message?: string } }
      try {
        frame = JSON.parse(text) as typeof frame
      } catch {
        return
      }
      if (frame.streamId !== streamId) return
      if (frame.type === 'item') {
        queue.push(frame.value)
        return
      }
      if (frame.type === 'error') {
        queue.fail(new Error(frame.error?.message ?? `DSH ${endpoint} stream failed`))
        return
      }
      if (frame.type === 'end') queue.end()
    })
    socket.addEventListener('close', () => queue.end())
    socket.addEventListener('error', () => queue.fail(new Error(`DSH ${endpoint} stream socket failed`)))
    const abort = new Promise<never>((_resolve, reject) => {
      if (signal.aborted) reject(signal.reason)
      else signal.addEventListener('abort', () => reject(signal.reason), { once: true })
    })
    await Promise.race([
      new Promise<void>((resolve, reject) => {
        socket.addEventListener('open', () => resolve())
        socket.addEventListener('error', () => reject(new Error(`DSH ${endpoint} stream socket refused`)))
      }),
      abort,
    ])
    socket.send(JSON.stringify({ type: 'open', streamId, endpoint, payload: { args } }))
    const opening = await Promise.race([queue.next(), abort])
    if (opening.done === true) throw new Error(`DSH ${endpoint} stream ended before its opening snapshot`)
    return {
      snapshot: opening.value as TSnapshot,
      next: () => Promise.race([queue.next(), abort]),
      close: () => {
        if (closed) return
        closed = true
        try {
          socket.send(JSON.stringify({ type: 'cancel', streamId }))
        } catch {
          // The socket is already gone; nothing left to cancel.
        }
        try {
          socket.close()
        } catch {
          // Closing an already-closed socket is not an error worth reporting.
        }
        queue.end()
      },
    }
  }

  async createSession(options: { workspace: string; agentPreset: string | null; signal: AbortSignal }): Promise<string> {
    // The current Remote surface has no workspace enumeration: `workspace/create`
    // resolves an existing directory idempotently, which is exactly the
    // addressable identity a Session needs.
    const workspace = await this.rpc<{ workspace?: { workspaceId?: string } }>(
      'workspace/create',
      { request: { path: options.workspace } },
      30_000,
      options.signal,
    )
    const workspaceId = workspace.workspace?.workspaceId
    if (workspaceId === undefined) throw new Error(`DSH could not resolve workspace ${options.workspace}`)
    const created = await this.rpc<{ sessionId?: string }>(
      'session/create',
      {
        request: {
          workspaceId,
          ...(options.agentPreset ? { agentPreset: options.agentPreset } : {}),
        },
      },
      30_000,
      options.signal,
    )
    if (created.sessionId === undefined) throw new Error('DSH session.create returned no sessionId')
    return created.sessionId
  }

  async runPrompt(
    sessionId: string,
    prompt: string,
    timeoutMs: number,
    signal: AbortSignal,
    promptRpcId = `agora-dispatch-${randomUUID()}`,
    callbacks: {
      readonly onPromptAccepted?: () => void | Promise<void>
      readonly onResponseStarted?: () => void | Promise<void>
    } = {},
  ): Promise<{ answer: string; reason: string | null }> {
    const timeout = AbortSignal.timeout(timeoutMs)
    const combined = AbortSignal.any([signal, timeout])
    // One live follow stream replaces the retired history poll: its opening
    // snapshot carries the durable cursor and its frames carry every later
    // turn event, so the reply is read without racing the transcript.
    const stream = await this.openStream<{ records?: readonly unknown[] }>(
      'session/follow',
      { request: { address: { kind: 'session', sessionId }, maxMessages: 50 } },
      combined,
    )
    try {
      const tracker = new ReplyTracker(maxSeq(stream.snapshot.records ?? []))
      tracker.promptRpcId = promptRpcId
      await this.rpc(
        'session/prompt',
        {
          request: {
            requestId: promptRpcId,
            sessionId,
            mode: 'queue',
            content: [{ type: 'text', text: prompt }],
            clientTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        },
        30_000,
        combined,
        promptRpcId,
      )
      await callbacks.onPromptAccepted?.()
      let responseStarted = false
      while (!tracker.finished) {
        const item = await stream.next()
        if (item.done === true) break
        tracker.consume([item.value])
        if (!responseStarted && tracker.answer !== '') {
          responseStarted = true
          await callbacks.onResponseStarted?.()
        }
      }
      return { answer: tracker.answer, reason: tracker.reason }
    } finally {
      stream.close()
    }
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
    '[Authoritative runtime context]',
    `Runtime node: ${dispatch.node_id}`,
    `Runtime target: ${dispatch.runtime_target_ref}`,
    `Dispatch: ${dispatch.id}`,
    'These values are supplied by the DSH worker. Do not infer or replace these values; use them when reporting your runtime identity.',
    '',
    ...(dispatch.task_id ? [`Task: ${dispatch.task_id}`] : []),
    ...(dispatch.participant_binding_id ? [`Participant binding: ${dispatch.participant_binding_id}`] : []),
    dispatch.prompt,
    '',
    'Return a concise final result suitable for the requesting agent. Do not approve or reject human governance gates.',
    'For verifiable claims, append one machine-readable block after the answer:',
    '<agora-evidence>{"claims":[{"id":"claim-1","statement":"...","evidence_ids":["evidence-1"],"confidence":0.9}],"evidence":[{"id":"evidence-1","kind":"file|url|commit|measurement|log|command|other","uri":"...","revision":"..."}],"confidence":0.9,"revision":"workspace commit if known"}</agora-evidence>',
    'Use only evidence you actually observed. Omit unknown fields and do not put the evidence block inside Markdown fences.',
  ].join('\n')
}

function parseRuntimeResult(
  rawAnswer: string,
  agent: NormalizedAgent,
  dispatch: RuntimeDispatch,
): { answer: string; envelope: RuntimeResultEnvelope } {
  const match = /<agora-evidence>([\s\S]*?)<\/agora-evidence>/u.exec(rawAnswer)
  const answer = (match ? rawAnswer.replace(match[0], '') : rawAnswer).trim()
  const payload = match ? parseJsonRecord(match[1] ?? '') : null
  const evidence = parseEvidence(payload?.evidence)
  const evidenceIds = new Set(evidence.map(item => item.id))
  const claims = parseClaims(payload?.claims, evidenceIds)
  const confidence = confidenceValue(payload?.confidence)
  const revision = stringValue(payload?.revision)
  return {
    answer,
    envelope: {
      schema: 'agora.runtime-result/v1',
      answer,
      claims,
      evidence,
      ...(confidence === null ? {} : { confidence }),
      environment: {
        runtime_provider: 'dsh',
        agent_ref: agent.id,
        model: agent.model,
        workspace_alias: dispatch.workspace_alias ?? agent.workspaceAlias,
        ...(revision === null ? {} : { revision }),
        metadata: {
          node_id: dispatch.node_id,
          runtime_target_ref: dispatch.runtime_target_ref,
          dispatch_id: dispatch.id,
        },
      },
    },
  }
}

const evidenceKinds = new Set<RuntimeResultEvidence['kind']>([
  'file', 'url', 'commit', 'measurement', 'log', 'command', 'other',
])

function parseEvidence(value: unknown): RuntimeResultEvidence[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const parsed: RuntimeResultEvidence[] = []
  for (const item of value) {
    if (!isRecord(item)) continue
    const id = stringValue(item.id)
    const kind = stringValue(item.kind) as RuntimeResultEvidence['kind'] | null
    if (!id || !kind || !evidenceKinds.has(kind) || seen.has(id)) continue
    seen.add(id)
    const metadata = isRecord(item.metadata) ? item.metadata : null
    parsed.push({
      id,
      kind,
      ...(stringValue(item.label) === null ? {} : { label: stringValue(item.label) }),
      ...(stringValue(item.uri) === null ? {} : { uri: stringValue(item.uri) }),
      ...(stringValue(item.content_hash) === null ? {} : { content_hash: stringValue(item.content_hash) }),
      ...(stringValue(item.revision) === null ? {} : { revision: stringValue(item.revision) }),
      ...(positiveInteger(item.line_start) === null ? {} : { line_start: positiveInteger(item.line_start) }),
      ...(positiveInteger(item.line_end) === null ? {} : { line_end: positiveInteger(item.line_end) }),
      ...(metadata === null ? {} : { metadata }),
    })
  }
  return parsed
}

function parseClaims(value: unknown, evidenceIds: ReadonlySet<string>): RuntimeResultClaim[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const parsed: RuntimeResultClaim[] = []
  for (const item of value) {
    if (!isRecord(item)) continue
    const id = stringValue(item.id)
    const statement = stringValue(item.statement)
    if (!id || !statement || seen.has(id)) continue
    seen.add(id)
    const evidence_ids = Array.isArray(item.evidence_ids)
      ? [...new Set(item.evidence_ids.filter((candidate): candidate is string => (
        typeof candidate === 'string' && evidenceIds.has(candidate)
      )))]
      : []
    const confidence = confidenceValue(item.confidence)
    parsed.push({
      id,
      statement,
      evidence_ids,
      ...(confidence === null ? {} : { confidence }),
    })
  }
  return parsed
}

function parseJsonRecord(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value) as unknown
    return isRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

function confidenceValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1 ? value : null
}

function positiveInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null
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

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}
