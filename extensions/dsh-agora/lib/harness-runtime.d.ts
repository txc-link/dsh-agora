import type { RuntimeDispatch, RuntimeNodeAgent } from './contracts.js';
import { type DshAgoraRuntimeAdapterV1, type RuntimeExecutionResult, type RuntimeExecutionContext } from './extension-sdk.js';
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
    /**
     * Resolves the in-process dsh web launch URL. dsh web authenticates `/api`
     * with a cookie minted from a per-process launch token, so only a caller
     * inside that process can supply it.
     */
    readonly launchUrl?: (baseUrl: string) => string | undefined;
    /** Test seam for the Remote stream socket; defaults to the global WebSocket. */
    readonly socketFactory?: WebSocketFactory;
}
export declare class HarnessRuntimeAdapter implements DshAgoraRuntimeAdapterV1 {
    readonly protocol: "dsh-agora.runtime/v1";
    private readonly client;
    private readonly agents;
    private readonly replyTimeoutMs;
    constructor(options: HarnessRuntimeOptions);
    describeAgents(): readonly RuntimeNodeAgent[];
    execute(dispatch: RuntimeDispatch, signal: AbortSignal, context?: RuntimeExecutionContext): Promise<RuntimeExecutionResult>;
    cancel(sessionId: string, signal: AbortSignal): Promise<boolean>;
}
/** Structural view of the WebSocket API the Remote stream mux needs. */
interface DshSocketEvent {
    readonly data?: unknown;
}
interface DshSocket {
    send(data: string): void;
    close(code?: number, reason?: string): void;
    addEventListener(type: string, listener: (event: DshSocketEvent) => void): void;
}
type WebSocketFactory = (url: string, options: {
    headers: Record<string, string>;
}) => DshSocket;
export {};
//# sourceMappingURL=harness-runtime.d.ts.map