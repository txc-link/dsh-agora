import type { RuntimeDispatch, RuntimeNodeAgent, RuntimeUsage } from './contracts.js'
import { DSH_AGORA_RUNTIME_PROTOCOL, type DshAgoraRuntimeAdapterV1, type RuntimeExecutionContext, type RuntimeExecutionResult } from './extension-sdk.js'
import { formatExternalRuntimePrompt } from './runtime-prompt.js'
import { runRuntimeCommand, type RuntimeCommandRunner } from './runtime-command.js'

export interface ConfiguredOpenClawAgent {
  readonly id: string
  readonly displayName?: string
  readonly workspace?: string
  readonly model?: string
  readonly roles?: readonly string[]
  readonly capabilities?: readonly string[]
}

export interface OpenClawRuntimeOptions {
  readonly agents: readonly ConfiguredOpenClawAgent[]
  readonly binary?: string
  readonly timeoutMs?: number
  readonly env?: Readonly<Record<string, string>>
  readonly runCommand?: RuntimeCommandRunner
}

export class OpenClawRuntimeAdapter implements DshAgoraRuntimeAdapterV1 {
  readonly protocol = DSH_AGORA_RUNTIME_PROTOCOL
  private readonly agents: readonly NormalizedAgent[]
  private readonly runner: RuntimeCommandRunner
  private readonly active = new Map<string, AbortController>()

  constructor(private readonly options: OpenClawRuntimeOptions) {
    this.agents = normalizeAgents(options.agents)
    this.runner = options.runCommand ?? runRuntimeCommand
  }

  supportsTarget(runtimeTargetRef: string): boolean {
    const ref = agentRef(runtimeTargetRef)
    return ref?.startsWith('openclaw/') === true && this.agents.some(agent => `openclaw/${agent.id}` === ref)
  }

  describeAgents(): readonly RuntimeNodeAgent[] {
    return this.agents.map(agent => ({
      agent_ref: `openclaw/${agent.id}`,
      display_name: agent.displayName,
      preset: null,
      model: agent.model,
      workspace_alias: null,
      roles: agent.roles,
      capabilities: agent.capabilities,
    }))
  }

  async execute(dispatch: RuntimeDispatch, signal: AbortSignal, context?: RuntimeExecutionContext): Promise<RuntimeExecutionResult> {
    const ref = agentRef(dispatch.runtime_target_ref)
    const id = ref?.startsWith('openclaw/') ? ref.slice('openclaw/'.length) : ''
    const agent = this.agents.find(candidate => candidate.id === id)
    if (!agent) throw new Error(`OpenClaw target ${dispatch.runtime_target_ref} is not configured on this node`)
    const startedAt = Date.now()
    const localAbort = new AbortController()
    const timeout = AbortSignal.timeout(normalizeTimeout(this.options.timeoutMs))
    const executionSignal = AbortSignal.any([signal, localAbort.signal, timeout])
    const stableSessionKey = dispatch.session_id ?? `agora:${dispatch.node_id}:${dispatch.task_id ?? dispatch.id}:openclaw:${agent.id}`
    this.active.set(stableSessionKey, localAbort)
    await context?.reportProgress({ phase: 'runtime_started', message: `OpenClaw agent ${agent.id} started`, percent: 15 })
    try {
      const args = ['agent', '--agent', agent.id, '--message-file', '-', '--json']
      if (dispatch.session_id) args.push('--session-id', dispatch.session_id)
      else args.push('--session-key', stableSessionKey)
      if (agent.model) args.push('--model', agent.model)
      args.push('--timeout', String(Math.max(1, Math.ceil(normalizeTimeout(this.options.timeoutMs) / 1_000))))
      const result = await this.runner({
        command: this.options.binary?.trim() || 'openclaw',
        args,
        input: formatExternalRuntimePrompt(dispatch),
        ...(agent.workspace === null ? {} : { cwd: agent.workspace }),
        ...(this.options.env === undefined ? {} : { env: this.options.env }),
        signal: executionSignal,
      })
      const parsed = parseOpenClawResult(result.stdout)
      if (result.exitCode !== 0 || parsed.ok === false || parsed.status === 'error' || parsed.status === 'timeout') {
        throw new Error(openClawError(parsed, result.stderr, result.exitCode))
      }
      const answer = answerFromOpenClaw(parsed)
      const sessionId = stringValue(parsed.sessionId)
        ?? stringValue(record(parsed.meta)?.sessionId)
        ?? stringValue(record(record(parsed.meta)?.agentMeta)?.sessionId)
        ?? stableSessionKey
      const usage = openClawUsage(parsed, Date.now() - startedAt)
      await context?.reportProgress({ phase: 'response_completed', message: 'OpenClaw response completed', percent: 90 })
      return {
        sessionId,
        answer,
        metadata: { runtime_provider: 'openclaw', agent_ref: agent.id, dispatch_id: dispatch.id },
        resultEnvelope: {
          schema: 'agora.runtime-result/v1', answer, claims: [], evidence: [], usage,
          environment: {
            runtime_provider: 'openclaw', agent_ref: agent.id, model: stringValue(parsed.model) ?? agent.model,
            workspace_alias: dispatch.workspace_alias ?? null,
            metadata: { node_id: dispatch.node_id, runtime_target_ref: dispatch.runtime_target_ref, dispatch_id: dispatch.id },
          },
        },
      }
    } finally {
      this.active.delete(stableSessionKey)
    }
  }

