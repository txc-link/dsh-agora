import { type AgoraClient } from './agora-client.js';
import { type DshAgoraNodeStatus } from './contracts.js';
import type { DshAgoraExtensionRegistry } from './extension-sdk.js';
import type { DshImBridgeV1 } from './im-bridge-v1.js';
export interface RuntimeNodeWorkerOptions {
    readonly client: AgoraClient;
    readonly registry: DshAgoraExtensionRegistry;
    readonly nodeId: string;
    readonly instanceId: string;
    readonly pluginVersion: string;
    readonly heartbeatIntervalMs?: number;
    readonly dispatchPollIntervalMs?: number;
    readonly leaseSeconds?: number;
    readonly dispatchLeaseSeconds?: number;
    readonly dispatchRenewIntervalMs?: number;
    readonly deliveryPollIntervalMs?: number;
    readonly deliveryLeaseSeconds?: number;
    readonly maxConcurrent?: number;
    readonly imBridge?: DshImBridgeV1 | null;
    readonly metadata?: Readonly<Record<string, unknown>>;
    onStatus?(status: DshAgoraNodeStatus): void;
}
export declare class RuntimeNodeWorker {
    private readonly options;
    private readonly abortController;
    private heartbeatTimer;
    private dispatchTimer;
    private deliveryTimer;
    private active;
    private started;
    private ready;
    private dispatchRunning;
    private deliveryRunning;
    private imBridge;
    constructor(options: RuntimeNodeWorkerOptions);
    setImBridge(bridge: DshImBridgeV1 | null): void;
    start(): void;
    stop(): void;
    private heartbeatLoop;
    private dispatchLoop;
    private execute;
    private deliveryLoop;
    private renewLease;
    private fail;
    private presentationPayload;
    private deliver;
    private listBots;
    private setStatus;
    private get leaseSeconds();
    private get maxConcurrent();
    private get dispatchLeaseSeconds();
    private get dispatchRenewIntervalMs();
    private get deliveryLeaseSeconds();
}
//# sourceMappingURL=node-worker.d.ts.map