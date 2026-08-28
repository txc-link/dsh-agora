import type { AgoraCommandResult, AgoraRequestContext } from './contracts.js';
import type { DshImBridgeV1 } from './im-bridge-v1.js';
export declare const DSH_AGORA_COMMAND_ADAPTER_PROTOCOL: "dsh-agora.command-adapter/v1";
export interface DshAgoraCommandEventV1 {
    readonly protocol: typeof DSH_AGORA_COMMAND_ADAPTER_PROTOCOL;
    readonly idempotency_key: string;
    readonly input: string;
    readonly actor_ref: string;
    readonly provider?: string | null;
    readonly conversation_ref?: string | null;
    readonly thread_ref?: string | null;
    readonly reply?: {
        readonly enabled: boolean;
        readonly bot_ref?: string | null;
    } | null;
    readonly metadata?: Readonly<Record<string, unknown>> | null;
}
export interface DshAgoraCommandEventResultV1 {
    readonly protocol: typeof DSH_AGORA_COMMAND_ADAPTER_PROTOCOL;
    readonly idempotency_key: string;
    readonly result: AgoraCommandResult;
    readonly delivery: {
        readonly sent: boolean;
        readonly provider_message_refs: readonly string[];
        readonly reason?: string;
    };
}
export interface DshAgoraCommandAdapterV1 {
    readonly protocol: typeof DSH_AGORA_COMMAND_ADAPTER_PROTOCOL;
    ingest(event: DshAgoraCommandEventV1, signal?: AbortSignal): Promise<DshAgoraCommandEventResultV1>;
}
export declare class DshAgoraCommandAdapter implements DshAgoraCommandAdapterV1 {
    private readonly options;
    readonly protocol: "dsh-agora.command-adapter/v1";
    private readonly receipts;
    constructor(options: {
        execute(input: string, context: AgoraRequestContext, signal?: AbortSignal): Promise<AgoraCommandResult>;
        bridge(): DshImBridgeV1 | null;
        receiptLimit?: number;
    });
    ingest(event: DshAgoraCommandEventV1, signal?: AbortSignal): Promise<DshAgoraCommandEventResultV1>;
    private execute;
}
//# sourceMappingURL=command-adapter.d.ts.map