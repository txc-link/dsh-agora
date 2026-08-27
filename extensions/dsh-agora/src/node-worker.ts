import type { AgoraClient } from './agora-client.js'
import {
  DSH_AGORA_NODE_PROTOCOL,
  type DshAgoraNodeStatus,
  type RuntimeDispatch,
  type RuntimeNodeBot,
} from './contracts.js'
import type { DshAgoraExtensionRegistry } from './extension-sdk.js'
import type { DshImBridgeV1, DshImSendRequestV1 } from './im-bridge-v1.js'

export interface RuntimeNodeWorkerOptions {
  readonly client: AgoraClient
  readonly registry: DshAgoraExtensionRegistry
  readonly nodeId: string
  readonly instanceId: string
  readonly pluginVersion: string
  readonly heartbeatIntervalMs?: number
  readonly dispatchPollIntervalMs?: number
  readonly leaseSeconds?: number
  readonly dispatchLeaseSeconds?: number
  readonly maxConcurrent?: number
  readonly imBridge?: DshImBridgeV1 | null
  readonly metadata?: Readonly<Record<string, unknown>>
  onStatus?(status: DshAgoraNodeStatus): void
}

export class RuntimeNodeWorker {
  private readonly abortController = new AbortController()
  private heartbeatTimer: ReturnType<typeof setTimeout> | null = null
  private dispatchTimer: ReturnType<typeof setTimeout> | null = null
  private active = 0
  private started = false
  private imBridge: DshImBridgeV1 | null

  constructor(private readonly options: RuntimeNodeWorkerOptions) {
    this.imBridge = options.imBridge ?? null
  }

  setImBridge(bridge: DshImBridgeV1 | null): void {
    this.imBridge = bridge
  }

  start(): void {
    if (this.started) return
    this.started = true
    this.setStatus({ state: 'connecting', nodeId: this.options.nodeId })
    void this.heartbeatLoop()
    void this.dispatchLoop()
  }

  stop(): void {
    if (!this.started) return
    this.started = false
    this.abortController.abort(new DOMException('dsh-agora node worker stopped', 'AbortError'))
    if (this.heartbeatTimer !== null) clearTimeout(this.heartbeatTimer)
    if (this.dispatchTimer !== null) clearTimeout(this.dispatchTimer)
    this.heartbeatTimer = null
    this.dispatchTimer = null
  }

