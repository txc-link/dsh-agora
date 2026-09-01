export function formatExternalRuntimePrompt(dispatch) {
    return [
        'Authoritative Agora runtime context:',
        `- Runtime node: ${dispatch.node_id}`,
        `- Runtime target: ${dispatch.runtime_target_ref}`,
        `- Dispatch: ${dispatch.id}`,
        `- Task: ${dispatch.task_id ?? '(none)'}`,
        `- Workspace alias: ${dispatch.workspace_alias ?? '(none)'}`,
        '- Treat these identifiers as authoritative; do not infer or replace them.',
        '',
        dispatch.prompt,
    ].join('\n');
}
//# sourceMappingURL=runtime-prompt.js.map