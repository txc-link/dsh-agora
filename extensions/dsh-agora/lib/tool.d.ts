import type { DshAgoraServiceApi, TaskPriority } from './contracts.js';
export interface DshToolRunContext {
    readonly signal: AbortSignal;
    readonly agent?: {
        readonly id?: string;
    };
}
export interface DshToolDefinition {
    readonly name: string;
    readonly description: string;
    readonly parameters: Record<string, unknown>;
    readonly output: {
        readonly schema: Record<string, unknown>;
        render(args: unknown, value: unknown): Array<{
            readonly type: 'text';
            readonly text: string;
        }>;
    };
    execute(args: unknown, exec: DshToolRunContext): Promise<unknown>;
    presentCall?(args: unknown): {
        readonly card: 'generic';
        readonly title: string;
        readonly kind?: 'read' | 'execute';
    };
}
export interface DshToolRegistry {
    register(definition: DshToolDefinition): () => void;
}
type AgoraToolArgs = {
    readonly action: 'health';
} | {
    readonly action: 'nodes' | 'agents';
} | {
    readonly action: 'list';
    readonly state?: string;
    readonly project_id?: string;
} | {
    readonly action: 'show' | 'status';
    readonly task_id: string;
} | {
    readonly action: 'dispatch_status';
    readonly dispatch_id: string;
} | {
    readonly action: 'attach_session';
    readonly task_id: string;
    readonly participant_binding_id: string;
    readonly session_id: string;
    readonly runtime_target_ref?: string;
} | {
    readonly action: 'dispatch';
    readonly runtime_target_ref: string;
    readonly prompt: string;
    readonly task_id?: string;
    readonly participant_binding_id?: string;
    readonly session_id?: string;
    readonly workspace_alias?: string;
    readonly agent_preset?: string;
    readonly idempotency_key?: string;
    readonly wait_seconds?: number;
    readonly presentation_mode?: 'source_bot' | 'destination_bot' | 'silent';
} | {
    readonly action: 'create';
    readonly title: string;
    readonly task_type?: string;
    readonly description?: string;
    readonly priority?: TaskPriority;
    readonly project_id?: string;
};
export declare function createAgoraTool(service: DshAgoraServiceApi): DshToolDefinition;
export declare function parseToolArgs(value: unknown): AgoraToolArgs;
export {};
//# sourceMappingURL=tool.d.ts.map