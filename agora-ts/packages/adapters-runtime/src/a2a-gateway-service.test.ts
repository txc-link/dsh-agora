import { describe, expect, it, vi } from 'vitest';
import type { RuntimeNodeDispatchDto, RuntimeNodeDto } from '@agora-ts/contracts';
import { A2aGatewayService } from './a2a-gateway-service.js';

describe('A2aGatewayService', () => {
  it('projects runtime skills and maps message/send onto an asynchronous dispatch', () => {
    const dispatch = makeDispatch();
    const runtimeNodes = {
      listNodes: vi.fn(() => [makeNode()]),
      createDispatch: vi.fn(() => dispatch),
      getDispatch: vi.fn(() => dispatch),
      cancelDispatch: vi.fn(() => ({ ...dispatch, status: 'cancelled' as const })),
    };
    const service = new A2aGatewayService({ runtimeNodes, publicBaseUrl: 'https://agora.example' });

    expect(service.agentCard()).toMatchObject({
      supportedInterfaces: [{ url: 'https://agora.example/a2a', protocolVersion: '1.0' }],
      capabilities: { streaming: false, pushNotifications: false },
      skills: [{ id: 'dsh:web-1:alpha' }],
    });
    const task = service.sendMessage({
      message: { messageId: 'message-1', role: 'user', parts: [{ text: 'Inspect the repository' }] },
      configuration: { blocking: false },
      metadata: { runtimeTargetRef: 'dsh:web-1:alpha' },
    });
    expect(task).toMatchObject({ id: 'dispatch-1', status: { state: 'submitted' } });
    expect(runtimeNodes.createDispatch).toHaveBeenCalledWith('web-1', expect.objectContaining({
      prompt: 'Inspect the repository', idempotency_key: 'a2a:message-1',
      metadata: expect.objectContaining({ a2a_protocol_version: '1.0' }),
    }));
    expect(service.cancelTask('dispatch-1').status.state).toBe('cancelled');
  });

  it('rejects blocking requests because streaming and push are not advertised', () => {
    const service = new A2aGatewayService({
      runtimeNodes: { listNodes: () => [makeNode()], createDispatch: () => makeDispatch(), getDispatch: () => makeDispatch(), cancelDispatch: () => makeDispatch() },
      publicBaseUrl: 'https://agora.example',
    });
    expect(() => service.sendMessage({
      message: { messageId: 'message-1', role: 'user', parts: [{ text: 'work' }] },
      configuration: { blocking: true },
    })).toThrow(/blocking mode/u);
  });

  it('rejects unadvertised targets and does not allow metadata to replace protocol fields', () => {
    const runtimeNodes = {
      listNodes: () => [makeNode()], createDispatch: vi.fn(() => makeDispatch()),
      getDispatch: () => makeDispatch(), cancelDispatch: () => makeDispatch(),
    };
    const service = new A2aGatewayService({ runtimeNodes, publicBaseUrl: 'https://agora.example' });
    expect(() => service.sendMessage({
      message: { messageId: 'message-2', role: 'user', parts: [{ text: 'work' }] },
      configuration: { blocking: false }, metadata: { runtimeTargetRef: 'dsh:web-1:unknown' },
    })).toThrow(/not an advertised online skill/u);
    service.sendMessage({
      message: { messageId: 'message-3', role: 'user', parts: [{ text: 'work' }] },
      configuration: { blocking: false }, metadata: { runtimeTargetRef: 'dsh:web-1:alpha', a2a_protocol_version: 'spoofed' },
    });
    expect(runtimeNodes.createDispatch).toHaveBeenCalledWith('web-1', expect.objectContaining({
      metadata: expect.objectContaining({ a2a_protocol_version: '1.0' }),
    }));
  });
});

function makeNode(): RuntimeNodeDto {
  const now = new Date().toISOString();
  return {
    node_id: 'web-1', protocol: 'dsh-agora.node/v1', instance_id: 'instance-1', plugin_version: '0.6.0',
    host_framework: 'deepseek-harness', runtime_provider: 'dsh',
    agents: [{ agent_ref: 'alpha', display_name: 'Alpha', roles: ['reviewer'], capabilities: ['repository.inspect'] }],
    bots: [], capacity: { max_concurrent: 1, active: 0 }, metadata: null, lease_seconds: 90,
    presence: 'online', registered_at: now, last_seen_at: now, expires_at: now,
  };
}

function makeDispatch(): RuntimeNodeDispatchDto {
  const now = new Date().toISOString();
  return {
    id: 'dispatch-1', node_id: 'web-1', runtime_target_ref: 'dsh:web-1:alpha', prompt: 'work', idempotency_key: 'a2a:message-1',
    task_id: null, participant_binding_id: null, session_id: null, workspace_alias: null, agent_preset: null, metadata: null,
    status: 'pending', claimed_by: null, claim_token: null, claim_expires_at: null, attempt: 0, claimed_at: null,
    claim_renewed_at: null, latest_progress: null, progress_updated_at: null, result: null, result_envelope: null, error: null,
    created_at: now, updated_at: now, completed_at: null,
  };
}
