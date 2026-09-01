import type { RuntimeDispatch, RuntimeNodeAgent } from './contracts.js';
import { type DshAgoraRuntimeAdapterV1, type RuntimeExecutionContext, type RuntimeExecutionResult } from './extension-sdk.js';
export interface ConfiguredHermesProfile {
    readonly id: string;
    readonly displayName?: string;
    readonly serverProfile?: string;
    readonly roles?: readonly string[];
    readonly capabilities?: readonly string[];
}
export interface HermesdRuntimeOptions {
    readonly baseUrl: string;
    readonly apiKey?: string;
    readonly profiles: readonly ConfiguredHermesProfile[];
    readonly pollIntervalMs?: number;
    readonly timeoutMs?: number;
    readonly fetch?: typeof globalThis.fetch;
}
export declare class HermesdRuntimeAdapter implements DshAgoraRuntimeAdapterV1 {
    private readonly options;
    readonly protocol: "dsh-agora.runtime/v1";
    private readonly origin;
    private readonly fetchImpl;
    private readonly profiles;
    private readonly active;
    constructor(options: HermesdRuntimeOptions);
    supportsTarget(runtimeTargetRef: string): boolean;
    describeAgents(): readonly RuntimeNodeAgent[];
    execute(dispatch: RuntimeDispatch, signal: AbortSignal, context?: RuntimeExecutionContext): Promise<RuntimeExecutionResult>;
    cancel(sessionId: string, signal: AbortSignal): Promise<boolean>;
    private stop;
    private requestJson;
    private url;
}
//# sourceMappingURL=hermesd-runtime.d.ts.map