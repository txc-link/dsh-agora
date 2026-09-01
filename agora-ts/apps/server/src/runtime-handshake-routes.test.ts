import { describe, expect, it } from 'vitest';
import { RuntimeHandshakeService } from '@agora-ts/core';
import { buildApp } from './app.js';

describe('runtime handshake route', () => {
  it('negotiates plugin compatibility', async () => {
    const app = await buildApp({ runtimeHandshakeService: new RuntimeHandshakeService({ protocol: 'dsh-agora.node/v1', coreVersion: '0.8.0', minPluginVersion: '0.7.0' }) });
    const response = await app.inject({ method: 'POST', url: '/api/runtime-handshake', payload: { protocol: 'dsh-agora.node/v1', plugin_version: '0.7.0', instance_id: 'i', capabilities: [] } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ compatible: true, core_version: '0.8.0' });
    await app.close();
  });
});
