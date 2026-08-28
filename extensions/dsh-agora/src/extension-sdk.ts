import { createHash, createPublicKey, verify as verifySignature } from 'node:crypto'
import type {
  RuntimeDispatch,
  RuntimeDispatchProgressInput,
  RuntimeNodeAgent,
  RuntimeResultEnvelope,
} from './contracts.js'

export const DSH_AGORA_EXTENSION_PROTOCOL = 'dsh-agora.extension/v1' as const
export const DSH_AGORA_RUNTIME_PROTOCOL = 'dsh-agora.runtime/v1' as const
export const DSH_AGORA_EXTENSION_MANIFEST_PROTOCOL = 'dsh-agora.extension-manifest/v1' as const

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
  supportsTarget?(runtimeTargetRef: string): boolean
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

export interface DshAgoraExtensionManifestV1 {
  readonly protocol: typeof DSH_AGORA_EXTENSION_MANIFEST_PROTOCOL
  readonly id: string
  readonly version: string
  readonly kind: DshAgoraExtensionV1['kind']
  readonly integrity_sha256: string
  readonly capabilities: readonly string[]
  readonly permissions: readonly {
    readonly capability: string
    readonly resources: readonly string[]
  }[]
  readonly publisher: {
    readonly id: string
    readonly key_id: string
  }
  readonly signature?: {
    readonly algorithm: 'Ed25519'
    readonly value: string
  } | null
}

export interface DshAgoraExtensionTrustPolicy {
  readonly requireSignedThirdParty?: boolean
  readonly trustedPublicKeys?: Readonly<Record<string, string>>
  readonly builtInExtensionIds?: readonly string[]
}

export interface DshAgoraExtensionRegistryApi {
  registerExtension(extension: DshAgoraExtensionV1, manifest?: DshAgoraExtensionManifestV1, packageBytes?: Uint8Array): () => void
  listExtensions(): readonly DshAgoraExtensionV1[]
}

export class DshAgoraExtensionRegistry implements DshAgoraExtensionRegistryApi {
  private readonly extensions = new Map<string, DshAgoraExtensionV1>()
  private readonly manifests = new Map<string, DshAgoraExtensionManifestV1>()

  constructor(private readonly trustPolicy: DshAgoraExtensionTrustPolicy = {}) {}

  registerExtension(extension: DshAgoraExtensionV1, manifest?: DshAgoraExtensionManifestV1, packageBytes?: Uint8Array): () => void {
    validateExtension(extension)
    const builtIn = new Set(this.trustPolicy.builtInExtensionIds ?? ['dsh-runtime']).has(extension.id)
    if (manifest) {
      validateExtensionManifest(manifest, extension)
      if (this.trustPolicy.requireSignedThirdParty && !builtIn && packageBytes === undefined) {
        throw new Error(`extension "${extension.id}" requires package bytes for integrity verification`)
      }
      verifyExtensionManifest(manifest, this.trustPolicy, packageBytes)
    } else if (this.trustPolicy.requireSignedThirdParty && !builtIn) {
      throw new Error(`extension "${extension.id}" requires a signed manifest`)
    }
    if (this.extensions.has(extension.id)) throw new Error(`dsh-agora extension "${extension.id}" is already registered`)
    const frozen = Object.freeze({
      ...extension,
      capabilities: Object.freeze(unique(extension.capabilities)),
    })
    this.extensions.set(frozen.id, frozen)
    if (manifest) this.manifests.set(frozen.id, Object.freeze({ ...manifest }))
    return () => {
      if (this.extensions.get(frozen.id) === frozen) {
        this.extensions.delete(frozen.id)
        this.manifests.delete(frozen.id)
      }
    }
  }

  manifestFor(id: string): DshAgoraExtensionManifestV1 | null {
    return this.manifests.get(id) ?? null
  }

  listExtensions(): readonly DshAgoraExtensionV1[] {
    return [...this.extensions.values()].sort((left, right) => left.id.localeCompare(right.id))
  }

  runtimeForTarget(runtimeTargetRef: string): DshAgoraRuntimeAdapterV1 | null {
    const runtimes = [...this.extensions.values()].filter(extension => (
      extension.runtime && extension.capabilities.includes('runtime.execute')
    ))
    const explicit = runtimes.find(extension => extension.runtime!.supportsTarget?.(runtimeTargetRef) === true)
    if (explicit?.runtime) return explicit.runtime
    if (runtimeTargetRef.startsWith('dsh:')) {
      const builtIn = runtimes.find(extension => extension.id === 'dsh-runtime')
      if (builtIn?.runtime) return builtIn.runtime
    }
    const legacy = runtimes.filter(extension => extension.runtime!.supportsTarget === undefined)
    return legacy.length === 1 ? legacy[0]!.runtime! : null
  }
}

