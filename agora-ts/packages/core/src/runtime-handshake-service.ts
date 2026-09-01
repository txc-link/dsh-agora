import type { RuntimeHandshakeRequestDto, RuntimeHandshakeResponseDto } from '@agora-ts/contracts';

export interface RuntimeHandshakePolicy { protocol: string; coreVersion: string; minPluginVersion: string; requiredCapabilities?: readonly string[] }

export class RuntimeHandshakeService {
  constructor(private readonly policy: RuntimeHandshakePolicy) {}
  negotiate(input: RuntimeHandshakeRequestDto): RuntimeHandshakeResponseDto {
    const required = this.policy.requiredCapabilities ?? [];
    const missing = required.filter((item) => !input.capabilities.includes(item));
    const protocolOk = input.protocol === this.policy.protocol;
    const versionOk = compareVersions(input.plugin_version, this.policy.minPluginVersion) >= 0;
    const compatible = protocolOk && versionOk && missing.length === 0;
    const reason = compatible ? null : !protocolOk ? `unsupported protocol: ${input.protocol}` : !versionOk
      ? `plugin version ${input.plugin_version} is below minimum ${this.policy.minPluginVersion}`
      : `missing capabilities: ${missing.join(', ')}`;
    return { compatible, protocol: this.policy.protocol, core_version: this.policy.coreVersion,
      min_plugin_version: this.policy.minPluginVersion, required_capabilities: [...required], missing_capabilities: missing, reason };
  }
}

function compareVersions(left: string, right: string): number {
  const parse = (value: string) => value.replace(/^v/u, '').split('.').map((part) => Number(/^(\d+)/u.exec(part)?.[1] ?? 0));
  const a = parse(left); const b = parse(right);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) { const delta = (a[i] ?? 0) - (b[i] ?? 0); if (delta) return delta; }
  return 0;
}
