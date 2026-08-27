import type { DshAgoraContext } from './context-types.js';
import { type ConfiguredDshAgent } from './harness-runtime.js';
export { AgoraApiError, AgoraClient } from './agora-client.js';
export { AgoraCommandParseError, executeAgoraCommand, parseAgoraCommand } from './command.js';
export * from './contracts.js';
export { API_PREFIX, handleHttpRequest, registerHttpApi } from './http-api.js';
export * from './im-gateway.js';
export * from './im-bridge-v1.js';
export * from './extension-sdk.js';
export * from './harness-runtime.js';
export { RuntimeNodeWorker } from './node-worker.js';
export { DshAgoraService } from './service.js';
export * from './tool.js';
export declare const name = "dsh-agora";
export declare const inject: string[];
export interface Config {
    readonly serverUrl?: string;
    readonly apiToken?: string;
    readonly requestTimeoutMs?: number;
    readonly defaultCreator?: string;
    readonly commandName?: string;
    readonly apiAccessToken?: string;
    readonly imGatewayServices?: readonly string[];
    readonly imBridgeServices?: readonly string[];
    readonly nodeEnabled?: boolean;
    readonly nodeId?: string;
    readonly heartbeatIntervalMs?: number;
    readonly dispatchPollIntervalMs?: number;
    readonly nodeLeaseSeconds?: number;
    readonly dispatchLeaseSeconds?: number;
    readonly maxConcurrent?: number;
    readonly runtimeReplyTimeoutMs?: number;
    readonly runtimeAgents?: readonly ConfiguredDshAgent[];
    readonly nodeMetadata?: Readonly<Record<string, unknown>>;
}
export declare function apply(ctx: DshAgoraContext, config?: Config): void;
//# sourceMappingURL=index.d.ts.map