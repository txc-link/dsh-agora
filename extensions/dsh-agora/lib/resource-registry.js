import { readFileSync } from 'node:fs';
const registryPath = () => process.env.PAOS_RESOURCE_REGISTRY_PATH ?? '/home/ailink/.dsh/resource-registry.json';
export function resolveResourceBindings(dispatch) {
    const configured = loadBindings(dispatch.metadata);
    const prompt = normalize(dispatch.prompt);
    return configured.filter(binding => binding.aliases.some(alias => prompt.includes(normalize(alias))));
}
export function formatResourceBindingContext(dispatch) {
    const matches = resolveResourceBindings(dispatch);
    if (matches.length === 0) {
        return [
            'Configured resource registry: no registered resource alias matched this task.',
            '- Treat unknown names as research subjects by default. Continue the research with the tools and sources already available; do not block a research task merely because the subject is not registered.',
            '- Ask the controller only when the task explicitly requires opening a new external system, crossing a security boundary, or obtaining a new credential.',
        ];
    }
    return [
        'Configured resource binding (administrator-authorized for this runtime):',
        ...matches.map(binding => [
            `- Canonical resource: ${binding.id} (${binding.kind})`,
            `- Aliases: ${binding.aliases.join(', ')}`,
            `- Location: ${binding.location}`,
            `- Allowed operations: ${binding.allowedOperations.join(', ')}`,
            `- Secret policy: ${binding.secretPolicy}; raw passwords, private keys, and tokens must never enter the reply or shared memory.`,
        ].join('\n')),
        '- This binding is the authorization context; do not require the user to provide a URL, API token, host_id, or vault path for these operations.',
    ];
}
function loadBindings(metadata) {
    const fromMetadata = parseBindings(metadata?.resource_bindings);
    if (fromMetadata.length > 0)
        return fromMetadata;
    try {
        const parsed = JSON.parse(readFileSync(registryPath(), 'utf8'));
        return parseBindings(parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? parsed.resources
            : parsed);
    }
    catch {
        return [];
    }
}
function parseBindings(value) {
    if (!Array.isArray(value))
        return [];
    return value.flatMap(item => {
        if (!item || typeof item !== 'object' || Array.isArray(item))
            return [];
        const record = item;
        const id = stringValue(record.id);
        const kind = stringValue(record.kind);
        const location = stringValue(record.location);
        const aliases = stringArray(record.aliases);
        const allowedOperations = stringArray(record.allowed_operations ?? record.allowedOperations);
        const secretPolicy = record.secret_policy === 'never' ? 'never' : 'handle_only';
        if (!id || !kind || !location || aliases.length === 0 || allowedOperations.length === 0)
            return [];
        return [{ id, kind, location, aliases, allowedOperations, secretPolicy }];
    });
}
function normalize(value) {
    return value.normalize('NFKC').trim().toLocaleLowerCase().replace(/[\s_-]+/gu, ' ');
}
function stringArray(value) {
    return Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim() !== '').map(item => item.trim()) : [];
}
function stringValue(value) {
    return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}
//# sourceMappingURL=resource-registry.js.map