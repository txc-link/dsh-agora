import { DSH_AGORA_NODE_PROTOCOL, } from './contracts.js';
export class RuntimeNodeWorker {
    options;
    abortController = new AbortController();
    heartbeatTimer = null;
    dispatchTimer = null;
    deliveryTimer = null;
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
        void this.deliveryLoop();
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
        if (this.deliveryTimer !== null)
            clearTimeout(this.deliveryTimer);
        this.heartbeatTimer = null;
        this.dispatchTimer = null;
        this.deliveryTimer = null;
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
                const dispatch = await this.options.client.claimRuntimeDispatch(this.options.nodeId, this.options.instanceId, this.dispatchLeaseSeconds, this.abortController.signal);
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
        if (!dispatch.claim_token) {
            await this.fail(dispatch, 'claimed dispatch has no fencing token');
            return;
        }
        const renewalAbort = new AbortController();
        const leaseLostAbort = new AbortController();
        const executionSignal = AbortSignal.any([
            this.abortController.signal,
            leaseLostAbort.signal,
        ]);
        const renewal = this.renewLease(dispatch, renewalAbort.signal).catch(error => {
            if (!renewalAbort.signal.aborted && !this.abortController.signal.aborted) {
                leaseLostAbort.abort(error);
            }
        });
        try {
            const result = await runtime.execute(dispatch, executionSignal);
            renewalAbort.abort();
            await renewal;
            if (leaseLostAbort.signal.aborted)
                return;
            const deliveryPayload = this.presentationPayload(dispatch, result.answer);
            await this.options.client.completeRuntimeDispatch(this.options.nodeId, dispatch.id, {
                instance_id: this.options.instanceId,
                claim_token: dispatch.claim_token,
                status: 'completed',
                session_id: result.sessionId,
                result: {
                    answer: result.answer,
                    reason: result.reason ?? null,
                    ...(result.metadata ?? {}),
                },
                ...(deliveryPayload === null ? {} : { delivery_payload: deliveryPayload }),
            }, this.abortController.signal);
            if (dispatch.task_id && dispatch.participant_binding_id) {
                try {
                    await this.options.client.bindRuntimeSession(dispatch.task_id, dispatch.participant_binding_id, result.sessionId, dispatch.runtime_target_ref, this.abortController.signal);
                }
                catch {
                    // The durable result is authoritative. Session binding is repaired by
                    // the normal reconciliation path instead of rolling back completion.
                }
            }
        }
        catch (error) {
            renewalAbort.abort();
            await renewal;
            if (this.abortController.signal.aborted || leaseLostAbort.signal.aborted)
                return;
            await this.fail(dispatch, error instanceof Error ? error.message : String(error));
        }
    }
    async deliveryLoop() {
        if (this.abortController.signal.aborted)
            return;
        try {
            while (!this.abortController.signal.aborted) {
                const delivery = await this.options.client.claimRuntimeDelivery(this.options.nodeId, this.options.instanceId, this.deliveryLeaseSeconds, this.abortController.signal);
                if (!delivery)
                    break;
                await this.deliver(delivery);
            }
        }
        catch {
            // Durable delivery remains pending or is released when its lease expires.
        }
        finally {
            this.deliveryTimer = schedule(() => void this.deliveryLoop(), this.options.deliveryPollIntervalMs ?? 2_000, this.abortController.signal);
        }
    }
    async renewLease(dispatch, signal) {
        const claimToken = dispatch.claim_token;
        if (!claimToken)
            throw new Error(`runtime dispatch ${dispatch.id} has no fencing token`);
        while (!signal.aborted && !this.abortController.signal.aborted) {
            await sleep(this.dispatchRenewIntervalMs, AbortSignal.any([signal, this.abortController.signal]));
            await this.options.client.renewRuntimeDispatch(this.options.nodeId, dispatch.id, this.options.instanceId, claimToken, this.dispatchLeaseSeconds, AbortSignal.any([signal, this.abortController.signal]));
        }
    }
    async fail(dispatch, error) {
        try {
            if (!dispatch.claim_token)
                return;
            await this.options.client.completeRuntimeDispatch(this.options.nodeId, dispatch.id, { instance_id: this.options.instanceId, claim_token: dispatch.claim_token, status: 'failed', error }, this.abortController.signal);
        }
        catch {
            // The claim lease will expire and make the durable dispatch retryable.
        }
    }
    presentationPayload(dispatch, answer) {
        if (!answer.trim())
            return null;
        const metadata = asRecord(dispatch.metadata);
        const target = asRecord(metadata?.presentation_target);
        if (!target || target.mode !== 'destination_bot')
            return null;
        if (!stringValue(target.provider) || !stringValue(target.conversation_ref))
            return null;
        return {
            protocol: 'dsh-agora.presentation/v1',
            runtime_target_ref: dispatch.runtime_target_ref,
            text: answer,
            target,
        };
    }
    async deliver(delivery) {
        const claimToken = delivery.claim_token;
        if (!claimToken)
            return;
        try {
            const payload = asRecord(delivery.payload);
            if (payload?.protocol !== 'dsh-agora.presentation/v1') {
                throw new Error('unsupported runtime delivery payload');
            }
            const target = asRecord(payload.target);
            const text = stringValue(payload.text);
            const runtimeTargetRef = stringValue(payload.runtime_target_ref);
            if (!target || !text || !runtimeTargetRef)
                throw new Error('invalid presentation delivery payload');
            const bridge = this.imBridge;
            if (!bridge)
                throw new Error('dsh-im bridge is unavailable');
            const provider = stringValue(target.provider);
            const conversationRef = stringValue(target.conversation_ref);
            if (!provider || !conversationRef)
                throw new Error('presentation target is incomplete');
            const bots = await bridge.listBots();
            const agentRef = runtimeTargetRef.split(':').at(-1);
            const bot = bots.find(item => item.connected && item.provider === provider && item.agent_ref === agentRef)
                ?? bots.find(item => item.connected && item.provider === provider);
            if (!bot)
                throw new Error(`no connected ${provider} bot on destination node`);
            const request = {
                provider,
                bot_ref: bot.bot_ref,
                conversation_ref: conversationRef,
                thread_ref: stringValue(target.thread_ref),
                reply_to_message_ref: stringValue(target.reply_to_message_ref),
                text,
                idempotency_key: `agora:${delivery.dispatch_id}:result`,
            };
            const receipt = await bridge.send(request);
            await this.options.client.completeRuntimeDelivery(this.options.nodeId, delivery.id, {
                instance_id: this.options.instanceId,
                claim_token: claimToken,
                status: 'delivered',
                receipt: { provider_message_refs: receipt.provider_message_refs },
            }, this.abortController.signal);
        }
        catch (error) {
            if (this.abortController.signal.aborted)
                return;
            try {
                await this.options.client.completeRuntimeDelivery(this.options.nodeId, delivery.id, {
                    instance_id: this.options.instanceId,
                    claim_token: claimToken,
                    status: 'retry',
                    error: error instanceof Error ? error.message : String(error),
                    retry_delay_seconds: deliveryRetryDelaySeconds(delivery.attempt),
                }, this.abortController.signal);
            }
            catch {
                // The delivery lease expires and the same idempotency key is retried.
            }
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
    get dispatchLeaseSeconds() {
        return this.options.dispatchLeaseSeconds ?? 120;
    }
    get dispatchRenewIntervalMs() {
        return this.options.dispatchRenewIntervalMs ?? Math.max(1_000, Math.floor(this.dispatchLeaseSeconds * 1_000 / 3));
    }
    get deliveryLeaseSeconds() {
        return this.options.deliveryLeaseSeconds ?? 60;
    }
}
function schedule(callback, delay, signal) {
    if (signal.aborted)
        return null;
    const timer = setTimeout(callback, delay);
    timer.unref?.();
    return timer;
}
function sleep(ms, signal) {
    return new Promise((resolve, reject) => {
        if (signal.aborted) {
            reject(signal.reason);
            return;
        }
        const timer = setTimeout(resolve, ms);
        timer.unref?.();
        signal.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(signal.reason);
        }, { once: true });
    });
}
function asRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? value
        : null;
}
function stringValue(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}
function deliveryRetryDelaySeconds(attempt) {
    return Math.min(300, Math.max(5, 2 ** Math.min(Math.max(attempt, 1), 8)));
}
//# sourceMappingURL=node-worker.js.map