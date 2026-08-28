import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { AgoraClient } from './agora-client.js';
import { registerHttpApi } from './http-api.js';
import { registerImCommand } from './im-gateway.js';
import { discoverImBridge } from './im-bridge-v1.js';
import { DshAgoraService } from './service.js';
import { createAgoraTool } from './tool.js';
import { DshAgoraExtensionRegistry, DSH_AGORA_EXTENSION_PROTOCOL } from './extension-sdk.js';
import { HarnessRuntimeAdapter } from './harness-runtime.js';
import { RuntimeNodeWorker } from './node-worker.js';
export { AgoraApiError, AgoraClient } from './agora-client.js';
export { AgoraCommandParseError, executeAgoraCommand, parseAgoraCommand } from './command.js';
export * from './contracts.js';
export { API_PREFIX, handleHttpRequest, registerHttpApi } from './http-api.js';
export * from './im-gateway.js';
export * from './im-bridge-v1.js';
export * from './extension-sdk.js';
export * from './harness-runtime.js';
export { RuntimeNodeWorker } from './node-worker.js';
export { DshAgoraService } from './service.js';
export * from './tool.js';
export const name = 'dsh-agora';
// webServer is required for both the local Harness RPC adapter and the runtime
// node worker. Declaring it here also makes Cordis delay apply() until the web
// host is initialized instead of silently starting in command-only mode.
export const inject = ['commands', 'tools', 'webServer'];
const PLUGIN_VERSION = '0.4.0';
export function apply(ctx, config = {}) {
    const commandName = normalizeCommandName(config.commandName ?? 'agora');
    const nodeId = normalizeNodeId(config.nodeId ?? process.env.DSH_AGORA_NODE_ID ?? hostname());
    const webServer = safeGet(ctx, 'webServer');
    const imBridgeDiscovery = discoverImBridge(ctx, unique(config.imBridgeServices ?? ['dshImBridge', 'dshImAgoraBridge']));
    let activeImBridge = imBridgeDiscovery.bridge;
    let worker = null;
    const registry = new DshAgoraExtensionRegistry();
    const client = new AgoraClient({
        serverUrl: config.serverUrl ?? process.env.AGORA_SERVER_URL ?? 'http://127.0.0.1:18008',
        apiToken: config.apiToken ?? process.env.AGORA_API_TOKEN,
        timeoutMs: config.requestTimeoutMs,
    });
    const service = new DshAgoraService({
        client,
        commandName,
        defaultCreator: config.defaultCreator?.trim() || 'dsh',
        registry,
        imBridge: imBridgeDiscovery.bridge,
        nodeId,
    });
    service.setImBridgeStatus(imBridgeDiscovery.status);
    const refreshImBridge = () => {
        const discovery = discoverImBridge(ctx, unique(config.imBridgeServices ?? ['dshImBridge', 'dshImAgoraBridge']));
        // A bridge discovered by the optional Cordis injection below is scoped to
        // its child context and is intentionally not visible from this parent.
        // Do not let the legacy poller overwrite that live injected bridge.
        if (discovery.bridge === null && activeImBridge !== null)
            return;
        activeImBridge = discovery.bridge;
        service.setImBridge(discovery.bridge, discovery.status);
        worker?.setImBridge(discovery.bridge);
    };
    const imBridgeTimer = setInterval(refreshImBridge, 5_000);
    imBridgeTimer.unref?.();
    own(ctx, () => clearInterval(imBridgeTimer), 'dsh-agora: dsh-im bridge discovery');
    // Optional dependency: this child fiber stays pending when dsh-im is absent,
    // while the main dsh-agora plugin remains fully usable in headless mode. When
    // dsh-im appears or reloads, Cordis activates this callback automatically.
    ctx.inject?.(['dshImBridge'], bridgeCtx => {
        const discovery = discoverImBridge(bridgeCtx, ['dshImBridge']);
        if (discovery.bridge === null)
            return;
        activeImBridge = discovery.bridge;
        service.setImBridge(discovery.bridge, discovery.status);
        worker?.setImBridge(discovery.bridge);
        return () => {
            if (activeImBridge !== discovery.bridge)
                return;
            activeImBridge = null;
            worker?.setImBridge(null);
            service.setImBridge(null, {
                state: 'unavailable',
                reason: 'dsh-im.bridge/v1 provider was unloaded',
            });
        };
    });
    if (isWebServer(webServer) && Number.isInteger(webServer.port)) {
        const runtime = new HarnessRuntimeAdapter({
            baseUrl: `http://127.0.0.1:${webServer.port}`,
            agents: config.runtimeAgents ?? [{ id: 'default', displayName: 'DeepSeek Harness', workspace: process.cwd() }],
            ...(config.runtimeReplyTimeoutMs === undefined ? {} : { replyTimeoutMs: config.runtimeReplyTimeoutMs }),
        });
        const unregisterRuntime = service.registerExtension({
            protocol: DSH_AGORA_EXTENSION_PROTOCOL,
            id: 'dsh-runtime',
            kind: 'runtime',
            capabilities: ['runtime.execute', 'session.create', 'session.resume', 'session.prompt', 'session.cancel'],
            runtime,
        });
        own(ctx, unregisterRuntime, 'dsh-agora: built-in DSH runtime adapter');
    }
    const unregisterCommand = ctx.commands.register({
        name: commandName,
        description: 'create and inspect governed Agora tasks',
        input: { hint: '[health|nodes|agents|list|show|status|dispatch-status|create|dashboard|im]' },
        handler: invocation => service.executeCommand(invocation.rawInput, { actorId: invocation.agent.id ?? invocation.agent.session?.id ?? 'dsh' }, invocation.signal),
    });
    // commands.register() is already owned by the current Cordis effect. Keeping
    // the returned capability alive is enough; wrapping it would double-dispose.
    void unregisterCommand;
    // Primary IM-independent path: dsh-im only delivers text into a DSH Session;
    // the Agent uses this normal DSH tool and dsh-im relays the ordinary reply.
    const unregisterTool = ctx.tools.register(createAgoraTool(service));
    void unregisterTool;
    const imRegistration = registerImCommand(ctx, unique(config.imGatewayServices ?? ['dshImCommandGateway', 'dshImGateway']), {
        name: commandName,
        description: 'create and inspect governed Agora tasks',
        execute: invocation => service.executeCommand(invocation.rawInput, invocation, invocation.signal),
    });
    service.setImStatus(imRegistration.status);
    if (imRegistration.dispose !== undefined)
        own(ctx, imRegistration.dispose, 'dsh-agora: dsh-im command gateway');
    if (isWebServer(webServer)) {
        own(ctx, registerHttpApi(webServer, service, {
            accessToken: config.apiAccessToken ?? process.env.DSH_AGORA_API_TOKEN,
        }), 'dsh-agora: host API');
    }
    if (config.nodeEnabled !== false && isWebServer(webServer) && Number.isInteger(webServer.port)) {
        worker = new RuntimeNodeWorker({
            client,
            registry,
            nodeId,
            instanceId: randomUUID(),
            pluginVersion: PLUGIN_VERSION,
            ...(config.heartbeatIntervalMs === undefined ? {} : { heartbeatIntervalMs: config.heartbeatIntervalMs }),
            ...(config.dispatchPollIntervalMs === undefined ? {} : { dispatchPollIntervalMs: config.dispatchPollIntervalMs }),
            ...(config.nodeLeaseSeconds === undefined ? {} : { leaseSeconds: config.nodeLeaseSeconds }),
            ...(config.dispatchLeaseSeconds === undefined ? {} : { dispatchLeaseSeconds: config.dispatchLeaseSeconds }),
            ...(config.dispatchRenewIntervalMs === undefined ? {} : { dispatchRenewIntervalMs: config.dispatchRenewIntervalMs }),
            ...(config.deliveryPollIntervalMs === undefined ? {} : { deliveryPollIntervalMs: config.deliveryPollIntervalMs }),
            ...(config.deliveryLeaseSeconds === undefined ? {} : { deliveryLeaseSeconds: config.deliveryLeaseSeconds }),
            ...(config.maxConcurrent === undefined ? {} : { maxConcurrent: config.maxConcurrent }),
            imBridge: activeImBridge,
            ...(config.nodeMetadata === undefined ? {} : { metadata: config.nodeMetadata }),
            onStatus: status => service.setNodeStatus(status),
        });
        worker.start();
        own(ctx, () => worker?.stop(), 'dsh-agora: runtime node worker');
    }
    else {
        service.setNodeStatus({ state: 'disabled', nodeId });
    }
    ctx.accessor?.('dshAgora', { get: () => service });
}
function normalizeNodeId(value) {
    const nodeId = value.trim().toLowerCase().replace(/[^a-z0-9._-]+/gu, '-');
    if (!/^[a-z0-9][a-z0-9._-]{0,127}$/u.test(nodeId))
        throw new TypeError('nodeId is invalid');
    return nodeId;
}
function normalizeCommandName(value) {
    const name = value.trim().toLowerCase();
    if (!/^[a-z][a-z0-9-]*$/u.test(name))
        throw new TypeError('commandName must be lowercase letters, digits, or hyphens');
    return name;
}
function unique(values) {
    return [...new Set(values.map(value => value.trim()).filter(Boolean))];
}
function safeGet(ctx, name) {
    try {
        // Cordis accessors (such as the public dsh-im bridge) are resolved through
        // the context proxy, while ctx.get() only reads provided service values.
        const accessorValue = Reflect.get(ctx, name);
        if (accessorValue !== undefined)
            return accessorValue;
    }
    catch {
        // Unknown, non-injected proxy properties throw by design; fall through to
        // the provider lookup for ordinary Cordis services.
    }
    try {
        return ctx.get?.(name);
    }
    catch {
        return undefined;
    }
}
function isWebServer(value) {
    return typeof value === 'object' && value !== null && typeof value.register === 'function';
}
function own(ctx, dispose, label) {
    if (ctx.effect !== undefined)
        ctx.effect(() => dispose, label);
}
//# sourceMappingURL=index.js.map