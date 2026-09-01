import { createHash } from 'node:crypto';
import { DSH_AGORA_RUNTIME_PROTOCOL } from './extension-sdk.js';
import { formatExternalRuntimePrompt } from './runtime-prompt.js';
export class HermesdRuntimeAdapter {
    options;
    protocol = DSH_AGORA_RUNTIME_PROTOCOL;
    origin;
    fetchImpl;
    profiles;
    active = new Map();
    constructor(options) {
        this.options = options;
        this.origin = new URL(options.baseUrl);
        this.fetchImpl = options.fetch ?? globalThis.fetch;
        this.profiles = normalizeProfiles(options.profiles);
    }
    supportsTarget(runtimeTargetRef) {
        const parsed = parseTarget(runtimeTargetRef);
        return parsed !== null && this.profiles.some(profile => profile.id === parsed.id);
    }
    describeAgents() {
        return this.profiles.map(profile => ({
            agent_ref: `hermes/${profile.id}`,
            display_name: profile.displayName,
            preset: profile.serverProfile,
            model: null,
            workspace_alias: null,
            roles: profile.roles,
            capabilities: profile.capabilities,
        }));
    }
    async execute(dispatch, signal, context) {
        const target = parseTarget(dispatch.runtime_target_ref);
        const profile = target ? this.profiles.find(candidate => candidate.id === target.id) : undefined;
        if (!profile)
            throw new Error(`Hermes target ${dispatch.runtime_target_ref} is not configured on this node`);
        const startedAt = Date.now();
        const timeout = AbortSignal.timeout(normalizeTimeout(this.options.timeoutMs));
        const executionSignal = AbortSignal.any([signal, timeout]);
        const requestedSessionId = dispatch.session_id ?? `agora:${dispatch.node_id}:${dispatch.task_id ?? dispatch.id}:hermes:${profile.id}`;
        let runId = null;
        try {
            await context?.reportProgress({ phase: 'runtime_started', message: `Hermes profile ${profile.id} started`, percent: 15 });
            const created = await this.requestJson(profile, '/v1/runs', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'idempotency-key': hermesIdempotencyKey(dispatch.idempotency_key),
                },
                body: JSON.stringify({
                    input: formatExternalRuntimePrompt(dispatch),
                    session_id: requestedSessionId,
                }),
                signal: executionSignal,
            });
            runId = required(created.run_id ?? '', 'Hermes run_id');
            this.active.set(requestedSessionId, { runId, profile });
            let lastStatus = '';
            while (true) {
                const status = await this.requestJson(profile, `/v1/runs/${encodeURIComponent(runId)}`, {
                    method: 'GET', signal: executionSignal,
                });
                const state = status.status?.trim().toLowerCase() || 'unknown';
                if (state !== lastStatus) {
                    lastStatus = state;
                    await context?.reportProgress({ phase: `hermes_${state}`, message: `Hermes run ${state}`, percent: hermesPercent(state), details: { run_id: runId } });
                }
                if (state === 'completed') {
                    const answer = required(status.output ?? '', 'Hermes run output');
                    const sessionId = status.session_id?.trim() || requestedSessionId;
                    const usage = hermesUsage(status.usage, Date.now() - startedAt);
                    return {
                        sessionId,
                        answer,
                        metadata: { runtime_provider: 'hermes', profile: profile.id, run_id: runId, dispatch_id: dispatch.id },
                        resultEnvelope: {
                            schema: 'agora.runtime-result/v1', answer, claims: [], evidence: [], usage,
                            environment: {
                                runtime_provider: 'hermes', agent_ref: profile.id, model: status.model?.trim() || null,
                                workspace_alias: dispatch.workspace_alias ?? null,
                                metadata: { node_id: dispatch.node_id, runtime_target_ref: dispatch.runtime_target_ref, dispatch_id: dispatch.id, run_id: runId },
                            },
                        },
                    };
                }
                if (state === 'failed' || state === 'cancelled' || state === 'canceled') {
                    throw new Error(`Hermes run ${state}: ${errorMessage(status.error) ?? 'no error detail'}`);
                }
                if (state === 'requires_action' || state === 'waiting_for_approval') {
                    throw new Error('Hermes run requires human approval; approval bridging into the Agora Human Gate is not configured');
                }
                await sleep(normalizePollInterval(this.options.pollIntervalMs), executionSignal);
            }
        }
        catch (error) {
            if (executionSignal.aborted && runId) {
                try {
                    await this.stop(profile, runId, AbortSignal.timeout(10_000));
                }
                catch { /* Preserve original timeout/cancellation. */ }
            }
            throw error;
        }
        finally {
            this.active.delete(requestedSessionId);
        }
    }
    async cancel(sessionId, signal) {
        const active = this.active.get(sessionId);
        if (!active)
            return false;
        await this.stop(active.profile, active.runId, signal);
        return true;
    }
    async stop(profile, runId, signal) {
        await this.requestJson(profile, `/v1/runs/${encodeURIComponent(runId)}/stop`, { method: 'POST', signal });
    }
    async requestJson(profile, path, init) {
        const response = await this.fetchImpl(this.url(profile, path), {
            ...init,
            headers: {
                accept: 'application/json',
                ...(this.options.apiKey?.trim() ? { authorization: `Bearer ${this.options.apiKey.trim()}` } : {}),
                ...init.headers,
            },
        });
        if (!response.ok)
            throw new Error(`Hermes returned HTTP ${response.status} for ${init.method ?? 'GET'} ${path}`);
        return await response.json();
    }
    url(profile, path) {
        const prefix = profile.serverProfile ? `/p/${encodeURIComponent(profile.serverProfile)}` : '';
        return new URL(`${prefix}${path}`, this.origin);
    }
}
function normalizeProfiles(profiles) {
    const seen = new Set();
    return profiles.map(profile => {
        const id = required(profile.id, 'Hermes profile id');
        if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(id))
            throw new TypeError(`invalid Hermes profile id ${id}`);
        if (seen.has(id))
            throw new TypeError(`duplicate Hermes profile id ${id}`);
        seen.add(id);
        return {
            id,
            displayName: profile.displayName?.trim() || null,
            serverProfile: profile.serverProfile?.trim() || null,
            roles: unique(profile.roles ?? []),
            capabilities: unique(profile.capabilities ?? ['runtime.execute', 'session.resume', 'session.cancel']),
        };
    }).sort((left, right) => left.id.localeCompare(right.id));
}
function parseTarget(target) {
    const ref = target.split(':').at(-1)?.trim() ?? '';
    const match = /^(?:hermes|hermesd)\/(.+)$/u.exec(ref);
    return match?.[1] ? { id: match[1] } : null;
}
function hermesUsage(usage, durationMs) {
    return {
        input_tokens: numberValue(usage?.input_tokens), output_tokens: numberValue(usage?.output_tokens),
        total_tokens: numberValue(usage?.total_tokens), tool_calls: numberValue(usage?.tool_calls),
        cost_usd: numberValue(usage?.cost_usd), duration_ms: durationMs,
    };
}
function sleep(ms, signal) {
    return new Promise((resolve, reject) => {
        if (signal.aborted) {
            reject(signal.reason);
            return;
        }
        const timer = setTimeout(resolve, ms);
        timer.unref?.();
        signal.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
    });
}
function errorMessage(value) {
    if (typeof value === 'string')
        return value.trim() || null;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const message = value.message;
        return typeof message === 'string' && message.trim() ? message.trim() : null;
    }
    return null;
}
function hermesPercent(status) { return status === 'queued' ? 25 : status === 'running' ? 60 : status === 'completed' ? 90 : 50; }
function hermesIdempotencyKey(value) {
    const normalized = required(value, 'dispatch idempotency_key');
    return /^[\x21-\x7e]{1,255}$/u.test(normalized)
        ? normalized
        : `agora-${createHash('sha256').update(normalized).digest('hex')}`;
}
function normalizePollInterval(value) { return Number.isSafeInteger(value) && (value ?? 0) > 0 ? value : 1_000; }
function normalizeTimeout(value) { return Number.isSafeInteger(value) && (value ?? 0) >= 1_000 ? value : 600_000; }
function unique(values) { return [...new Set(values.map(value => value.trim()).filter(Boolean))].sort(); }
function required(value, label) { const normalized = value.trim(); if (!normalized)
    throw new TypeError(`${label} is required`); return normalized; }
function numberValue(value) { return typeof value === 'number' && Number.isFinite(value) ? value : null; }
//# sourceMappingURL=hermesd-runtime.js.map