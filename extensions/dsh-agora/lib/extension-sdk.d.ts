import type { RuntimeDispatch, RuntimeDispatchProgressInput, RuntimeNodeAgent, RuntimeResultEnvelope } from './contracts.js';
export declare const DSH_AGORA_EXTENSION_PROTOCOL: "dsh-agora.extension/v1";
export declare const DSH_AGORA_RUNTIME_PROTOCOL: "dsh-agora.runtime/v1";
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
export interface DshAgoraExtensionRegistryApi {
    registerExtension(extension: DshAgoraExtensionV1): () => void;
    listExtensions(): readonly DshAgoraExtensionV1[];
}
export declare class DshAgoraExtensionRegistry implements DshAgoraExtensionRegistryApi {
    private readonly extensions;
    registerExtension(extension: DshAgoraExtensionV1): () => void;
    listExtensions(): readonly DshAgoraExtensionV1[];
    runtimeForTarget(runtimeTargetRef: string): DshAgoraRuntimeAdapterV1 | null;
}
//# sourceMappingURL=extension-sdk.d.ts.map