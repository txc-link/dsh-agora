import { DSH_AGORA_RUNTIME_PROTOCOL } from './extension-sdk.js';
import { formatExternalRuntimePrompt } from './runtime-prompt.js';
import { runRuntimeCommand } from './runtime-command.js';
export class OpenClawRuntimeAdapter {
    options;
    protocol = DSH_AGORA_RUNTIME_PROTOCOL;
    agents;
    runner;
    active = new Map();
    constructor(options) {
        this.options = options;
        this.agents = normalizeAgents(options.agents);
        this.runner = options.runCommand ?? runRuntimeCommand;
    }
    supportsTarget(runtimeTargetRef) {
        const ref = agentRef(runtimeTargetRef);
        return ref?.startsWith('openclaw/') === true && this.agents.some(agent => `openclaw/${agent.id}` === ref);
    }
    describeAgents() {
        return this.agents.map(agent => ({
            agent_ref: `openclaw/${agent.id}`,
            display_name: agent.displayName,
            preset: null,
            model: agent.model,
            workspace_alias: null,
            roles: agent.roles,
            capabilities: agent.capabilities,
        }));
    }
    async execute(dispatch, signal, context) {
        const ref = agentRef(dispatch.runtime_target_ref);
        const id = ref?.startsWith('openclaw/') ? ref.slice('openclaw/'.length) : '';
        const agent = this.agents.find(candidate => candidate.id === id);
        if (!agent)
            throw new Error(`OpenClaw target ${dispatch.runtime_target_ref} is not configured on this node`);
        const startedAt = Date.now();
        const localAbort = new AbortController();
        const timeout = AbortSignal.timeout(normalizeTimeout(this.options.timeoutMs));
        const executionSignal = AbortSignal.any([signal, localAbort.signal, timeout]);
        const stableSessionKey = dispatch.session_id ?? `agora:${dispatch.node_id}:${dispatch.task_id ?? dispatch.id}:openclaw:${agent.id}`;
        this.active.set(stableSessionKey, localAbort);
        await context?.reportProgress({ phase: 'runtime_started', message: `OpenClaw agent ${agent.id} started`, percent: 15 });
        try {
            const args = ['agent', '--agent', agent.id, '--message-file', '-', '--json'];
            if (dispatch.session_id)
                args.push('--session-id', dispatch.session_id);
            else
                args.push('--session-key', stableSessionKey);
            if (agent.model)
                args.push('--model', agent.model);
            args.push('--timeout', String(Math.max(1, Math.ceil(normalizeTimeout(this.options.timeoutMs) / 1_000))));
            const result = await this.runner({
                command: this.options.binary?.trim() || 'openclaw',
                args,
                input: formatExternalRuntimePrompt(dispatch),
                ...(agent.workspace === null ? {} : { cwd: agent.workspace }),
                ...(this.options.env === undefined ? {} : { env: this.options.env }),
                signal: executionSignal,
            });
            const parsed = parseOpenClawResult(result.stdout);
            if (result.exitCode !== 0 || parsed.ok === false || parsed.status === 'error' || parsed.status === 'timeout') {
                throw new Error(openClawError(parsed, result.stderr, result.exitCode));
            }
            const answer = answerFromOpenClaw(parsed);
            const sessionId = stringValue(parsed.sessionId)
                ?? stringValue(record(parsed.meta)?.sessionId)
                ?? stringValue(record(record(parsed.meta)?.agentMeta)?.sessionId)
                ?? stableSessionKey;
            const usage = openClawUsage(parsed, Date.now() - startedAt);
            await context?.reportProgress({ phase: 'response_completed', message: 'OpenClaw response completed', percent: 90 });
            return {
                sessionId,
                answer,
                metadata: { runtime_provider: 'openclaw', agent_ref: agent.id, dispatch_id: dispatch.id },
                resultEnvelope: {
                    schema: 'agora.runtime-result/v1', answer, claims: [], evidence: [], usage,
                    environment: {
                        runtime_provider: 'openclaw', agent_ref: agent.id, model: stringValue(parsed.model) ?? agent.model,
                        workspace_alias: dispatch.workspace_alias ?? null,
                        metadata: { node_id: dispatch.node_id, runtime_target_ref: dispatch.runtime_target_ref, dispatch_id: dispatch.id },
                    },
                },
            };
        }
        finally {
            this.active.delete(stableSessionKey);
        }
    }
    async cancel(sessionId, _signal) {
        const controller = this.active.get(sessionId);
        if (!controller)
            return false;
        controller.abort(new DOMException('OpenClaw run cancelled by Agora', 'AbortError'));
        return true;
    }
}
function normalizeAgents(agents) {
    const seen = new Set();
    return agents.map(agent => {
        const id = required(agent.id, 'OpenClaw agent id');
        if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(id))
            throw new TypeError(`invalid OpenClaw agent id ${id}`);
        if (seen.has(id))
            throw new TypeError(`duplicate OpenClaw agent id ${id}`);
        seen.add(id);
        return {
            id,
            displayName: optional(agent.displayName),
            workspace: optional(agent.workspace),
            model: optional(agent.model),
            roles: unique(agent.roles ?? []),
            capabilities: unique(agent.capabilities ?? ['runtime.execute', 'session.resume']),
        };
    }).sort((left, right) => left.id.localeCompare(right.id));
}
function parseOpenClawResult(stdout) {
    try {
        const parsed = JSON.parse(stdout.trim());
        const normalized = record(parsed);
        if (!normalized)
            throw new Error('response is not an object');
        return normalized;
    }
    catch (error) {
        throw new Error(`OpenClaw returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
}
function answerFromOpenClaw(parsed) {
    const direct = stringValue(parsed.final) ?? stringValue(parsed.answer);
    if (direct)
        return direct;
    const payloads = Array.isArray(parsed.payloads) ? parsed.payloads : [];
    const texts = payloads.map(item => stringValue(record(item)?.text)).filter((value) => value !== null);
    if (texts.length)
        return texts.join('\n');
    throw new Error('OpenClaw completed without a final answer');
}
function openClawUsage(parsed, durationMs) {
    const usage = record(parsed.usage) ?? record(record(record(parsed.meta)?.agentMeta)?.usage);
    return {
        input_tokens: numberValue(usage?.input ?? usage?.input_tokens),
        output_tokens: numberValue(usage?.output ?? usage?.output_tokens),
        total_tokens: numberValue(usage?.total ?? usage?.total_tokens),
        tool_calls: numberValue(record(parsed.toolSummary)?.calls ?? record(record(parsed.meta)?.toolSummary)?.calls),
        cost_usd: numberValue(parsed.costUsd ?? record(parsed.meta)?.costUsd),
        duration_ms: durationMs,
    };
}
function openClawError(parsed, stderr, exitCode) {
    return stringValue(record(parsed.error)?.message) ?? stringValue(parsed.error) ?? (stderr.trim() || `OpenClaw exited with code ${exitCode ?? 'unknown'}`);
}
function agentRef(target) { return target.split(':').at(-1)?.trim() || null; }
function normalizeTimeout(value) { return Number.isSafeInteger(value) && (value ?? 0) >= 1_000 ? value : 600_000; }
function unique(values) { return [...new Set(values.map(value => value.trim()).filter(Boolean))].sort(); }
function optional(value) { return value?.trim() || null; }
function required(value, label) { const normalized = value.trim(); if (!normalized)
    throw new TypeError(`${label} is required`); return normalized; }
function record(value) { return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : null; }
function stringValue(value) { return typeof value === 'string' && value.trim() ? value.trim() : null; }
function numberValue(value) { return typeof value === 'number' && Number.isFinite(value) ? value : null; }
//# sourceMappingURL=openclaw-runtime.js.map