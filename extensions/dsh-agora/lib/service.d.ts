import { AgoraClient } from './agora-client.js';
import type { AgoraCommandResult, AgoraHealth, AgoraRequestContext, AgoraTask, AgoraTaskStatus, CreateAgoraTaskInput, CreateRuntimeDispatchInput, DispatchAgentInput, DshAgoraImStatus, DshAgoraServiceApi, DshAgoraSnapshot, DshAgoraNodeStatus, RuntimeDispatch, RuntimeDispatchProgress, RuntimeNode, RuntimeSessionBinding, RuntimeTarget } from './contracts.js';
import type { DshAgoraExtensionV1 } from './extension-sdk.js';
import { DshAgoraExtensionRegistry } from './extension-sdk.js';
import type { DshImBridgeV1 } from './im-bridge-v1.js';
export interface DshAgoraServiceOptions {
    readonly client: AgoraClient;
    readonly commandName: string;
    readonly defaultCreator: string;
    readonly registry?: DshAgoraExtensionRegistry;
    readonly imBridge?: DshImBridgeV1 | null;
    readonly nodeId?: string;
}
export declare class DshAgoraService implements DshAgoraServiceApi {
    private readonly options;
    readonly registry: DshAgoraExtensionRegistry;
    private imStatus;
    private imBridgeStatus;
    private imBridge;
    private nodeStatus;
    constructor(options: DshAgoraServiceOptions);
    get serverUrl(): string;
    health(signal?: AbortSignal): Promise<AgoraHealth>;
    listTasks(state?: string, projectId?: string, signal?: AbortSignal): Promise<AgoraTask[]>;
    getTask(taskId: string, signal?: AbortSignal): Promise<AgoraTask>;
    taskStatus(taskId: string, signal?: AbortSignal): Promise<AgoraTaskStatus>;
    createTask(input: CreateAgoraTaskInput, signal?: AbortSignal): Promise<AgoraTask>;
    listRuntimeNodes(signal?: AbortSignal): Promise<RuntimeNode[]>;
    listRuntimeTargets(signal?: AbortSignal): Promise<RuntimeTarget[]>;
    createRuntimeDispatch(nodeId: string, input: CreateRuntimeDispatchInput, signal?: AbortSignal): Promise<RuntimeDispatch>;
    getRuntimeDispatch(dispatchId: string, signal?: AbortSignal): Promise<RuntimeDispatch>;
    listRuntimeDispatchProgress(dispatchId: string, signal?: AbortSignal): Promise<RuntimeDispatchProgress[]>;
    dispatchAgent(input: DispatchAgentInput, signal?: AbortSignal): Promise<RuntimeDispatch>;
    bindRuntimeSession(taskId: string, participantBindingId: string, sessionId: string, agentRef?: string, signal?: AbortSignal): Promise<RuntimeSessionBinding>;
    registerExtension(extension: DshAgoraExtensionV1): () => void;
    listExtensions(): readonly DshAgoraExtensionV1[];
    executeCommand(rawInput: string, context?: AgoraRequestContext, signal?: AbortSignal): Promise<AgoraCommandResult>;
    snapshot(): DshAgoraSnapshot;
    setImStatus(status: DshAgoraImStatus): void;
    setImBridgeStatus(status: DshAgoraImStatus): void;
    setImBridge(bridge: DshImBridgeV1 | null, status: DshAgoraImStatus): void;
    setNodeStatus(status: DshAgoraNodeStatus): void;
}
//# sourceMappingURL=service.d.ts.map