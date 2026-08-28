import type { RuntimeDispatch, RuntimeDispatchProgressInput, RuntimeNodeAgent, RuntimeResultEnvelope } from './contracts.js';
export declare const DSH_AGORA_EXTENSION_PROTOCOL: "dsh-agora.extension/v1";
export declare const DSH_AGORA_RUNTIME_PROTOCOL: "dsh-agora.runtime/v1";
export declare const DSH_AGORA_EXTENSION_MANIFEST_PROTOCOL: "dsh-agora.extension-manifest/v1";
export interface RuntimeExecutionResult {
    readonly sessionId: string;
    readonly answer: string;
    readonly reason?: string | null;
    readonly metadata?: Readonly<Record<string, unknown>>;
    readonly resultEnvelope?: RuntimeResultEnvelope;
}
export interface RuntimeExecutionContext {
    reportProgress(event: RuntimeDispatchProgressInput): Promise<void>;
}
export interface DshAgoraRuntimeAdapterV1 {
    readonly protocol: typeof DSH_AGORA_RUNTIME_PROTOCOL;
    supportsTarget?(runtimeTargetRef: string): boolean;
    describeAgents(): readonly RuntimeNodeAgent[] | Promise<readonly RuntimeNodeAgent[]>;
    execute(dispatch: RuntimeDispatch, signal: AbortSignal, context?: RuntimeExecutionContext): Promise<RuntimeExecutionResult>;
    cancel?(sessionId: string, signal: AbortSignal): Promise<boolean>;
}
export interface DshAgoraExtensionV1 {
    readonly protocol: typeof DSH_AGORA_EXTENSION_PROTOCOL;
    readonly id: string;
    readonly kind: 'runtime' | 'transport' | 'context' | 'workflow' | 'artifact' | 'event-sink' | 'policy';
    readonly capabilities: readonly string[];
    readonly runtime?: DshAgoraRuntimeAdapterV1;
    readonly metadata?: Readonly<Record<string, unknown>>;
}
export interface DshAgoraExtensionManifestV1 {
    readonly protocol: typeof DSH_AGORA_EXTENSION_MANIFEST_PROTOCOL;
    readonly id: string;
    readonly version: string;
    readonly kind: DshAgoraExtensionV1['kind'];
    readonly integrity_sha256: string;
    readonly capabilities: readonly string[];
    readonly permissions: readonly {
        readonly capability: string;
        readonly resources: readonly string[];
    }[];
    readonly publisher: {
        readonly id: string;
        readonly key_id: string;
    };
    readonly signature?: {
        readonly algorithm: 'Ed25519';
        readonly value: string;
    } | null;
}
export interface DshAgoraExtensionTrustPolicy {
    readonly requireSignedThirdParty?: boolean;
    readonly trustedPublicKeys?: Readonly<Record<string, string>>;
    readonly builtInExtensionIds?: readonly string[];
}
export interface DshAgoraExtensionRegistryApi {
    registerExtension(extension: DshAgoraExtensionV1, manifest?: DshAgoraExtensionManifestV1, packageBytes?: Uint8Array): () => void;
    listExtensions(): readonly DshAgoraExtensionV1[];
}
export declare class DshAgoraExtensionRegistry implements DshAgoraExtensionRegistryApi {
    private readonly trustPolicy;
    private readonly extensions;
    private readonly manifests;
    constructor(trustPolicy?: DshAgoraExtensionTrustPolicy);
    registerExtension(extension: DshAgoraExtensionV1, manifest?: DshAgoraExtensionManifestV1, packageBytes?: Uint8Array): () => void;
    manifestFor(id: string): DshAgoraExtensionManifestV1 | null;
    listExtensions(): readonly DshAgoraExtensionV1[];
    runtimeForTarget(runtimeTargetRef: string): DshAgoraRuntimeAdapterV1 | null;
}
export declare function verifyExtensionManifest(manifest: DshAgoraExtensionManifestV1, policy: DshAgoraExtensionTrustPolicy, packageBytes?: Uint8Array): boolean;
export declare function runExtensionConformance(extension: DshAgoraExtensionV1, manifest?: DshAgoraExtensionManifestV1): Promise<{
    readonly ok: true;
    readonly checks: readonly string[];
}>;
//# sourceMappingURL=extension-sdk.d.ts.map