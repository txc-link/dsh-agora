import type { RuntimeDispatch, RuntimeNodeAgent } from './contracts.js';
import { type DshAgoraRuntimeAdapterV1, type RuntimeExecutionContext, type RuntimeExecutionResult } from './extension-sdk.js';
import { type RuntimeCommandRunner } from './runtime-command.js';
export interface ConfiguredOpenClawAgent {
    readonly id: string;
    readonly displayName?: string;
    readonly workspace?: string;
    readonly model?: string;
    readonly roles?: readonly string[];
    readonly capabilities?: readonly string[];
}
export interface OpenClawRuntimeOptions {
    readonly agents: readonly ConfiguredOpenClawAgent[];
    readonly binary?: string;
    readonly timeoutMs?: number;
    readonly env?: Readonly<Record<string, string>>;
    readonly runCommand?: RuntimeCommandRunner;
}
export declare class OpenClawRuntimeAdapter implements DshAgoraRuntimeAdapterV1 {
    private readonly options;
    readonly protocol: "dsh-agora.runtime/v1";
    private readonly agents;
    private readonly runner;
    private readonly active;
    constructor(options: OpenClawRuntimeOptions);
    supportsTarget(runtimeTargetRef: string): boolean;
    describeAgents(): readonly RuntimeNodeAgent[];
    execute(dispatch: RuntimeDispatch, signal: AbortSignal, context?: RuntimeExecutionContext): Promise<RuntimeExecutionResult>;
    cancel(sessionId: string, _signal: AbortSignal): Promise<boolean>;
}
//# sourceMappingURL=openclaw-runtime.d.ts.map