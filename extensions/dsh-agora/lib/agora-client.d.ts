import type { AgoraHealth, AgoraTask, AgoraTaskStatus, CreateAgoraTaskInput, CreateRuntimeDispatchInput, RuntimeDispatch, RuntimeNode, RuntimeNodeHeartbeatInput, RuntimeSessionBinding, RuntimeTarget } from './contracts.js';
export interface AgoraClientOptions {
    readonly serverUrl: string;
    readonly apiToken?: string | undefined;
    readonly timeoutMs?: number | undefined;
    readonly fetch?: typeof globalThis.fetch | undefined;
}
export declare class AgoraApiError extends Error {
    readonly status: number;
    readonly path: string;
    readonly detail: unknown;
    constructor(message: string, status: number, path: string, detail: unknown);
}
export declare class AgoraClient {
    readonly serverUrl: string;
    private readonly apiToken;
    private readonly timeoutMs;
    private readonly fetchImpl;
    constructor(options: AgoraClientOptions);
    health(signal?: AbortSignal): Promise<AgoraHealth>;
    listTasks(state?: string, projectId?: string, signal?: AbortSignal): Promise<AgoraTask[]>;
    getTask(taskId: string, signal?: AbortSignal): Promise<AgoraTask>;
    taskStatus(taskId: string, signal?: AbortSignal): Promise<AgoraTaskStatus>;
    createTask(input: CreateAgoraTaskInput, signal?: AbortSignal): Promise<AgoraTask>;
    heartbeatRuntimeNode(nodeId: string, input: RuntimeNodeHeartbeatInput, signal?: AbortSignal): Promise<RuntimeNode>;
    listRuntimeNodes(signal?: AbortSignal): Promise<RuntimeNode[]>;
    listRuntimeTargets(signal?: AbortSignal): Promise<RuntimeTarget[]>;
    createRuntimeDispatch(nodeId: string, input: CreateRuntimeDispatchInput, signal?: AbortSignal): Promise<RuntimeDispatch>;
    getRuntimeDispatch(dispatchId: string, signal?: AbortSignal): Promise<RuntimeDispatch>;
    claimRuntimeDispatch(nodeId: string, instanceId: string, leaseSeconds: number, signal?: AbortSignal): Promise<RuntimeDispatch | null>;
    completeRuntimeDispatch(nodeId: string, dispatchId: string, input: {
        readonly instance_id: string;
        readonly status: 'completed' | 'failed';
        readonly session_id?: string | null;
        readonly result?: Readonly<Record<string, unknown>> | null;
        readonly error?: string | null;
    }, signal?: AbortSignal): Promise<RuntimeDispatch>;
    bindRuntimeSession(taskId: string, participantBindingId: string, sessionId: string, agentRef?: string, signal?: AbortSignal): Promise<RuntimeSessionBinding>;
    request<T>(path: string, options?: {
        readonly method?: string | undefined;
        readonly body?: unknown;
        readonly signal?: AbortSignal | undefined;
    }): Promise<T>;
}
//# sourceMappingURL=agora-client.d.ts.map