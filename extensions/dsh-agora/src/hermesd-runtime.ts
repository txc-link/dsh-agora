import { createHash } from 'node:crypto'
import type { RuntimeDispatch, RuntimeNodeAgent, RuntimeUsage } from './contracts.js'
import { DSH_AGORA_RUNTIME_PROTOCOL, type DshAgoraRuntimeAdapterV1, type RuntimeExecutionContext, type RuntimeExecutionResult } from './extension-sdk.js'
import { formatExternalRuntimePrompt } from './runtime-prompt.js'

export interface ConfiguredHermesProfile {
  readonly id: string
  readonly displayName?: string
  readonly serverProfile?: string
  readonly roles?: readonly string[]
  readonly capabilities?: readonly string[]
}

export interface HermesdRuntimeOptions {
  readonly baseUrl: string
  readonly apiKey?: string
  readonly profiles: readonly ConfiguredHermesProfile[]
  readonly pollIntervalMs?: number
  readonly timeoutMs?: number
  readonly fetch?: typeof globalThis.fetch
}

interface HermesRunStatus {
  readonly run_id?: string
  readonly status?: string
  readonly session_id?: string
  readonly output?: string
  readonly model?: string
  readonly error?: unknown
  readonly usage?: {
    readonly input_tokens?: number
    readonly output_tokens?: number
    readonly total_tokens?: number
    readonly tool_calls?: number
    readonly cost_usd?: number
  }
}

export class HermesdRuntimeAdapter implements DshAgoraRuntimeAdapterV1 {
  readonly protocol = DSH_AGORA_RUNTIME_PROTOCOL
  private readonly origin: URL
  private readonly fetchImpl: typeof globalThis.fetch
  private readonly profiles: readonly NormalizedProfile[]
  private readonly active = new Map<string, { runId: string; profile: NormalizedProfile }>()

  constructor(private readonly options: HermesdRuntimeOptions) {
    this.origin = new URL(options.baseUrl)
    this.fetchImpl = options.fetch ?? globalThis.fetch
    this.profiles = normalizeProfiles(options.profiles)
  }

  supportsTarget(runtimeTargetRef: string): boolean {
    const parsed = parseTarget(runtimeTargetRef)
    return parsed !== null && this.profiles.some(profile => profile.id === parsed.id)
  }

  describeAgents(): readonly RuntimeNodeAgent[] {
    return this.profiles.map(profile => ({
      agent_ref: `hermes/${profile.id}`,
      display_name: profile.displayName,
      preset: profile.serverProfile,
      model: null,
      workspace_alias: null,
      roles: profile.roles,
      capabilities: profile.capabilities,
    }))
  }

  async execute(dispatch: RuntimeDispatch, signal: AbortSignal, context?: RuntimeExecutionContext): Promise<RuntimeExecutionResult> {
    const target = parseTarget(dispatch.runtime_target_ref)
    const profile = target ? this.profiles.find(candidate => candidate.id === target.id) : undefined
    if (!profile) throw new Error(`Hermes target ${dispatch.runtime_target_ref} is not configured on this node`)
    const startedAt = Date.now()
    const timeout = AbortSignal.timeout(normalizeTimeout(this.options.timeoutMs))
    const executionSignal = AbortSignal.any([signal, timeout])
    const requestedSessionId = dispatch.session_id ?? `agora:${dispatch.node_id}:${dispatch.task_id ?? dispatch.id}:hermes:${profile.id}`
    let runId: string | null = null
    try {
      await context?.reportProgress({ phase: 'runtime_started', message: `Hermes profile ${profile.id} started`, percent: 15 })
      const created = await this.requestJson<HermesRunStatus>(profile, '/v1/runs', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': hermesIdempotencyKey(dispatch.idempotency_key),
        },
        body: JSON.stringify({
          input: formatExternalRuntimePrompt(dispatch),
          session_id: requestedSessionId,
        }),
        signal: executionSignal,
      })
      runId = required(created.run_id ?? '', 'Hermes run_id')
      this.active.set(requestedSessionId, { runId, profile })
      let lastStatus = ''
      while (true) {
        const status = await this.requestJson<HermesRunStatus>(profile, `/v1/runs/${encodeURIComponent(runId)}`, {
          method: 'GET', signal: executionSignal,
        })
        const state = status.status?.trim().toLowerCase() || 'unknown'
        if (state !== lastStatus) {
          lastStatus = state
          await context?.reportProgress({ phase: `hermes_${state}`, message: `Hermes run ${state}`, percent: hermesPercent(state), details: { run_id: runId } })
        }
        if (state === 'completed') {
          const answer = required(status.output ?? '', 'Hermes run output')
          const sessionId = status.session_id?.trim() || requestedSessionId
          const usage = hermesUsage(status.usage, Date.now() - startedAt)
          return {
            sessionId,
            answer,
            metadata: { runtime_provider: 'hermes', profile: profile.id, run_id: runId, dispatch_id: dispatch.id },
            resultEnvelope: {
              schema: 'agora.runtime-result/v1', answer, claims: [], evidence: [], usage,
              environment: {
                runtime_provider: 'hermes', agent_ref: profile.id, model: status.model?.trim() || null,
                workspace_alias: dispatch.workspace_alias ?? null,
                metadata: { node_id: dispatch.node_id, runtime_target_ref: dispatch.runtime_target_ref, dispatch_id: dispatch.id, run_id: runId },
              },
            },
          }
        }
        if (state === 'failed' || state === 'cancelled' || state === 'canceled') {
          throw new Error(`Hermes run ${state}: ${errorMessage(status.error) ?? 'no error detail'}`)
        }
        if (state === 'requires_action' || state === 'waiting_for_approval') {
          throw new Error('Hermes run requires human approval; approval bridging into the Agora Human Gate is not configured')
        }
        await sleep(normalizePollInterval(this.options.pollIntervalMs), executionSignal)
      }
    } catch (error) {
      if (executionSignal.aborted && runId) {
        try { await this.stop(profile, runId, AbortSignal.timeout(10_000)) } catch { /* Preserve original timeout/cancellation. */ }
      }
      throw error
    } finally {
      this.active.delete(requestedSessionId)
    }
  }

  async cancel(sessionId: string, signal: AbortSignal): Promise<boolean> {
    const active = this.active.get(sessionId)
    if (!active) return false
    await this.stop(active.profile, active.runId, signal)
    return true
  }

  private async stop(profile: NormalizedProfile, runId: string, signal: AbortSignal): Promise<void> {
    await this.requestJson(profile, `/v1/runs/${encodeURIComponent(runId)}/stop`, { method: 'POST', signal })
  }

  private async requestJson<T>(profile: NormalizedProfile, path: string, init: RequestInit & { signal: AbortSignal }): Promise<T> {
    const response = await this.fetchImpl(this.url(profile, path), {
      ...init,
      headers: {
        accept: 'application/json',
        ...(this.options.apiKey?.trim() ? { authorization: `Bearer ${this.options.apiKey.trim()}` } : {}),
        ...init.headers,
      },
    })
    if (!response.ok) throw new Error(`Hermes returned HTTP ${response.status} for ${init.method ?? 'GET'} ${path}`)
    return await response.json() as T
  }

  private url(profile: NormalizedProfile, path: string): URL {
    const prefix = profile.serverProfile ? `/p/${encodeURIComponent(profile.serverProfile)}` : ''
    return new URL(`${prefix}${path}`, this.origin)
  }
}

