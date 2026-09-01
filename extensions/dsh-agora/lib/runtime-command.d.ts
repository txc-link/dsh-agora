export interface RuntimeCommandRequest {
    readonly command: string;
    readonly args: readonly string[];
    readonly input?: string;
    readonly cwd?: string;
    readonly env?: Readonly<Record<string, string>>;
    readonly signal: AbortSignal;
}
export interface RuntimeCommandResult {
    readonly exitCode: number | null;
    readonly stdout: string;
    readonly stderr: string;
}
export type RuntimeCommandRunner = (request: RuntimeCommandRequest) => Promise<RuntimeCommandResult>;
export declare const runRuntimeCommand: RuntimeCommandRunner;
//# sourceMappingURL=runtime-command.d.ts.map