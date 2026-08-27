import type { DshAgoraImStatus, RuntimeNodeBot } from './contracts.js';
export declare const DSH_IM_BRIDGE_PROTOCOL: "dsh-im.bridge/v1";
export interface DshImSessionRouteV1 {
    readonly provider: string;
    readonly bot_ref: string;
    readonly session_id: string;
    readonly actor_ref: string;
    readonly conversation_ref: string;
    readonly thread_ref: string | null;
    readonly reply_to_message_ref: string | null;
    readonly updated_at: string;
}
export interface DshImSendRequestV1 {
    readonly provider: string;
    readonly bot_ref?: string | null;
    readonly conversation_ref: string;
    readonly thread_ref?: string | null;
    readonly reply_to_message_ref?: string | null;
    readonly text: string;
    readonly idempotency_key: string;
}
export interface DshImBridgeV1 {
    readonly protocol: typeof DSH_IM_BRIDGE_PROTOCOL;
    listBots(): readonly RuntimeNodeBot[] | Promise<readonly RuntimeNodeBot[]>;
    resolveSession(sessionId: string): DshImSessionRouteV1 | null | Promise<DshImSessionRouteV1 | null>;
    send(request: DshImSendRequestV1): Promise<{
        readonly provider_message_refs: readonly string[];
    }>;
}
export interface ImBridgeDiscovery {
    readonly status: DshAgoraImStatus;
    readonly bridge: DshImBridgeV1 | null;
}
export declare function discoverImBridge(ctx: {
    get?(name: string): unknown;
}, serviceNames: readonly string[]): ImBridgeDiscovery;
//# sourceMappingURL=im-bridge-v1.d.ts.map