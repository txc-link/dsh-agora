export class AgoraApiError extends Error {
    status;
    path;
    detail;
    constructor(message, status, path, detail) {
        super(message);
        this.status = status;
        this.path = path;
        this.detail = detail;
        this.name = 'AgoraApiError';
    }
}
export class AgoraClient {
    serverUrl;
    apiToken;
    timeoutMs;
    fetchImpl;
    constructor(options) {
        const url = new URL(options.serverUrl);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            throw new TypeError('Agora serverUrl must use http or https');
        }
        this.serverUrl = url.toString().replace(/\/$/u, '');
        this.apiToken = nonEmpty(options.apiToken);
        this.timeoutMs = normalizeTimeout(options.timeoutMs);
        this.fetchImpl = options.fetch ?? globalThis.fetch;
    }
    health(signal) {
        return this.request('/api/health', { signal });
    }
    listTasks(state, projectId, signal) {
        const query = new URLSearchParams();
        if (nonEmpty(state))
            query.set('state', state.trim());
        if (nonEmpty(projectId))
            query.set('project_id', projectId.trim());
        const suffix = query.size === 0 ? '' : `?${query.toString()}`;
        return this.request(`/api/tasks${suffix}`, { signal });
    }
    getTask(taskId, signal) {
        return this.request(`/api/tasks/${encodeURIComponent(requireValue(taskId, 'task id'))}`, { signal });
    }
    taskStatus(taskId, signal) {
        return this.request(`/api/tasks/${encodeURIComponent(requireValue(taskId, 'task id'))}/status`, { signal });
    }
    createTask(input, signal) {
        const title = requireValue(input.title, 'task title');
        const body = {
            title,
            type: nonEmpty(input.type) ?? 'general',
            creator: nonEmpty(input.creator) ?? 'dsh',
            description: input.description ?? '',
            priority: input.priority ?? 'normal',
            locale: input.locale ?? 'zh-CN',
            ...(nonEmpty(input.projectId) ? { project_id: input.projectId.trim() } : {}),
            ...(input.imTarget === undefined ? {} : { im_target: compactImTarget(input.imTarget) }),
        };
        return this.request('/api/tasks', { method: 'POST', body, signal });
    }
    heartbeatRuntimeNode(nodeId, input, signal) {
        return this.request(`/api/runtime-nodes/${encodeURIComponent(requireValue(nodeId, 'node id'))}/heartbeat`, {
            method: 'PUT', body: input, signal,
        });
    }
    runtimeHandshake(input, signal) {
        return this.request('/api/runtime-handshake', { method: 'POST', body: input, signal });
    }
    listRuntimeNodes(signal) {
        return this.request('/api/runtime-nodes', { signal }).then(value => value.nodes);
    }
    listRuntimeTargets(signal) {
        return this.request('/api/runtime-targets', { signal }).then(value => value.runtime_targets);
    }
    createRuntimeDispatch(nodeId, input, signal) {
        return this.request(`/api/runtime-nodes/${encodeURIComponent(requireValue(nodeId, 'node id'))}/dispatches`, {
            method: 'POST', body: input, signal,
        });
    }
    getRuntimeDispatch(dispatchId, signal) {
        return this.request(`/api/runtime-dispatches/${encodeURIComponent(requireValue(dispatchId, 'dispatch id'))}`, { signal });
    }
    listRuntimeDispatchProgress(dispatchId, signal) {
        return this.request(`/api/runtime-dispatches/${encodeURIComponent(requireValue(dispatchId, 'dispatch id'))}/progress`, { signal }).then(value => value.events);
    }
    createCoordinationRun(input, signal) {
        return this.request('/api/coordination-runs', { method: 'POST', body: input, signal });
    }
    getCoordinationRun(runId, signal) {
        return this.request(`/api/coordination-runs/${encodeURIComponent(requireValue(runId, 'coordination run id'))}`, { signal });
    }
    listCoordinationRuns(status, signal) {
        const suffix = status ? `?status=${encodeURIComponent(status)}` : '';
        return this.request(`/api/coordination-runs${suffix}`, { signal }).then(value => value.runs);
    }
    listAgentScorecards(taskType, signal) {
        const suffix = nonEmpty(taskType) ? `?task_type=${encodeURIComponent(taskType.trim())}` : '';
        return this.request(`/api/agent-scorecards${suffix}`, { signal }).then(value => value.scorecards);
    }
    claimRuntimeDispatch(nodeId, instanceId, leaseSeconds, signal) {
        return this.request(`/api/runtime-nodes/${encodeURIComponent(requireValue(nodeId, 'node id'))}/dispatches/claim`, { method: 'POST', body: { instance_id: instanceId, lease_seconds: leaseSeconds }, signal }).then(value => value.dispatch);
    }
    renewRuntimeDispatch(nodeId, dispatchId, instanceId, claimToken, leaseSeconds, signal) {
        return this.request(`/api/runtime-nodes/${encodeURIComponent(requireValue(nodeId, 'node id'))}/dispatches/${encodeURIComponent(requireValue(dispatchId, 'dispatch id'))}/renew`, {
            method: 'POST',
            body: {
                instance_id: requireValue(instanceId, 'instance id'),
                claim_token: requireValue(claimToken, 'claim token'),
                lease_seconds: leaseSeconds,
            },
            signal,
        });
    }
    recordRuntimeDispatchProgress(nodeId, dispatchId, input, signal) {
        return this.request(`/api/runtime-nodes/${encodeURIComponent(requireValue(nodeId, 'node id'))}/dispatches/${encodeURIComponent(requireValue(dispatchId, 'dispatch id'))}/progress`, { method: 'POST', body: input, signal });
    }
    completeRuntimeDispatch(nodeId, dispatchId, input, signal) {
        return this.request(`/api/runtime-nodes/${encodeURIComponent(requireValue(nodeId, 'node id'))}/dispatches/${encodeURIComponent(requireValue(dispatchId, 'dispatch id'))}/complete`, { method: 'POST', body: input, signal });
    }
    claimRuntimeDelivery(nodeId, instanceId, leaseSeconds, signal) {
        return this.request(`/api/runtime-nodes/${encodeURIComponent(requireValue(nodeId, 'node id'))}/deliveries/claim`, { method: 'POST', body: { instance_id: instanceId, lease_seconds: leaseSeconds }, signal }).then(value => value.delivery);
    }
    completeRuntimeDelivery(nodeId, deliveryId, input, signal) {
        return this.request(`/api/runtime-nodes/${encodeURIComponent(requireValue(nodeId, 'node id'))}/deliveries/${encodeURIComponent(requireValue(deliveryId, 'delivery id'))}/complete`, { method: 'POST', body: input, signal });
    }
    bindRuntimeSession(taskId, participantBindingId, sessionId, agentRef, signal) {
        return this.request(`/api/tasks/${encodeURIComponent(requireValue(taskId, 'task id'))}/runtime-session-bindings/${encodeURIComponent(requireValue(participantBindingId, 'participant binding id'))}`, {
            method: 'PUT',
            body: {
                runtime_provider: 'dsh',
                runtime_session_ref: requireValue(sessionId, 'session id'),
                runtime_actor_ref: nonEmpty(agentRef) ?? null,
                continuity_ref: `dsh:${requireValue(sessionId, 'session id')}`,
                presence_state: 'active',
                binding_reason: 'runtime_node_dispatch',
            },
            signal,
        });
    }
    async request(path, options = {}) {
        const timeoutSignal = AbortSignal.timeout(this.timeoutMs);
        const signal = options.signal === undefined
            ? timeoutSignal
            : AbortSignal.any([options.signal, timeoutSignal]);
        const headers = { Accept: 'application/json' };
        if (options.body !== undefined)
            headers['Content-Type'] = 'application/json';
        if (this.apiToken !== undefined)
            headers.Authorization = `Bearer ${this.apiToken}`;
        const response = await this.fetchImpl(`${this.serverUrl}${path}`, {
            method: options.method ?? 'GET',
            headers,
            ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
            signal,
        });
        const text = await response.text();
        const payload = parsePayload(text);
        if (!response.ok) {
            const detail = errorDetail(payload, text);
            throw new AgoraApiError(`Agora API ${response.status} at ${path}: ${detail}`, response.status, path, payload);
        }
        return payload;
    }
}
function compactImTarget(target) {
    return {
        ...(nonEmpty(target.provider) ? { provider: target.provider.trim() } : {}),
        ...(nonEmpty(target.conversation_ref) ? { conversation_ref: target.conversation_ref.trim() } : {}),
        ...(nonEmpty(target.thread_ref) ? { thread_ref: target.thread_ref.trim() } : {}),
        ...(target.visibility === undefined ? {} : { visibility: target.visibility }),
        ...(target.participant_refs === undefined ? {} : { participant_refs: [...target.participant_refs] }),
    };
}
function normalizeTimeout(value) {
    const timeout = value ?? 10_000;
    if (!Number.isSafeInteger(timeout) || timeout < 100 || timeout > 300_000) {
        throw new TypeError('requestTimeoutMs must be an integer between 100 and 300000');
    }
    return timeout;
}
function requireValue(value, label) {
    const normalized = nonEmpty(value);
    if (normalized === undefined)
        throw new TypeError(`${label} is required`);
    return normalized;
}
function nonEmpty(value) {
    const normalized = value?.trim();
    return normalized === '' ? undefined : normalized;
}
function parsePayload(text) {
    if (text.trim() === '')
        return {};
    try {
        return JSON.parse(text);
    }
    catch (error) {
        throw new SyntaxError(`Agora returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
}
function errorDetail(payload, fallback) {
    if (typeof payload === 'object' && payload !== null) {
        const record = payload;
        for (const key of ['detail', 'message', 'error']) {
            if (typeof record[key] === 'string' && record[key].trim() !== '')
                return record[key];
        }
    }
    return fallback.trim() || 'request failed';
}
//# sourceMappingURL=agora-client.js.map