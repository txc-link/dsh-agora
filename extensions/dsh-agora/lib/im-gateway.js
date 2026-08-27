export const DSH_IM_COMMAND_GATEWAY_PROTOCOL = 'dsh-im.command-gateway/v1';
export function registerImCommand(ctx, serviceNames, definition) {
    for (const serviceName of serviceNames) {
        const candidate = safeGet(ctx, serviceName);
        if (candidate === undefined)
            continue;
        if (!isGateway(candidate)) {
            return {
                status: {
                    state: 'incompatible',
                    service: serviceName,
                    reason: `service does not implement ${DSH_IM_COMMAND_GATEWAY_PROTOCOL}`,
                },
            };
        }
        try {
            return {
                status: { state: 'connected', service: serviceName, protocol: candidate.protocol },
                dispose: candidate.registerCommand(definition),
            };
        }
        catch (error) {
            return {
                status: {
                    state: 'incompatible',
                    service: serviceName,
                    reason: `gateway rejected command registration: ${error instanceof Error ? error.message : String(error)}`,
                },
            };
        }
    }
    return {
        status: {
            state: 'unavailable',
            reason: `no ${DSH_IM_COMMAND_GATEWAY_PROTOCOL} provider is installed`,
        },
    };
}
function safeGet(ctx, serviceName) {
    try {
        return ctx.get?.(serviceName);
    }
    catch {
        return undefined;
    }
}
function isGateway(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const candidate = value;
    return candidate.protocol === DSH_IM_COMMAND_GATEWAY_PROTOCOL && typeof candidate.registerCommand === 'function';
}
//# sourceMappingURL=im-gateway.js.map