  async cancel(sessionId: string, _signal: AbortSignal): Promise<boolean> {
    const controller = this.active.get(sessionId)
    if (!controller) return false
    controller.abort(new DOMException('OpenClaw run cancelled by Agora', 'AbortError'))
    return true
  }
}

interface NormalizedAgent {
  readonly id: string
  readonly displayName: string | null
  readonly workspace: string | null
  readonly model: string | null
  readonly roles: readonly string[]
  readonly capabilities: readonly string[]
}

function normalizeAgents(agents: readonly ConfiguredOpenClawAgent[]): readonly NormalizedAgent[] {
  const seen = new Set<string>()
  return agents.map(agent => {
    const id = required(agent.id, 'OpenClaw agent id')
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(id)) throw new TypeError(`invalid OpenClaw agent id ${id}`)
    if (seen.has(id)) throw new TypeError(`duplicate OpenClaw agent id ${id}`)
    seen.add(id)
    return {
      id,
      displayName: optional(agent.displayName),
      workspace: optional(agent.workspace),
      model: optional(agent.model),
      roles: unique(agent.roles ?? []),
      capabilities: unique(agent.capabilities ?? ['runtime.execute', 'session.resume']),
    }
  }).sort((left, right) => left.id.localeCompare(right.id))
}

function parseOpenClawResult(stdout: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(stdout.trim()) as unknown
    const normalized = record(parsed)
    if (!normalized) throw new Error('response is not an object')
    return normalized
  } catch (error) {
    throw new Error(`OpenClaw returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function answerFromOpenClaw(parsed: Record<string, unknown>): string {
  const direct = stringValue(parsed.final) ?? stringValue(parsed.answer)
  if (direct) return direct
  const payloads = Array.isArray(parsed.payloads) ? parsed.payloads : []
  const texts = payloads.map(item => stringValue(record(item)?.text)).filter((value): value is string => value !== null)
  if (texts.length) return texts.join('\n')
  throw new Error('OpenClaw completed without a final answer')
}

function openClawUsage(parsed: Record<string, unknown>, durationMs: number): RuntimeUsage {
  const usage = record(parsed.usage) ?? record(record(record(parsed.meta)?.agentMeta)?.usage)
  return {
    input_tokens: numberValue(usage?.input ?? usage?.input_tokens),
    output_tokens: numberValue(usage?.output ?? usage?.output_tokens),
    total_tokens: numberValue(usage?.total ?? usage?.total_tokens),
    tool_calls: numberValue(record(parsed.toolSummary)?.calls ?? record(record(parsed.meta)?.toolSummary)?.calls),
    cost_usd: numberValue(parsed.costUsd ?? record(parsed.meta)?.costUsd),
    duration_ms: durationMs,
  }
}

function openClawError(parsed: Record<string, unknown>, stderr: string, exitCode: number | null): string {
  return stringValue(record(parsed.error)?.message) ?? stringValue(parsed.error) ?? (stderr.trim() || `OpenClaw exited with code ${exitCode ?? 'unknown'}`)
}

function agentRef(target: string): string | null { return target.split(':').at(-1)?.trim() || null }
function normalizeTimeout(value: number | undefined): number { return Number.isSafeInteger(value) && (value ?? 0) >= 1_000 ? value! : 600_000 }
function unique(values: readonly string[]): readonly string[] { return [...new Set(values.map(value => value.trim()).filter(Boolean))].sort() }
function optional(value: string | undefined): string | null { return value?.trim() || null }
function required(value: string, label: string): string { const normalized = value.trim(); if (!normalized) throw new TypeError(`${label} is required`); return normalized }
function record(value: unknown): Record<string, unknown> | null { return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null }
function stringValue(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value.trim() : null }
function numberValue(value: unknown): number | null { return typeof value === 'number' && Number.isFinite(value) ? value : null }