  private async heartbeatLoop(): Promise<void> {
    if (this.abortController.signal.aborted) return
    try {
      const agents = (await Promise.all(
        this.options.registry.listExtensions()
          .filter(extension => extension.runtime !== undefined)
          .map(extension => extension.runtime!.describeAgents()),
      )).flat()
      if (agents.length === 0) throw new Error('no runtime agents are registered')
      const bots = await this.listBots()
      const now = new Date().toISOString()
      await this.options.client.heartbeatRuntimeNode(this.options.nodeId, {
        protocol: DSH_AGORA_NODE_PROTOCOL,
        instance_id: this.options.instanceId,
        plugin_version: this.options.pluginVersion,
        host_framework: 'deepseek-harness',
        runtime_provider: 'dsh',
        agents,
        bots,
        capacity: { max_concurrent: this.maxConcurrent, active: this.active },
        lease_seconds: this.leaseSeconds,
        metadata: this.options.metadata ?? null,
      }, this.abortController.signal)
      this.setStatus({ state: 'online', nodeId: this.options.nodeId, lastHeartbeatAt: now })
    } catch (error) {
      if (!this.abortController.signal.aborted) {
        this.setStatus({
          state: 'error', nodeId: this.options.nodeId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    } finally {
      this.heartbeatTimer = schedule(
        () => void this.heartbeatLoop(),
        this.options.heartbeatIntervalMs ?? 30_000,
        this.abortController.signal,
      )
    }
  }

  private async dispatchLoop(): Promise<void> {
    if (this.abortController.signal.aborted) return
    try {
      while (this.active < this.maxConcurrent && !this.abortController.signal.aborted) {
        const dispatch = await this.options.client.claimRuntimeDispatch(
          this.options.nodeId,
          this.options.instanceId,
          this.options.dispatchLeaseSeconds ?? 120,
          this.abortController.signal,
        )
        if (!dispatch) break
        this.active += 1
        void this.execute(dispatch).finally(() => { this.active -= 1 })
      }
    } catch {
      // Heartbeat owns the operator-visible status. Dispatch polling is retried
      // independently so a transient queue error does not flap node presence.
    } finally {
      this.dispatchTimer = schedule(
        () => void this.dispatchLoop(),
        this.options.dispatchPollIntervalMs ?? 2_000,
        this.abortController.signal,
      )
    }
  }

  private async execute(dispatch: RuntimeDispatch): Promise<void> {
    const runtime = this.options.registry.runtimeForTarget(dispatch.runtime_target_ref)
    if (!runtime) {
      await this.fail(dispatch, `no runtime adapter accepts ${dispatch.runtime_target_ref}`)
      return
    }
    try {
      const result = await runtime.execute(dispatch, this.abortController.signal)
      if (dispatch.task_id && dispatch.participant_binding_id) {
        await this.options.client.bindRuntimeSession(
          dispatch.task_id,
          dispatch.participant_binding_id,
          result.sessionId,
          dispatch.runtime_target_ref,
          this.abortController.signal,
        )
      }
      const presentation = await this.present(dispatch, result.answer)
      await this.options.client.completeRuntimeDispatch(
        this.options.nodeId,
        dispatch.id,
        {
          instance_id: this.options.instanceId,
          status: 'completed',
          session_id: result.sessionId,
          result: {
            answer: result.answer,
            reason: result.reason ?? null,
            ...(result.metadata ?? {}),
            ...(presentation === null ? {} : { presentation }),
          },
        },
        this.abortController.signal,
      )
    } catch (error) {
      if (this.abortController.signal.aborted) return
      await this.fail(dispatch, error instanceof Error ? error.message : String(error))
    }
  }

  private async fail(dispatch: RuntimeDispatch, error: string): Promise<void> {
    try {
      await this.options.client.completeRuntimeDispatch(
        this.options.nodeId,
        dispatch.id,
        { instance_id: this.options.instanceId, status: 'failed', error },
        this.abortController.signal,
      )
    } catch {
      // The claim lease will expire and make the durable dispatch retryable.
    }
  }

  private async present(dispatch: RuntimeDispatch, answer: string): Promise<Record<string, unknown> | null> {
    const bridge = this.imBridge
    if (!bridge || !answer.trim()) return null
    const metadata = asRecord(dispatch.metadata)
    const target = asRecord(metadata?.presentation_target)
    if (!target || target.mode !== 'destination_bot') return null
    const provider = stringValue(target.provider)
    const conversationRef = stringValue(target.conversation_ref)
    if (!provider || !conversationRef) return null
    const bots = await bridge.listBots()
    const agentRef = dispatch.runtime_target_ref.split(':').at(-1)
    const bot = bots.find(item => item.connected && item.provider === provider && item.agent_ref === agentRef)
      ?? bots.find(item => item.connected && item.provider === provider)
    if (!bot) return { sent: false, reason: `no connected ${provider} bot on destination node` }
    const request: DshImSendRequestV1 = {
      provider,
      bot_ref: bot.bot_ref,
      conversation_ref: conversationRef,
      thread_ref: stringValue(target.thread_ref),
      reply_to_message_ref: stringValue(target.reply_to_message_ref),
      text: answer,
      idempotency_key: `agora:${dispatch.id}:result`,
    }
    try {
      const receipt = await bridge.send(request)
      return { sent: true, bot_ref: bot.bot_ref, provider_message_refs: receipt.provider_message_refs }
    } catch (error) {
      return { sent: false, reason: error instanceof Error ? error.message : String(error) }
    }
  }

  private async listBots(): Promise<readonly RuntimeNodeBot[]> {
    try { return await this.imBridge?.listBots() ?? [] } catch { return [] }
  }

  private setStatus(status: DshAgoraNodeStatus): void {
    this.options.onStatus?.(status)
  }

  private get leaseSeconds(): number {
    return this.options.leaseSeconds ?? 90
  }

  private get maxConcurrent(): number {
    return this.options.maxConcurrent ?? 1
  }
}

function schedule(callback: () => void, delay: number, signal: AbortSignal): ReturnType<typeof setTimeout> | null {
  if (signal.aborted) return null
  const timer = setTimeout(callback, delay)
  timer.unref?.()
  return timer
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}
