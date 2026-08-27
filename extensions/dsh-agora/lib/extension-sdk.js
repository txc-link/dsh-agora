export const DSH_AGORA_EXTENSION_PROTOCOL = 'dsh-agora.extension/v1';
export const DSH_AGORA_RUNTIME_PROTOCOL = 'dsh-agora.runtime/v1';
export class DshAgoraExtensionRegistry {
    extensions = new Map();
    registerExtension(extension) {
        validateExtension(extension);
        if (this.extensions.has(extension.id))
            throw new Error(`dsh-agora extension "${extension.id}" is already registered`);
        const frozen = Object.freeze({
            ...extension,
            capabilities: Object.freeze(unique(extension.capabilities)),
        });
        this.extensions.set(frozen.id, frozen);
        return () => {
            if (this.extensions.get(frozen.id) === frozen)
                this.extensions.delete(frozen.id);
        };
    }
    listExtensions() {
        return [...this.extensions.values()].sort((left, right) => left.id.localeCompare(right.id));
    }
    runtimeForTarget(runtimeTargetRef) {
        const agentRef = runtimeTargetRef.split(':').at(-1);
        if (!agentRef)
            return null;
        for (const extension of this.extensions.values()) {
            if (!extension.runtime)
                continue;
            // The built-in DSH adapter owns all dsh:<node>:<agent> targets. Third-party
            // adapters can opt into a narrower target through their own execute guard.
            if (extension.capabilities.includes('runtime.execute'))
                return extension.runtime;
        }
        return null;
    }
}
function validateExtension(extension) {
    if (extension.protocol !== DSH_AGORA_EXTENSION_PROTOCOL) {
        throw new TypeError(`extension protocol must be ${DSH_AGORA_EXTENSION_PROTOCOL}`);
    }
    if (!/^[a-z0-9][a-z0-9._-]{0,127}$/u.test(extension.id))
        throw new TypeError('extension id is invalid');
    if (!Array.isArray(extension.capabilities) || extension.capabilities.some(value => typeof value !== 'string' || value.trim() === '')) {
        throw new TypeError('extension capabilities must be non-empty strings');
    }
    if (extension.runtime !== undefined && extension.runtime.protocol !== DSH_AGORA_RUNTIME_PROTOCOL) {
        throw new TypeError(`runtime adapter protocol must be ${DSH_AGORA_RUNTIME_PROTOCOL}`);
    }
}
function unique(values) {
    return [...new Set(values.map(value => value.trim()).filter(Boolean))].sort();
}
//# sourceMappingURL=extension-sdk.js.map