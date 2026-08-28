import type { AgoraCommandResult, AgoraRequestContext } from './contracts.js'
import type { DshImBridgeV1 } from './im-bridge-v1.js'

export const DSH_AGORA_COMMAND_ADAPTER_PROTOCOL = 'dsh-agora.command-adapter/v1' as const

export interface DshAgoraCommandEventV1 {
  readonly protocol: typeof DSH_AGORA_COMMAND_ADAPTER_PROTOCOL
  readonly idempotency_key: string
  readonly input: string
  readonly actor_ref: string
  readonly provider?: string | null
  readonly conversation_ref?: string | null
  readonly thread_ref?: string | null
  readonly reply?: {
    readonly enabled: boolean
    readonly bot_ref?: string | null
  } | null
  readonly metadata?: Readonly<Record<string, unknown>> | null
}

export interface DshAgoraCommandEventResultV1 {
  readonly protocol: typeof DSH_AGORA_COMMAND_ADAPTER_PROTOCOL
  readonly idempotency_key: string
  readonly result: AgoraCommandResult
  readonly delivery: {
    readonly sent: boolean
    readonly provider_message_refs: readonly string[]
    readonly reason?: string
  }
}

export interface DshAgoraCommandAdapterV1 {
  readonly protocol: typeof DSH_AGORA_COMMAND_ADAPTER_PROTOCOL
  ingest(event: DshAgoraCommandEventV1, signal?: AbortSignal): Promise<DshAgoraCommandEventResultV1>
}

export class DshAgoraCommandAdapter implements DshAgoraCommandAdapterV1 {
  readonly protocol = DSH_AGORA_COMMAND_ADAPTER_PROTOCOL
  private readonly receipts = new Map<string, Promise<DshAgoraCommandEventResultV1>>()

  constructor(private readonly options: {
    execute(input: string, context: AgoraRequestContext, signal?: AbortSignal): Promise<AgoraCommandResult>
    bridge(): DshImBridgeV1 | null
    receiptLimit?: number
  }) {}

  ingest(event: DshAgoraCommandEventV1, signal?: AbortSignal): Promise<DshAgoraCommandEventResultV1> {
    validateEvent(event)
    const existing = this.receipts.get(event.idempotency_key)
    if (existing) return existing
    const pending = this.execute(event, signal)
    this.receipts.set(event.idempotency_key, pending)
    while (this.receipts.size > (this.options.receiptLimit ?? 2_048)) this.receipts.delete(this.receipts.keys().next().value!)
    pending.catch(() => {
      if (this.receipts.get(event.idempotency_key) === pending) this.receipts.delete(event.idempotency_key)
    })
    return pending
  }

  private async execute(event: DshAgoraCommandEventV1, signal?: AbortSignal): Promise<DshAgoraCommandEventResultV1> {
    const result = await this.options.execute(event.input, {
      actorId: event.actor_ref,
      ...(event.provider ? { provider: event.provider } : {}),
      ...(event.conversation_ref ? { conversationRef: event.conversation_ref } : {}),
      ...(event.thread_ref ? { threadRef: event.thread_ref } : {}),
    }, signal)
    const bridge = this.options.bridge()
    if (!event.reply?.enabled) return envelope(event, result, { sent: false, provider_message_refs: [], reason: 'reply disabled' })
    if (!bridge || !event.provider || !event.conversation_ref) {
      return envelope(event, result, { sent: false, provider_message_refs: [], reason: 'IM bridge or destination unavailable' })
    }
    try {
      const receipt = await bridge.send({
        provider: event.provider,
        conversation_ref: event.conversation_ref,
        ...(event.reply.bot_ref === undefined ? {} : { bot_ref: event.reply.bot_ref }),
        ...(event.thread_ref === undefined ? {} : { thread_ref: event.thread_ref }),
        text: result.text ?? (result.kind === 'success' ? 'Agora command completed.' : 'Agora command failed.'),
        idempotency_key: `command:${event.idempotency_key}`,
      })
      return envelope(event, result, { sent: true, provider_message_refs: receipt.provider_message_refs })
    } catch (error) {
      return envelope(event, result, {
        sent: false,
        provider_message_refs: [],
        reason: `IM delivery failed: ${error instanceof Error ? error.message : String(error)}`,
      })
    }
  }
}

function envelope(
  event: DshAgoraCommandEventV1,
  result: AgoraCommandResult,
  delivery: DshAgoraCommandEventResultV1['delivery'],
): DshAgoraCommandEventResultV1 {
  return { protocol: DSH_AGORA_COMMAND_ADAPTER_PROTOCOL, idempotency_key: event.idempotency_key, result, delivery }
}

function validateEvent(event: DshAgoraCommandEventV1): void {
  if (event.protocol !== DSH_AGORA_COMMAND_ADAPTER_PROTOCOL) throw new TypeError(`command event protocol must be ${DSH_AGORA_COMMAND_ADAPTER_PROTOCOL}`)
  for (const [name, value] of [['idempotency_key', event.idempotency_key], ['input', event.input], ['actor_ref', event.actor_ref]] as const) {
    if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} is required`)
  }
  if (event.reply?.enabled && (!event.provider || !event.conversation_ref)) throw new TypeError('reply requires provider and conversation_ref')
}
