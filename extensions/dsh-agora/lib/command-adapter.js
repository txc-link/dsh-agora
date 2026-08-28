export const DSH_AGORA_COMMAND_ADAPTER_PROTOCOL = 'dsh-agora.command-adapter/v1';
export class DshAgoraCommandAdapter {
    options;
    protocol = DSH_AGORA_COMMAND_ADAPTER_PROTOCOL;
    receipts = new Map();
    constructor(options) {
        this.options = options;
    }
    ingest(event, signal) {
        validateEvent(event);
        const existing = this.receipts.get(event.idempotency_key);
        if (existing)
            return existing;
        const pending = this.execute(event, signal);
        this.receipts.set(event.idempotency_key, pending);
        while (this.receipts.size > (this.options.receiptLimit ?? 2_048))
            this.receipts.delete(this.receipts.keys().next().value);
        pending.catch(() => {
            if (this.receipts.get(event.idempotency_key) === pending)
                this.receipts.delete(event.idempotency_key);
        });
        return pending;
    }
    async execute(event, signal) {
        const result = await this.options.execute(event.input, {
            actorId: event.actor_ref,
            ...(event.provider ? { provider: event.provider } : {}),
            ...(event.conversation_ref ? { conversationRef: event.conversation_ref } : {}),
            ...(event.thread_ref ? { threadRef: event.thread_ref } : {}),
        }, signal);
        const bridge = this.options.bridge();
        if (!event.reply?.enabled)
            return envelope(event, result, { sent: false, provider_message_refs: [], reason: 'reply disabled' });
        if (!bridge || !event.provider || !event.conversation_ref) {
            return envelope(event, result, { sent: false, provider_message_refs: [], reason: 'IM bridge or destination unavailable' });
        }
        try {
            const receipt = await bridge.send({
                provider: event.provider,
                conversation_ref: event.conversation_ref,
                ...(event.reply.bot_ref === undefined ? {} : { bot_ref: event.reply.bot_ref }),
                ...(event.thread_ref === undefined ? {} : { thread_ref: event.thread_ref }),
                text: result.text ?? (result.kind === 'success' ? 'Agora command completed.' : 'Agora command failed.'),
                idempotency_key: `command:${event.idempotency_key}`,
            });
            return envelope(event, result, { sent: true, provider_message_refs: receipt.provider_message_refs });
        }
        catch (error) {
            return envelope(event, result, {
                sent: false,
                provider_message_refs: [],
                reason: `IM delivery failed: ${error instanceof Error ? error.message : String(error)}`,
            });
        }
    }
}
function envelope(event, result, delivery) {
    return { protocol: DSH_AGORA_COMMAND_ADAPTER_PROTOCOL, idempotency_key: event.idempotency_key, result, delivery };
}
function validateEvent(event) {
    if (event.protocol !== DSH_AGORA_COMMAND_ADAPTER_PROTOCOL)
        throw new TypeError(`command event protocol must be ${DSH_AGORA_COMMAND_ADAPTER_PROTOCOL}`);
    for (const [name, value] of [['idempotency_key', event.idempotency_key], ['input', event.input], ['actor_ref', event.actor_ref]]) {
        if (typeof value !== 'string' || !value.trim())
            throw new TypeError(`${name} is required`);
    }
    if (event.reply?.enabled && (!event.provider || !event.conversation_ref))
        throw new TypeError('reply requires provider and conversation_ref');
}
//# sourceMappingURL=command-adapter.js.map