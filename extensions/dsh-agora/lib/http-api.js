import { timingSafeEqual } from 'node:crypto';
export const API_PREFIX = '/dsh-agora/api';
const MAX_BODY_BYTES = 1_048_576;
export function registerHttpApi(webServer, service, options) {
    return webServer.register({
        kind: 'prefix',
        path: API_PREFIX,
        handler: (request, response) => handleHttpRequest(request, response, service, options),
    });
}
export async function handleHttpRequest(request, response, service, options) {
    try {
        if (!authorized(request, options.accessToken)) {
            writeJson(response, 403, { ok: false, error: { code: 'forbidden', message: 'forbidden' } });
            return;
        }
        if (request.method !== 'POST') {
            writeJson(response, 405, { ok: false, error: { code: 'method-not-allowed', message: 'POST required' } });
            return;
        }
        const pathname = new URL(request.url ?? '/', 'http://dsh.internal').pathname;
        const method = pathname.startsWith(`${API_PREFIX}/`) ? pathname.slice(API_PREFIX.length + 1) : '';
        if (method === '' || method.includes('/'))
            throw new HttpApiError(404, 'not-found', 'unknown dsh-agora API method');
        const payload = asRecord(await readJsonBody(request));
        const signal = AbortSignal.timeout(300_000);
        let value;
        switch (method) {
            case 'snapshot':
                value = service.snapshot();
                break;
            case 'health':
                value = await service.health(signal);
                break;
            case 'nodes':
                value = await service.listRuntimeNodes(signal);
                break;
            case 'agents':
                value = await service.listRuntimeTargets(signal);
                break;
            case 'tasks':
                value = await service.listTasks(optionalString(payload.state), optionalString(payload.projectId), signal);
                break;
            case 'task':
                value = await service.getTask(requiredString(payload.taskId, 'taskId'), signal);
                break;
            case 'status':
                value = await service.taskStatus(requiredString(payload.taskId, 'taskId'), signal);
                break;
            case 'dispatch-status':
                value = await service.getRuntimeDispatch(requiredString(payload.dispatchId, 'dispatchId'), signal);
                break;
            case 'dispatch-progress':
                value = await service.listRuntimeDispatchProgress(requiredString(payload.dispatchId, 'dispatchId'), signal);
                break;
            case 'dispatch': {
                const taskId = optionalString(payload.taskId);
                const participantBindingId = optionalString(payload.participantBindingId);
                const sessionId = optionalString(payload.sessionId);
                const workspaceAlias = optionalString(payload.workspaceAlias);
                const agentPreset = optionalString(payload.agentPreset);
                const sourceSessionId = optionalString(payload.sourceSessionId);
                const presentationMode = optionalString(payload.presentationMode);
                const waitTimeoutMs = optionalInteger(payload.waitTimeoutMs, 'waitTimeoutMs', 0, 600_000);
                if (presentationMode !== undefined && !['source_bot', 'destination_bot', 'silent'].includes(presentationMode)) {
                    throw new HttpApiError(400, 'bad-request', 'presentationMode is invalid');
                }
                value = await service.dispatchAgent({
                    runtime_target_ref: requiredString(payload.runtimeTargetRef, 'runtimeTargetRef'),
                    prompt: requiredString(payload.prompt, 'prompt'),
                    idempotency_key: requiredString(payload.idempotencyKey, 'idempotencyKey'),
                    ...(taskId === undefined ? {} : { task_id: taskId }),
                    ...(participantBindingId === undefined ? {} : { participant_binding_id: participantBindingId }),
                    ...(sessionId === undefined ? {} : { session_id: sessionId }),
                    ...(workspaceAlias === undefined ? {} : { workspace_alias: workspaceAlias }),
                    ...(agentPreset === undefined ? {} : { agent_preset: agentPreset }),
                    ...(sourceSessionId === undefined ? {} : { source_session_id: sourceSessionId }),
                    ...(waitTimeoutMs === undefined ? {} : { wait_timeout_ms: waitTimeoutMs }),
                    ...(presentationMode === undefined ? {} : {
                        presentation_mode: presentationMode,
                    }),
                }, signal);
                break;
            }
            case 'attach-session':
                value = await service.bindRuntimeSession(requiredString(payload.taskId, 'taskId'), requiredString(payload.participantBindingId, 'participantBindingId'), requiredString(payload.sessionId, 'sessionId'), optionalString(payload.runtimeTargetRef), signal);
                break;
            case 'create': {
                const type = optionalString(payload.type);
                const creator = optionalString(payload.creator);
                const description = optionalString(payload.description);
                const projectId = optionalString(payload.projectId);
                value = await service.createTask({
                    title: requiredString(payload.title, 'title'),
                    ...(type === undefined ? {} : { type }),
                    ...(creator === undefined ? {} : { creator }),
                    ...(description === undefined ? {} : { description }),
                    ...(projectId === undefined ? {} : { projectId }),
                }, signal);
                break;
            }
            case 'command':
                value = await service.executeCommand(optionalString(payload.input) ?? '', requestContext(payload.context), signal);
                break;
            default: throw new HttpApiError(404, 'not-found', `unknown dsh-agora API method "${method}"`);
        }
        writeJson(response, 200, { ok: true, value });
    }
    catch (error) {
        if (error instanceof HttpApiError) {
            writeJson(response, error.status, { ok: false, error: { code: error.code, message: error.message } });
            return;
        }
        writeJson(response, 502, { ok: false, error: { code: 'upstream-error', message: error instanceof Error ? error.message : String(error) } });
    }
}
class HttpApiError extends Error {
    status;
    code;
    constructor(status, code, message) {
        super(message);
        this.status = status;
        this.code = code;
    }
}
function authorized(request, configuredToken) {
    if (isLoopback(request.socket.remoteAddress))
        return true;
    const token = configuredToken?.trim();
    if (!token)
        return false;
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer '))
        return false;
    const supplied = authorization.slice(7);
    const expectedBytes = Buffer.from(token);
    const suppliedBytes = Buffer.from(supplied);
    return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}
