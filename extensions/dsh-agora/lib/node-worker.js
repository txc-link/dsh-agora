import { DSH_AGORA_NODE_PROTOCOL, } from './contracts.js';
export class RuntimeNodeWorker {
    options;
    abortController = new AbortController();
    heartbeatTimer = null;
    dispatchTimer = null;
    active = 0;
    started = false;
    imBridge;
    constructor(options) {
        this.options = options;
        this.imBridge = options.imBridge ?? null;
    }
    setImBridge(bridge) {
        this.imBridge = bridge;
    }
    start() {
        if (this.started)
            return;
        this.started = true;
        this.setStatus({ state: 'connecting', nodeId: this.options.nodeId });
        void this.heartbeatLoop();
        void this.dispatchLoop();
    }
    stop() {
        if (!this.started)
            return;
        this.started = false;
        this.abortController.abort(new DOMException('dsh-agora node worker stopped', 'AbortError'));
        if (this.heartbeatTimer !== null)
            clearTimeout(this.heartbeatTimer);
        if (this.dispatchTimer !== null)
            clearTimeout(this.dispatchTimer);
        this.heartbeatTimer = null;
        this.dispatchTimer = null;
    }
    async heartbeatLoop() {
        if (this.abortController.signal.aborted)
            return;
        try {
            const agents = (await Promise.all(this.options.registry.listExtensions()
                .filter(extension => extension.runtime !== undefined)
                .map(extension => extension.runtime.describeAgents()))).flat();
            if (agents.length === 0)
                throw new Error('no runtime agents are registered');
            const bots = await this.listBots();
            const now = new Date().toISOString();
            await this.options.client.heartbeatRuntimeNode(this.options.nodeId, {
                protocol: DSH_AGORA_NODE_PROTOCOL,
                instance_id: this.options.instanceId,
                plugin_version: this.options.pluginVersion,
                host_framework: 'deepseek-harness',
                runtime_provider: 'dsh',
                agents,
                bots,
                capacity: { max_concurrent: this.maxConcurrent, active: this.active },
                lease_seconds: this.leaseSeconds,
                metadata: this.options.metadata ?? null,
            }, this.abortController.signal);
            this.setStatus({ state: 'online', nodeId: this.options.nodeId, lastHeartbeatAt: now });
        }
        catch (error) {
            if (!this.abortController.signal.aborted) {
                this.setStatus({
                    state: 'error', nodeId: this.options.nodeId,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
        finally {
            this.heartbeatTimer = schedule(() => void this.heartbeatLoop(), this.options.heartbeatIntervalMs ?? 30_000, this.abortController.signal);
        }
    }
    async dispatchLoop() {
        if (this.abortController.signal.aborted)
            return;
        try {
            while (this.active < this.maxConcurrent && !this.abortController.signal.aborted) {
                const dispatch = await this.options.client.claimRuntimeDispatch(this.options.nodeId, this.options.instanceId, this.options.dispatchLeaseSeconds ?? 120, this.abortController.signal);
                if (!dispatch)
                    break;
                this.active += 1;
                void this.execute(dispatch).finally(() => { this.active -= 1; });
            }
        }
        catch {
            // Heartbeat owns the operator-visible status. Dispatch polling is retried
            // independently so a transient queue error does not flap node presence.
        }
        finally {
            this.dispatchTimer = schedule(() => void this.dispatchLoop(), this.options.dispatchPollIntervalMs ?? 2_000, this.abortController.signal);
        }
    }
    async execute(dispatch) {
        const runtime = this.options.registry.runtimeForTarget(dispatch.runtime_target_ref);
        if (!runtime) {
            await this.fail(dispatch, `no runtime adapter accepts ${dispatch.runtime_target_ref}`);
            return;
        }
        try {
            const result = await runtime.execute(dispatch, this.abortController.signal);
            if (dispatch.task_id && dispatch.participant_binding_id) {
                await this.options.client.bindRuntimeSession(dispatch.task_id, dispatch.participant_binding_id, result.sessionId, dispatch.runtime_target_ref, this.abortController.signal);
            }
            const presentation = await this.present(dispatch, result.answer);
            await this.options.client.completeRuntimeDispatch(this.options.nodeId, dispatch.id, {
                instance_id: this.options.instanceId,
                status: 'completed',
                session_id: result.sessionId,
                result: {
                    answer: result.answer,
                    reason: result.reason ?? null,
                    ...(result.metadata ?? {}),
                    ...(presentation === null ? {} : { presentation }),
                },
            }, this.abortController.signal);
        }
        catch (error) {
            if (this.abortController.signal.aborted)
                return;
            await this.fail(dispatch, error instanceof Error ? error.message : String(error));
        }
    }
    async fail(dispatch, error) {
        try {
            await this.options.client.completeRuntimeDispatch(this.options.nodeId, dispatch.id, { instance_id: this.options.instanceId, status: 'failed', error }, this.abortController.signal);
        }
        catch {
            // The claim lease will expire and make the durable dispatch retryable.
        }
    }
    async present(dispatch, answer) {
        const bridge = this.imBridge;
        if (!bridge || !answer.trim())
            return null;
        const metadata = asRecord(dispatch.metadata);
        const target = asRecord(metadata?.presentation_target);
        if (!target || target.mode !== 'destination_bot')
            return null;
        const provider = stringValue(target.provider);
        const conversationRef = stringValue(target.conversation_ref);
        if (!provider || !conversationRef)
            return null;
        const bots = await bridge.listBots();
        const agentRef = dispatch.runtime_target_ref.split(':').at(-1);
        const bot = bots.find(item => item.connected && item.provider === provider && item.agent_ref === agentRef)
            ?? bots.find(item => item.connected && item.provider === provider);
        if (!bot)
            return { sent: false, reason: `no connected ${provider} bot on destination node` };
        const request = {
            provider,
            bot_ref: bot.bot_ref,
            conversation_ref: conversationRef,
            thread_ref: stringValue(target.thread_ref),
            reply_to_message_ref: stringValue(target.reply_to_message_ref),
            text: answer,
            idempotency_key: `agora:${dispatch.id}:result`,
        };
        try {
            const receipt = await bridge.send(request);
            return { sent: true, bot_ref: bot.bot_ref, provider_message_refs: receipt.provider_message_refs };
        }
        catch (error) {
            return { sent: false, reason: error instanceof Error ? error.message : String(error) };
        }
    }
    async listBots() {
        try {
            return await this.imBridge?.listBots() ?? [];
        }
        catch {
            return [];
        }
    }
    setStatus(status) {
        this.options.onStatus?.(status);
    }
    get leaseSeconds() {
        return this.options.leaseSeconds ?? 90;
    }
    get maxConcurrent() {
        return this.options.maxConcurrent ?? 1;
    }
}
function schedule(callback, delay, signal) {
    if (signal.aborted)
        return null;
    const timer = setTimeout(callback, delay);
    timer.unref?.();
    return timer;
}
function asRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? value
        : null;
}
function stringValue(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}
//# sourceMappingURL=node-worker.js.map