interface NormalizedProfile {
  readonly id: string
  readonly displayName: string | null
  readonly serverProfile: string | null
  readonly roles: readonly string[]
  readonly capabilities: readonly string[]
}

function normalizeProfiles(profiles: readonly ConfiguredHermesProfile[]): readonly NormalizedProfile[] {
  const seen = new Set<string>()
  return profiles.map(profile => {
    const id = required(profile.id, 'Hermes profile id')
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(id)) throw new TypeError(`invalid Hermes profile id ${id}`)
    if (seen.has(id)) throw new TypeError(`duplicate Hermes profile id ${id}`)
    seen.add(id)
    return {
      id,
      displayName: profile.displayName?.trim() || null,
      serverProfile: profile.serverProfile?.trim() || null,
      roles: unique(profile.roles ?? []),
      capabilities: unique(profile.capabilities ?? ['runtime.execute', 'session.resume', 'session.cancel']),
    }
  }).sort((left, right) => left.id.localeCompare(right.id))
}

function parseTarget(target: string): { id: string } | null {
  const ref = target.split(':').at(-1)?.trim() ?? ''
  const match = /^(?:hermes|hermesd)\/(.+)$/u.exec(ref)
  return match?.[1] ? { id: match[1] } : null
}

function hermesUsage(usage: HermesRunStatus['usage'], durationMs: number): RuntimeUsage {
  return {
    input_tokens: numberValue(usage?.input_tokens), output_tokens: numberValue(usage?.output_tokens),
    total_tokens: numberValue(usage?.total_tokens), tool_calls: numberValue(usage?.tool_calls),
    cost_usd: numberValue(usage?.cost_usd), duration_ms: durationMs,
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(signal.reason); return }
    const timer = setTimeout(resolve, ms)
    timer.unref?.()
    signal.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason) }, { once: true })
  })
}

function errorMessage(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const message = (value as Record<string, unknown>).message
    return typeof message === 'string' && message.trim() ? message.trim() : null
  }
  return null
}

function hermesPercent(status: string): number { return status === 'queued' ? 25 : status === 'running' ? 60 : status === 'completed' ? 90 : 50 }
function hermesIdempotencyKey(value: string): string {
  const normalized = required(value, 'dispatch idempotency_key')
  return /^[\x21-\x7e]{1,255}$/u.test(normalized)
    ? normalized
    : `agora-${createHash('sha256').update(normalized).digest('hex')}`
}
function normalizePollInterval(value: number | undefined): number { return Number.isSafeInteger(value) && (value ?? 0) > 0 ? value! : 1_000 }
function normalizeTimeout(value: number | undefined): number { return Number.isSafeInteger(value) && (value ?? 0) >= 1_000 ? value! : 600_000 }
function unique(values: readonly string[]): readonly string[] { return [...new Set(values.map(value => value.trim()).filter(Boolean))].sort() }
function required(value: string, label: string): string { const normalized = value.trim(); if (!normalized) throw new TypeError(`${label} is required`); return normalized }
function numberValue(value: unknown): number | null { return typeof value === 'number' && Number.isFinite(value) ? value : null }
