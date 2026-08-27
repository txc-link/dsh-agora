import type { RuntimeDispatch, RuntimeNodeAgent } from './contracts.js';
import { type DshAgoraRuntimeAdapterV1, type RuntimeExecutionResult } from './extension-sdk.js';
export interface ConfiguredDshAgent {
    readonly id: string;
    readonly displayName?: string;
    readonly preset?: string;
    readonly model?: string;
    readonly workspace?: string;
    readonly workspaceAlias?: string;
    readonly roles?: readonly string[];
    readonly capabilities?: readonly string[];
}
export interface HarnessRuntimeOptions {
    readonly baseUrl: string;
    readonly agents: readonly ConfiguredDshAgent[];
    readonly replyTimeoutMs?: number;
    readonly fetch?: typeof globalThis.fetch;
}
export declare class HarnessRuntimeAdapter implements DshAgoraRuntimeAdapterV1 {
    readonly protocol: "dsh-agora.runtime/v1";
    private readonly client;
    private readonly agents;
    private readonly replyTimeoutMs;
    constructor(options: HarnessRuntimeOptions);
    describeAgents(): readonly RuntimeNodeAgent[];
    execute(dispatch: RuntimeDispatch, signal: AbortSignal): Promise<RuntimeExecutionResult>;
    cancel(sessionId: string, signal: AbortSignal): Promise<boolean>;
}
//# sourceMappingURL=harness-runtime.d.ts.map