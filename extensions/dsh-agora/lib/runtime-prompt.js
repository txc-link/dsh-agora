import { formatResourceBindingContext } from './resource-registry.js';
export function formatExternalRuntimePrompt(dispatch) {
    return [
        'Authoritative Agora runtime context:',
        `- Runtime node: ${dispatch.node_id}`,
        `- Runtime target: ${dispatch.runtime_target_ref}`,
        `- Dispatch: ${dispatch.id}`,
        `- Task: ${dispatch.task_id ?? '(none)'}`,
        `- Workspace alias: ${dispatch.workspace_alias ?? '(none)'}`,
        '- Treat these identifiers as authoritative; do not infer or replace them.',
        ...formatResourceBindingContext(dispatch),
        '',
        'Execution contract:',
        '- Preserve the Task below as the user task. Execute it first; do not rewrite it as a dispatch audit, identity check, or hypothetical plan.',
        '- Use the tools and data sources already available on this runtime. A configured resource binding above is authoritative for the named resource.',
        '- A verification reply must report the actual actions taken, the evidence found (source/path/result), what was safely written, and any remaining blocker. Do not claim completion without evidence.',
        '- For credential-bearing requests, never expose or persist passwords, private keys, or access tokens. Continue with safe machine metadata such as role, host, port, account, and a credential reference, and state the redaction explicitly.',
        '- If the user asks to use a password, use only an approved credential handle/tool for the operation; if no such tool is available, report that blocker instead of printing the secret.',
        '- Return a concise Markdown document for structured results; use plain text only for a short conversational reply. Do not wrap the whole Markdown document in a triple-backtick fence unless the user asks for source.',
        '',
        dispatch.prompt,
    ].join('\n');
}
//# sourceMappingURL=runtime-prompt.js.map