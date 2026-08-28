import { describe, expect, it, vi } from 'vitest';
import { buildApp } from './app.js';

const heartbeat = {
  protocol: 'dsh-agora.node/v1' as const,
  instance_id: 'instance-1',
  plugin_version: '0.2.0',
  host_framework: 'deepseek-harness' as const,
  runtime_provider: 'dsh' as const,
  agents: [{
    agent_ref: 'default',
    display_name: 'Default agent',
    roles: ['worker'],
    capabilities: ['session.resume'],
  }],
  bots: [],
  capacity: { max_concurrent: 2, active: 0 },
  lease_seconds: 90,
};

const node = {
  ...heartbeat,
  node_id: 'web-1',
  presence: 'online' as const,
  registered_at: '2026-08-26T01:00:00.000Z',
  last_seen_at: '2026-08-26T01:00:00.000Z',
  expires_at: '2026-08-26T01:01:30.000Z',
};

const pendingDispatch = {
  id: 'dispatch-1',
  node_id: 'web-1',
  task_id: null,
  participant_binding_id: null,
  runtime_target_ref: 'dsh:web-1:default',
  session_id: null,
  workspace_alias: null,
  agent_preset: null,
  prompt: 'Review the task.',
  idempotency_key: 'review-1',
  metadata: null,
  status: 'pending' as const,
  claimed_by: null,
  claim_token: null,
  claim_expires_at: null,
  attempt: 0,
  claimed_at: null,
  claim_renewed_at: null,
  latest_progress: null,
  progress_updated_at: null,
  result: null,
  result_envelope: null,
  error: null,
  created_at: '2026-08-26T01:00:01.000Z',
  updated_at: '2026-08-26T01:00:01.000Z',
  completed_at: null,
};

const pendingDelivery = {
  id: 'delivery-1',
  dispatch_id: 'dispatch-1',
  node_id: 'web-1',
  payload: { protocol: 'dsh-agora.presentation/v1', text: 'done' },
  status: 'pending' as const,
  attempt: 0,
  claimed_by: null,
  claim_token: null,
  claim_expires_at: null,
  next_attempt_at: '2026-08-26T01:00:05.000Z',
  receipt: null,
  error: null,
  created_at: '2026-08-26T01:00:05.000Z',
  updated_at: '2026-08-26T01:00:05.000Z',
  delivered_at: null,
};

