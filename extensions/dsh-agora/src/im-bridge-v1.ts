import type { DshAgoraImStatus, RuntimeNodeBot } from './contracts.js'

export const DSH_IM_BRIDGE_PROTOCOL = 'dsh-im.bridge/v1' as const

export interface DshImSessionRouteV1 {
  readonly provider: string
  readonly bot_ref: string
  readonly session_id: string
  readonly actor_ref: string
  readonly conversation_ref: string
  readonly thread_ref: string | null
  readonly reply_to_message_ref: string | null
  readonly updated_at: string
}

export interface DshImSendRequestV1 {
  readonly provider: string
  readonly bot_ref?: string | null
  readonly conversation_ref: string
  readonly thread_ref?: string | null
  readonly reply_to_message_ref?: string | null
  readonly text: string
  readonly idempotency_key: string
}

export interface DshImBridgeV1 {
  readonly protocol: typeof DSH_IM_BRIDGE_PROTOCOL
  listBots(): readonly RuntimeNodeBot[] | Promise<readonly RuntimeNodeBot[]>
  resolveSession(sessionId: string): DshImSessionRouteV1 | null | Promise<DshImSessionRouteV1 | null>
  send(request: DshImSendRequestV1): Promise<{ readonly provider_message_refs: readonly string[] }>
}

export interface ImBridgeDiscovery {
  readonly status: DshAgoraImStatus
  readonly bridge: DshImBridgeV1 | null
}

export function discoverImBridge(ctx: { get?(name: string): unknown }, serviceNames: readonly string[]): ImBridgeDiscovery {
  for (const serviceName of serviceNames) {
    const candidate = safeGet(ctx, serviceName)
    if (candidate === undefined) continue
    if (!isBridge(candidate)) {
      return {
        status: {
          state: 'incompatible', service: serviceName,
          reason: `service does not implement ${DSH_IM_BRIDGE_PROTOCOL}`,
        },
        bridge: null,
      }
    }
    return {
      status: { state: 'connected', service: serviceName, protocol: candidate.protocol },
      bridge: candidate,
    }
  }
  return {
    status: { state: 'unavailable', reason: `no ${DSH_IM_BRIDGE_PROTOCOL} provider is installed` },
    bridge: null,
  }
}

function safeGet(ctx: { get?(name: string): unknown }, name: string): unknown {
  try { return ctx.get?.(name) } catch { return undefined }
}

function isBridge(value: unknown): value is DshImBridgeV1 {
  if (typeof value !== 'object' || value === null) return false
  const bridge = value as Partial<DshImBridgeV1>
  return bridge.protocol === DSH_IM_BRIDGE_PROTOCOL
    && typeof bridge.listBots === 'function'
    && typeof bridge.resolveSession === 'function'
    && typeof bridge.send === 'function'
}
