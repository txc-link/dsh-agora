import type {
  RuntimeDispatch,
  RuntimeDispatchProgressInput,
  RuntimeNodeAgent,
  RuntimeResultEnvelope,
} from './contracts.js'

export const DSH_AGORA_EXTENSION_PROTOCOL = 'dsh-agora.extension/v1' as const
export const DSH_AGORA_RUNTIME_PROTOCOL = 'dsh-agora.runtime/v1' as const

export interface RuntimeExecutionResult {
  readonly sessionId: string
  readonly answer: string
  readonly reason?: string | null
  readonly metadata?: Readonly<Record<string, unknown>>
  readonly resultEnvelope?: RuntimeResultEnvelope
}

export interface RuntimeExecutionContext {
  reportProgress(event: RuntimeDispatchProgressInput): Promise<void>
}

export interface DshAgoraRuntimeAdapterV1 {
  readonly protocol: typeof DSH_AGORA_RUNTIME_PROTOCOL
  describeAgents(): readonly RuntimeNodeAgent[] | Promise<readonly RuntimeNodeAgent[]>
  execute(dispatch: RuntimeDispatch, signal: AbortSignal, context?: RuntimeExecutionContext): Promise<RuntimeExecutionResult>
  cancel?(sessionId: string, signal: AbortSignal): Promise<boolean>
}

export interface DshAgoraExtensionV1 {
  readonly protocol: typeof DSH_AGORA_EXTENSION_PROTOCOL
  readonly id: string
  readonly kind: 'runtime' | 'transport' | 'context' | 'workflow' | 'artifact' | 'event-sink' | 'policy'
  readonly capabilities: readonly string[]
  readonly runtime?: DshAgoraRuntimeAdapterV1
  readonly metadata?: Readonly<Record<string, unknown>>
}

export interface DshAgoraExtensionRegistryApi {
  registerExtension(extension: DshAgoraExtensionV1): () => void
  listExtensions(): readonly DshAgoraExtensionV1[]
}

export class DshAgoraExtensionRegistry implements DshAgoraExtensionRegistryApi {
  private readonly extensions = new Map<string, DshAgoraExtensionV1>()

  registerExtension(extension: DshAgoraExtensionV1): () => void {
    validateExtension(extension)
    if (this.extensions.has(extension.id)) throw new Error(`dsh-agora extension "${extension.id}" is already registered`)
    const frozen = Object.freeze({
      ...extension,
      capabilities: Object.freeze(unique(extension.capabilities)),
    })
    this.extensions.set(frozen.id, frozen)
    return () => {
      if (this.extensions.get(frozen.id) === frozen) this.extensions.delete(frozen.id)
    }
  }

  listExtensions(): readonly DshAgoraExtensionV1[] {
    return [...this.extensions.values()].sort((left, right) => left.id.localeCompare(right.id))
  }

  runtimeForTarget(runtimeTargetRef: string): DshAgoraRuntimeAdapterV1 | null {
    const agentRef = runtimeTargetRef.split(':').at(-1)
    if (!agentRef) return null
    for (const extension of this.extensions.values()) {
      if (!extension.runtime) continue
      // The built-in DSH adapter owns all dsh:<node>:<agent> targets. Third-party
      // adapters can opt into a narrower target through their own execute guard.
      if (extension.capabilities.includes('runtime.execute')) return extension.runtime
    }
    return null
  }
}

function validateExtension(extension: DshAgoraExtensionV1): void {
  if (extension.protocol !== DSH_AGORA_EXTENSION_PROTOCOL) {
    throw new TypeError(`extension protocol must be ${DSH_AGORA_EXTENSION_PROTOCOL}`)
  }
  if (!/^[a-z0-9][a-z0-9._-]{0,127}$/u.test(extension.id)) throw new TypeError('extension id is invalid')
  if (!Array.isArray(extension.capabilities) || extension.capabilities.some(value => typeof value !== 'string' || value.trim() === '')) {
    throw new TypeError('extension capabilities must be non-empty strings')
  }
  if (extension.runtime !== undefined && extension.runtime.protocol !== DSH_AGORA_RUNTIME_PROTOCOL) {
    throw new TypeError(`runtime adapter protocol must be ${DSH_AGORA_RUNTIME_PROTOCOL}`)
  }
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))].sort()
}
