import { describe, expect, it } from 'vitest';
import { RuntimeHandshakeService } from './runtime-handshake-service.js';

describe('RuntimeHandshakeService', () => {
  const service = new RuntimeHandshakeService({ protocol: 'dsh-agora.node/v1', coreVersion: '0.8.0', minPluginVersion: '0.7.0', requiredCapabilities: ['heartbeat', 'dispatch'] });
  const base = { node_id: 'node-mac', protocol: 'dsh-agora.node/v1', plugin_version: '0.7.1', instance_id: 'node-a-1', capabilities: ['heartbeat', 'dispatch'] };
  it('accepts compatible runtime', () => expect(service.negotiate(base)).toMatchObject({ compatible: true, missing_capabilities: [] }));
  it('rejects old versions and wrong protocol', () => {
    expect(service.negotiate({ ...base, plugin_version: '0.6.9' }).compatible).toBe(false);
    expect(service.negotiate({ ...base, protocol: 'other/v1' }).reason).toContain('unsupported protocol');
  });
  it('reports missing capabilities', () => expect(service.negotiate({ ...base, capabilities: ['heartbeat'] })).toMatchObject({ compatible: false, missing_capabilities: ['dispatch'] }));
});