describe('runtime node routes', () => {
  it('returns 503 when the registry is not configured', async () => {
    const app = buildApp({});
    const response = await app.inject({ method: 'GET', url: '/api/runtime-nodes' });
    expect(response.statusCode).toBe(503);
  });

  it('maps heartbeat and dispatch lifecycle requests to the registry', async () => {
    const claimed = {
      ...pendingDispatch,
      status: 'claimed' as const,
      claimed_by: 'instance-1',
      claim_token: 'claim-1',
      claim_expires_at: '2026-08-26T01:02:01.000Z',
      attempt: 1,
      claimed_at: '2026-08-26T01:00:01.000Z',
      claim_renewed_at: '2026-08-26T01:00:01.000Z',
    };
    const completed = {
      ...claimed,
      status: 'completed' as const,
      session_id: 'session-1',
      claim_expires_at: null,
      result: { answer: 'done' },
      completed_at: '2026-08-26T01:00:05.000Z',
    };
    const progressEvent = {
      id: 'progress-1',
      dispatch_id: 'dispatch-1',
      node_id: 'web-1',
      instance_id: 'instance-1',
      attempt: 1,
      sequence: 1,
      phase: 'response_started',
      message: 'Agent started responding',
      percent: 60,
      details: null,
      created_at: '2026-08-26T01:00:03.000Z',
    };
    const claimedDelivery = {
      ...pendingDelivery,
      status: 'claimed' as const,
      attempt: 1,
      claimed_by: 'instance-1',
      claim_token: 'delivery-claim-1',
      claim_expires_at: '2026-08-26T01:03:05.000Z',
    };
    const delivered = {
      ...claimedDelivery,
      status: 'delivered' as const,
      claim_expires_at: null,
      receipt: { provider_message_refs: ['message-1'] },
      delivered_at: '2026-08-26T01:00:06.000Z',
    };
    const service = {
      heartbeat: vi.fn(() => node),
      listNodes: vi.fn(() => [node]),
      getNode: vi.fn(() => node),
      removeNode: vi.fn(() => true),
      createDispatch: vi.fn(() => pendingDispatch),
      listDispatches: vi.fn(() => [pendingDispatch]),
      getDispatch: vi.fn(() => pendingDispatch),
      claimDispatch: vi.fn(() => claimed),
      renewDispatch: vi.fn(() => claimed),
      recordDispatchProgress: vi.fn(() => progressEvent),
      listDispatchProgress: vi.fn(() => [progressEvent]),
      completeDispatch: vi.fn(() => completed),
      claimDelivery: vi.fn(() => claimedDelivery),
      completeDelivery: vi.fn(() => delivered),
    };
    const app = buildApp({ runtimeNodeRegistryService: service as never });

    const heartbeated = await app.inject({
      method: 'PUT',
      url: '/api/runtime-nodes/web-1/heartbeat',
      payload: heartbeat,
    });
    expect(heartbeated.statusCode).toBe(200);
    expect(service.heartbeat).toHaveBeenCalledWith('web-1', heartbeat);

    const created = await app.inject({
      method: 'POST',
      url: '/api/runtime-nodes/web-1/dispatches',
      payload: {
        runtime_target_ref: 'dsh:web-1:default',
        prompt: 'Review the task.',
        idempotency_key: 'review-1',
      },
    });
    expect(created.statusCode).toBe(201);

    const claimedResponse = await app.inject({
      method: 'POST',
      url: '/api/runtime-nodes/web-1/dispatches/claim',
      payload: { instance_id: 'instance-1', lease_seconds: 120 },
    });
    expect(claimedResponse.json()).toEqual({ dispatch: claimed });

    const renewedResponse = await app.inject({
      method: 'POST',
      url: '/api/runtime-nodes/web-1/dispatches/dispatch-1/renew',
      payload: { instance_id: 'instance-1', claim_token: 'claim-1', lease_seconds: 120 },
    });
    expect(renewedResponse.statusCode).toBe(200);
    expect(service.renewDispatch).toHaveBeenCalledWith('web-1', 'dispatch-1', {
      instance_id: 'instance-1', claim_token: 'claim-1', lease_seconds: 120,
    });

    const progressResponse = await app.inject({
      method: 'POST',
      url: '/api/runtime-nodes/web-1/dispatches/dispatch-1/progress',
      payload: {
        instance_id: 'instance-1',
        claim_token: 'claim-1',
        sequence: 1,
        phase: 'response_started',
        message: 'Agent started responding',
        percent: 60,
      },
    });
    expect(progressResponse.statusCode).toBe(201);
    expect(progressResponse.json()).toEqual(progressEvent);

    const progressHistoryResponse = await app.inject({
      method: 'GET',
      url: '/api/runtime-dispatches/dispatch-1/progress',
    });
    expect(progressHistoryResponse.json()).toEqual({ events: [progressEvent] });

    const completedResponse = await app.inject({
      method: 'POST',
      url: '/api/runtime-nodes/web-1/dispatches/dispatch-1/complete',
      payload: {
        instance_id: 'instance-1',
        claim_token: 'claim-1',
        status: 'completed',
        session_id: 'session-1',
        result: { answer: 'done' },
      },
    });
    expect(completedResponse.statusCode).toBe(200);
    expect(completedResponse.json()).toMatchObject({ status: 'completed', session_id: 'session-1' });

    const claimedDeliveryResponse = await app.inject({
      method: 'POST',
      url: '/api/runtime-nodes/web-1/deliveries/claim',
      payload: { instance_id: 'instance-1', lease_seconds: 60 },
    });
    expect(claimedDeliveryResponse.json()).toEqual({ delivery: claimedDelivery });

    const deliveredResponse = await app.inject({
      method: 'POST',
      url: '/api/runtime-nodes/web-1/deliveries/delivery-1/complete',
      payload: {
        instance_id: 'instance-1',
        claim_token: 'delivery-claim-1',
        status: 'delivered',
        receipt: { provider_message_refs: ['message-1'] },
      },
    });
    expect(deliveredResponse.statusCode).toBe(200);
    expect(deliveredResponse.json()).toMatchObject({ status: 'delivered' });
  });
});
