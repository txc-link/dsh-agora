import { describe, expect, it } from 'vitest';
import type { RuntimeNodeDto, RuntimeNodeHeartbeatRequestDto } from '@agora-ts/contracts';
import { RuntimeNodeRegistryService } from './runtime-node-registry-service.js';

const makeRepo = () => {
  const nodes = new Map<string, RuntimeNodeDto>();
  return {
    getNode: (id: string) => nodes.get(id) ?? null,
    upsertNode: (id: string, input: RuntimeNodeHeartbeatRequestDto) => {
      const now = new Date().toISOString();
      const value = { ...input, node_id: id, presence: 'online' as const, registered_at: nodes.get(id)?.registered_at ?? now, last_seen_at: now, expires_at: new Date(Date.now() + input.lease_seconds * 1000).toISOString() };
      nodes.set(id, value); return value;
    },
    listNodes: () => [...nodes.values()],
    nodes,
  };
};
const beat = (instance_id: string): RuntimeNodeHeartbeatRequestDto => ({ protocol: 'dsh-agora.node/v1', instance_id, plugin_version: '0.7.0', host_framework: 'deepseek-harness', runtime_provider: 'dsh', agents: [{ agent_ref: 'assistant', roles: [], capabilities: [] }], bots: [], capacity: { max_concurrent: 1, active: 0 }, lease_seconds: 30 });

describe('three-node fault recovery contract', () => {
  it('keeps node identities idempotent across duplicate heartbeats and restart', () => {
    const repo = makeRepo(); const service = new RuntimeNodeRegistryService(repo as never);
    for (const id of ['node-mac', 'node-home-linux', 'node-work-windows']) service.heartbeat(id, beat(`${id}-1`));
    expect(service.listNodes()).toHaveLength(3);
    service.heartbeat('node-mac', beat('node-mac-1'));
    expect(service.listNodes()).toHaveLength(3);
    repo.nodes.set('node-work-windows', { ...repo.nodes.get('node-work-windows')!, presence: 'stale' });
    service.heartbeat('node-work-windows', beat('node-work-windows-2'));
    expect(service.getNode('node-work-windows').presence).toBe('online');
  });
});
