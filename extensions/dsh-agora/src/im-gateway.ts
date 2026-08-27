import type { AgoraCommandResult, AgoraRequestContext, DshAgoraImStatus } from './contracts.js'

export const DSH_IM_COMMAND_GATEWAY_PROTOCOL = 'dsh-im.command-gateway/v1'

export interface DshImCommandInvocationV1 extends AgoraRequestContext {
  readonly rawInput: string
  readonly signal?: AbortSignal
}

export interface DshImCommandDefinitionV1 {
  readonly name: string
  readonly description: string
  execute(invocation: DshImCommandInvocationV1): Promise<AgoraCommandResult>
}

export interface DshImCommandGatewayV1 {
  readonly protocol: typeof DSH_IM_COMMAND_GATEWAY_PROTOCOL
  registerCommand(definition: DshImCommandDefinitionV1): () => void
}

export interface ImGatewayContext {
  get?(name: string): unknown
}

export interface ImRegistration {
  readonly status: DshAgoraImStatus
  readonly dispose?: () => void
}

export function registerImCommand(
  ctx: ImGatewayContext,
  serviceNames: readonly string[],
  definition: DshImCommandDefinitionV1,
): ImRegistration {
  for (const serviceName of serviceNames) {
    const candidate = safeGet(ctx, serviceName)
    if (candidate === undefined) continue
    if (!isGateway(candidate)) {
      return {
        status: {
          state: 'incompatible',
          service: serviceName,
          reason: `service does not implement ${DSH_IM_COMMAND_GATEWAY_PROTOCOL}`,
        },
      }
    }
    try {
      return {
        status: { state: 'connected', service: serviceName, protocol: candidate.protocol },
        dispose: candidate.registerCommand(definition),
      }
    } catch (error) {
      return {
        status: {
          state: 'incompatible',
          service: serviceName,
          reason: `gateway rejected command registration: ${error instanceof Error ? error.message : String(error)}`,
        },
      }
    }
  }
  return {
    status: {
      state: 'unavailable',
      reason: `no ${DSH_IM_COMMAND_GATEWAY_PROTOCOL} provider is installed`,
    },
  }
}

function safeGet(ctx: ImGatewayContext, serviceName: string): unknown {
  try {
    return ctx.get?.(serviceName)
  } catch {
    return undefined
  }
}

function isGateway(value: unknown): value is DshImCommandGatewayV1 {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<DshImCommandGatewayV1>
  return candidate.protocol === DSH_IM_COMMAND_GATEWAY_PROTOCOL && typeof candidate.registerCommand === 'function'
}