function isLoopback(address) {
    return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}
async function readJsonBody(request) {
    const chunks = [];
    let length = 0;
    for await (const chunk of request) {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        length += bytes.length;
        if (length > MAX_BODY_BYTES)
            throw new HttpApiError(413, 'body-too-large', 'request body exceeds 1 MiB');
        chunks.push(bytes);
    }
    const text = Buffer.concat(chunks).toString('utf8').trim();
    if (text === '')
        return {};
    try {
        return JSON.parse(text);
    }
    catch {
        throw new HttpApiError(400, 'bad-json', 'request body must be valid JSON');
    }
}
function asRecord(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
        throw new HttpApiError(400, 'bad-request', 'request body must be an object');
    return value;
}
function optionalString(value) {
    if (value === undefined || value === null)
        return undefined;
    if (typeof value !== 'string')
        throw new HttpApiError(400, 'bad-request', 'expected a string field');
    const normalized = value.trim();
    return normalized === '' ? undefined : normalized;
}
function requiredString(value, field) {
    const normalized = optionalString(value);
    if (normalized === undefined)
        throw new HttpApiError(400, 'bad-request', `${field} is required`);
    return normalized;
}
function optionalInteger(value, field, minimum, maximum) {
    if (value === undefined || value === null)
        return undefined;
    if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
        throw new HttpApiError(400, 'bad-request', `${field} must be an integer between ${minimum} and ${maximum}`);
    }
    return value;
}
function requestContext(value) {
    if (value === undefined)
        return {};
    const record = asRecord(value);
    const actorId = optionalString(record.actorId);
    const provider = optionalString(record.provider);
    const conversationRef = optionalString(record.conversationRef);
    const threadRef = optionalString(record.threadRef);
    return {
        ...(actorId === undefined ? {} : { actorId }),
        ...(provider === undefined ? {} : { provider }),
        ...(conversationRef === undefined ? {} : { conversationRef }),
        ...(threadRef === undefined ? {} : { threadRef }),
    };
}
function writeJson(response, status, body) {
    response.statusCode = status;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    response.end(JSON.stringify(body));
}
//# sourceMappingURL=http-api.js.map