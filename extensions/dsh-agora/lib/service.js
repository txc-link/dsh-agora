import { AgoraClient } from './agora-client.js';
import { executeAgoraCommand } from './command.js';
import { DshAgoraExtensionRegistry } from './extension-sdk.js';
export class DshAgoraService {
    options;
    registry;
    imStatus = {
        state: 'unavailable',
        reason: 'dsh-im command gateway discovery has not run',
    };
    imBridgeStatus = {
        state: 'unavailable',
        reason: 'dsh-im bridge discovery has not run',
    };
    imBridge;
    nodeStatus;
    constructor(options) {
        this.options = options;
        this.registry = options.registry ?? new DshAgoraExtensionRegistry();
        this.imBridge = options.imBridge ?? null;
        this.nodeStatus = { state: 'disabled', nodeId: options.nodeId ?? 'unconfigured' };
    }
    get serverUrl() {
        return this.options.client.serverUrl;
    }
    health(signal) {
        return this.options.client.health(signal);
    }
    listTasks(state, projectId, signal) {
        return this.options.client.listTasks(state, projectId, signal);
    }
    getTask(taskId, signal) {
        return this.options.client.getTask(taskId, signal);
    }
    taskStatus(taskId, signal) {
        return this.options.client.taskStatus(taskId, signal);
    }
    createTask(input, signal) {
        return this.options.client.createTask({
            ...input,
            creator: input.creator?.trim() || this.options.defaultCreator,
        }, signal);
    }
    listRuntimeNodes(signal) {
        return this.options.client.listRuntimeNodes(signal);
    }
    listRuntimeTargets(signal) {
        return this.options.client.listRuntimeTargets(signal);
    }
    createRuntimeDispatch(nodeId, input, signal) {
        return this.options.client.createRuntimeDispatch(nodeId, input, signal);
    }
    getRuntimeDispatch(dispatchId, signal) {
        return this.options.client.getRuntimeDispatch(dispatchId, signal);
    }
    async dispatchAgent(input, signal) {
        const { nodeId } = parseDshRuntimeTarget(input.runtime_target_ref);
        let metadata = input.metadata ?? null;
        if (input.source_session_id && input.presentation_mode !== 'silent' && this.imBridge) {
            const route = await this.imBridge.resolveSession(input.source_session_id);
            if (route) {
                metadata = {
                    ...(metadata ?? {}),
                    source_session_id: input.source_session_id,
                    presentation_target: {
                        mode: input.presentation_mode ?? 'destination_bot',
                        provider: route.provider,
                        conversation_ref: route.conversation_ref,
                        thread_ref: route.thread_ref,
                        reply_to_message_ref: route.reply_to_message_ref,
                        source_bot_ref: route.bot_ref,
                    },
                };
            }
        }
        const dispatch = await this.options.client.createRuntimeDispatch(nodeId, {
            runtime_target_ref: input.runtime_target_ref,
            prompt: input.prompt,
            idempotency_key: input.idempotency_key,
            metadata,
            ...(input.task_id === undefined ? {} : { task_id: input.task_id }),
            ...(input.participant_binding_id === undefined ? {} : { participant_binding_id: input.participant_binding_id }),
            ...(input.session_id === undefined ? {} : { session_id: input.session_id }),
            ...(input.workspace_alias === undefined ? {} : { workspace_alias: input.workspace_alias }),
            ...(input.agent_preset === undefined ? {} : { agent_preset: input.agent_preset }),
        }, signal);
        const waitMs = normalizeWaitTimeout(input.wait_timeout_ms);
        if (waitMs === 0 || isTerminal(dispatch))
            return dispatch;
        const timeout = AbortSignal.timeout(waitMs);
        const combined = signal === undefined ? timeout : AbortSignal.any([signal, timeout]);
        let current = dispatch;
        while (!isTerminal(current)) {
            await sleep(1_000, combined);
            current = await this.options.client.getRuntimeDispatch(current.id, combined);
        }
        return current;
    }
    bindRuntimeSession(taskId, participantBindingId, sessionId, agentRef, signal) {
        return this.options.client.bindRuntimeSession(taskId, participantBindingId, sessionId, agentRef, signal);
    }
    registerExtension(extension) {
        return this.registry.registerExtension(extension);
    }
    listExtensions() {
        return this.registry.listExtensions();
    }
    executeCommand(rawInput, context = {}, signal) {
        return executeAgoraCommand(this, rawInput, context, signal);
    }
    snapshot() {
        return {
            serverUrl: this.serverUrl,
            command: `/${this.options.commandName}`,
            im: this.imStatus,
            imBridge: this.imBridgeStatus,
            node: this.nodeStatus,
            extensions: this.registry.listExtensions().map(extension => ({
                id: extension.id,
                protocol: extension.protocol,
                kind: extension.kind,
                capabilities: extension.capabilities,
            })),
        };
    }
    setImStatus(status) {
        this.imStatus = status;
    }
    setImBridgeStatus(status) {
        this.imBridgeStatus = status;
    }
    setImBridge(bridge, status) {
        this.imBridge = bridge;
        this.imBridgeStatus = status;
    }
    setNodeStatus(status) {
        this.nodeStatus = status;
    }
}
function parseDshRuntimeTarget(value) {
    const match = /^dsh:([^:]+):(.+)$/u.exec(value.trim());
    if (!match)
        throw new TypeError('runtime_target_ref must use dsh:<node-id>:<agent-ref>');
    return { nodeId: match[1], agentRef: match[2] };
}
function normalizeWaitTimeout(value) {
    const timeout = value ?? 0;
    if (!Number.isSafeInteger(timeout) || timeout < 0 || timeout > 600_000) {
        throw new TypeError('wait_timeout_ms must be an integer between 0 and 600000');
    }
    return timeout;
}
function isTerminal(dispatch) {
    return dispatch.status === 'completed' || dispatch.status === 'failed' || dispatch.status === 'cancelled';
}
function sleep(ms, signal) {
    return new Promise((resolve, reject) => {
        if (signal.aborted)
            return reject(signal.reason);
        const timer = setTimeout(() => {
            signal.removeEventListener('abort', onAbort);
            resolve();
        }, ms);
        const onAbort = () => {
            clearTimeout(timer);
            reject(signal.reason);
        };
        signal.addEventListener('abort', onAbort, { once: true });
    });
}
//# sourceMappingURL=service.js.map