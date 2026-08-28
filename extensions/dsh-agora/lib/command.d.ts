import type { AgoraCommandResult, AgoraRequestContext, CreateAgoraTaskInput, DshAgoraServiceApi, CoordinationMode } from './contracts.js';
export type AgoraCommand = {
    readonly kind: 'help';
} | {
    readonly kind: 'health';
} | {
    readonly kind: 'nodes' | 'agents';
} | {
    readonly kind: 'dashboard';
} | {
    readonly kind: 'im';
} | {
    readonly kind: 'list';
    readonly state?: string;
    readonly projectId?: string;
} | {
    readonly kind: 'show';
    readonly taskId: string;
} | {
    readonly kind: 'status';
    readonly taskId: string;
} | {
    readonly kind: 'dispatch-status';
    readonly dispatchId: string;
} | {
    readonly kind: 'runs';
} | {
    readonly kind: 'run-status';
    readonly runId: string;
} | {
    readonly kind: 'scorecards';
    readonly taskType?: string;
} | {
    readonly kind: 'run';
    readonly input: {
        readonly mode: CoordinationMode;
        readonly runtimeTargets: readonly string[];
        readonly prompt: string;
        readonly taskType: string;
        readonly maxAgents?: number;
        readonly maxDispatches?: number;
        readonly maxSeconds?: number;
    };
} | {
    readonly kind: 'create';
    readonly input: CreateAgoraTaskInput;
};
export declare class AgoraCommandParseError extends Error {
    constructor(message: string);
}
export declare function parseAgoraCommand(rawInput: string): AgoraCommand;
export declare function executeAgoraCommand(service: DshAgoraServiceApi, rawInput: string, context?: AgoraRequestContext, signal?: AbortSignal): Promise<AgoraCommandResult>;
//# sourceMappingURL=command.d.ts.map