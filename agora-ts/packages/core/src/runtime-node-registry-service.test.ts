import { describe, expect, it, vi } from 'vitest';
import type { RuntimeNodeDto, RuntimeNodeHeartbeatRequestDto } from '@agora-ts/contracts';
import { RuntimeNodeRegistryService } from './runtime-node-registry-service.js';

const heartbeat: RuntimeNodeHeartbeatRequestDto = {
  protocol: 'dsh-agora.node/v1',
  instance_id: 'instance-new',
  plugin_version: '0.4.0',
  host_framework: 'deepseek-harness',
  runtime_provider: 'dsh',
  agents: [{ agent_ref: 'default', roles: [], capabilities: [] }],
  bots: [],
  capacity: { max_concurrent: 1, active: 0 },
  lease_seconds: 90,
};

function node(presence: 'online' | 'stale'): RuntimeNodeDto {
  return {
    ...heartbeat,
    instance_id: 'instance-current',
    node_id: 'web-1',
    presence,
    registered_at: '2026-08-26T01:00:00.000Z',
    last_seen_at: '2026-08-26T01:00:00.000Z',
    expires_at: '2026-08-26T01:01:30.000Z',
  };
}

describe('RuntimeNodeRegistryService node ownership', () => {
  it('rejects a different instance while the current node lease is online', () => {
    const repository = {
      getNode: vi.fn(() => node('online')),
      upsertNode: vi.fn(),
    };
    const service = new RuntimeNodeRegistryService(repository as never);

    expect(() => service.heartbeat('web-1', heartbeat)).toThrow(/owned by another live instance/);
    expect(repository.upsertNode).not.toHaveBeenCalled();
  });

  it('allows a different instance to take over after the node lease is stale', () => {
    const next = { ...node('online'), instance_id: heartbeat.instance_id };
    const repository = {
      getNode: vi.fn(() => node('stale')),
      upsertNode: vi.fn(() => next),
    };
    const service = new RuntimeNodeRegistryService(repository as never);

    expect(service.heartbeat('web-1', heartbeat)).toBe(next);
    expect(repository.upsertNode).toHaveBeenCalledWith('web-1', heartbeat);
  });
});
