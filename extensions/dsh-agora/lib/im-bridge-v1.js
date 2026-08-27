export const DSH_IM_BRIDGE_PROTOCOL = 'dsh-im.bridge/v1';
export function discoverImBridge(ctx, serviceNames) {
    for (const serviceName of serviceNames) {
        const candidate = safeGet(ctx, serviceName);
        if (candidate === undefined)
            continue;
        if (!isBridge(candidate)) {
            return {
                status: {
                    state: 'incompatible', service: serviceName,
                    reason: `service does not implement ${DSH_IM_BRIDGE_PROTOCOL}`,
                },
                bridge: null,
            };
        }
        return {
            status: { state: 'connected', service: serviceName, protocol: candidate.protocol },
            bridge: candidate,
        };
    }
    return {
        status: { state: 'unavailable', reason: `no ${DSH_IM_BRIDGE_PROTOCOL} provider is installed` },
        bridge: null,
    };
}
function safeGet(ctx, name) {
    try {
        return ctx.get?.(name);
    }
    catch {
        return undefined;
    }
}
function isBridge(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const bridge = value;
    return bridge.protocol === DSH_IM_BRIDGE_PROTOCOL
        && typeof bridge.listBots === 'function'
        && typeof bridge.resolveSession === 'function'
        && typeof bridge.send === 'function';
}
//# sourceMappingURL=im-bridge-v1.js.map