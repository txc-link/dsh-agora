import type { AgoraCommandResult, AgoraRequestContext, DshAgoraImStatus } from './contracts.js';
export declare const DSH_IM_COMMAND_GATEWAY_PROTOCOL = "dsh-im.command-gateway/v1";
export interface DshImCommandInvocationV1 extends AgoraRequestContext {
    readonly rawInput: string;
    readonly signal?: AbortSignal;
}
export interface DshImCommandDefinitionV1 {
    readonly name: string;
    readonly description: string;
    execute(invocation: DshImCommandInvocationV1): Promise<AgoraCommandResult>;
}
export interface DshImCommandGatewayV1 {
    readonly protocol: typeof DSH_IM_COMMAND_GATEWAY_PROTOCOL;
    registerCommand(definition: DshImCommandDefinitionV1): () => void;
}
export interface ImGatewayContext {
    get?(name: string): unknown;
}
export interface ImRegistration {
    readonly status: DshAgoraImStatus;
    readonly dispose?: () => void;
}
export declare function registerImCommand(ctx: ImGatewayContext, serviceNames: readonly string[], definition: DshImCommandDefinitionV1): ImRegistration;
//# sourceMappingURL=im-gateway.d.ts.map