export function verifyExtensionManifest(
  manifest: DshAgoraExtensionManifestV1,
  policy: DshAgoraExtensionTrustPolicy,
  packageBytes?: Uint8Array,
): boolean {
  if (packageBytes && createHash('sha256').update(packageBytes).digest('hex') !== manifest.integrity_sha256) {
    throw new Error(`extension manifest integrity mismatch for ${manifest.id}`)
  }
  if (!manifest.signature) {
    if (policy.requireSignedThirdParty) throw new Error(`extension manifest ${manifest.id} is unsigned`)
    return false
  }
  const keyRef = `${manifest.publisher.id}:${manifest.publisher.key_id}`
  const publicKey = policy.trustedPublicKeys?.[keyRef]
  if (!publicKey) throw new Error(`extension publisher key ${keyRef} is not trusted`)
  const valid = verifySignature(
    null,
    Buffer.from(canonicalManifest(manifest)),
    createPublicKey(publicKey),
    Buffer.from(manifest.signature.value, 'base64url'),
  )
  if (!valid) throw new Error(`extension manifest signature is invalid for ${manifest.id}`)
  return true
}

export async function runExtensionConformance(
  extension: DshAgoraExtensionV1,
  manifest?: DshAgoraExtensionManifestV1,
): Promise<{ readonly ok: true; readonly checks: readonly string[] }> {
  validateExtension(extension)
  if (manifest) validateExtensionManifest(manifest, extension)
  const checks = ['extension-shape', 'capability-uniqueness']
  if (extension.runtime) {
    const first = normalizeAgents(await extension.runtime.describeAgents())
    const second = normalizeAgents(await extension.runtime.describeAgents())
    if (JSON.stringify(first) !== JSON.stringify(second)) throw new Error('runtime describeAgents must be deterministic')
    if (new Set(first.map(agent => agent.agent_ref)).size !== first.length) throw new Error('runtime describeAgents returned duplicate agent_ref values')
    checks.push('runtime-protocol', 'runtime-deterministic-agents', 'runtime-unique-agent-refs')
  }
  if (manifest) checks.push('manifest-capability-permissions')
  return { ok: true, checks }
}

function validateExtension(extension: DshAgoraExtensionV1): void {
  if (extension.protocol !== DSH_AGORA_EXTENSION_PROTOCOL) {
    throw new TypeError(`extension protocol must be ${DSH_AGORA_EXTENSION_PROTOCOL}`)
  }
  if (!/^[a-z0-9][a-z0-9._-]{0,127}$/u.test(extension.id)) throw new TypeError('extension id is invalid')
  if (!Array.isArray(extension.capabilities) || extension.capabilities.some(value => typeof value !== 'string' || value.trim() === '')) {
    throw new TypeError('extension capabilities must be non-empty strings')
  }
  if (unique(extension.capabilities).length !== extension.capabilities.length) throw new TypeError('extension capabilities must be unique')
  if (extension.runtime !== undefined && extension.runtime.protocol !== DSH_AGORA_RUNTIME_PROTOCOL) {
    throw new TypeError(`runtime adapter protocol must be ${DSH_AGORA_RUNTIME_PROTOCOL}`)
  }
}

function validateExtensionManifest(manifest: DshAgoraExtensionManifestV1, extension: DshAgoraExtensionV1): void {
  if (manifest.protocol !== DSH_AGORA_EXTENSION_MANIFEST_PROTOCOL) throw new TypeError(`manifest protocol must be ${DSH_AGORA_EXTENSION_MANIFEST_PROTOCOL}`)
  if (manifest.id !== extension.id || manifest.kind !== extension.kind) throw new TypeError('manifest identity does not match extension')
  if (!/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/u.test(manifest.version)) throw new TypeError('manifest version must be semantic')
  if (!/^[a-f0-9]{64}$/u.test(manifest.integrity_sha256)) throw new TypeError('manifest integrity_sha256 is invalid')
  const capabilities = unique(extension.capabilities)
  if (JSON.stringify(unique(manifest.capabilities)) !== JSON.stringify(capabilities)) throw new TypeError('manifest capabilities do not match extension capabilities')
  const granted = new Set(manifest.permissions.map(permission => permission.capability))
  if (granted.size !== manifest.permissions.length) throw new TypeError('manifest permissions contain duplicate capabilities')
  for (const capability of capabilities) if (!granted.has(capability)) throw new TypeError(`manifest permission missing for capability ${capability}`)
  for (const permission of manifest.permissions) {
    if (!capabilities.includes(permission.capability)) throw new TypeError(`manifest permission exceeds declared capability ${permission.capability}`)
    if (permission.resources.length === 0 || permission.resources.some(resource => !resource.trim())) {
      throw new TypeError(`manifest permission ${permission.capability} requires explicit resources`)
    }
  }
  if (!/^[a-z0-9][a-z0-9._-]{0,127}$/u.test(manifest.publisher.id) || !manifest.publisher.key_id.trim()) throw new TypeError('manifest publisher is invalid')
  if (manifest.signature && manifest.signature.algorithm !== 'Ed25519') throw new TypeError('only Ed25519 extension signatures are supported')
}

function canonicalManifest(manifest: DshAgoraExtensionManifestV1): string {
  const { signature: _signature, ...unsigned } = manifest
  return stableJson(unsigned)
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(',')}}`
  return JSON.stringify(value) ?? 'null'
}

function normalizeAgents(agents: readonly RuntimeNodeAgent[]): RuntimeNodeAgent[] {
  return agents.map(agent => ({ ...agent, roles: unique(agent.roles), capabilities: unique(agent.capabilities) }))
    .sort((left, right) => left.agent_ref.localeCompare(right.agent_ref))
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))].sort()
}
