import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createAgoraDatabase,
  FederationRepository,
  HumanAccountRepository,
  HumanIdentityBindingRepository,
  runMigrations,
  type AgoraDatabase,
} from '@agora-ts/db';
import { HumanAccountService, RuntimeNodeCredentialService } from '@agora-ts/core';
import { buildApp } from './app.js';

const databases: AgoraDatabase[] = [];
afterEach(() => { while (databases.length > 0) databases.pop()?.close(); });

describe('coordination and federation routes', () => {
  it('validates and exposes coordination runs and scorecards', async () => {
    const now = new Date().toISOString();
    const createRun = vi.fn(input => ({
      id: 'run-1', task_id: input.task_id ?? null, task_type: input.task_type, prompt: input.prompt, mode: input.mode,
      status: 'running', candidates: input.candidates, verifier_target_ref: input.verifier_target_ref ?? null,
      budget: input.budget, usage: emptyUsage(), memory_scopes: input.memory_scopes, idempotency_key: input.idempotency_key,
      metadata: input.metadata ?? null, synthesis: null, stop_reason: null, deadline_at: now, created_at: now, updated_at: now,
      completed_at: null, members: [],
    }));
    const app = buildApp({
      coordinationService: {
        createRun,
        listRuns: vi.fn(() => []), getRun: vi.fn(), reconcileRun: vi.fn(), cancelRun: vi.fn(), listScorecards: vi.fn(() => []),
      } as never,
    });

    const response = await app.inject({
      method: 'POST', url: '/api/coordination-runs', payload: {
        prompt: 'Inspect the repository', mode: 'fanout',
        candidates: [{ runtime_target_ref: 'dsh:web-1:alpha' }], idempotency_key: 'route-test-1',
      },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ id: 'run-1', mode: 'fanout', budget: { max_agents: 4 } });
    expect(createRun).toHaveBeenCalledWith(expect.objectContaining({ memory_scopes: [], task_type: 'general' }));
    expect((await app.inject({ method: 'GET', url: '/api/agent-scorecards' })).statusCode).toBe(200);
  });

  it('serves a public Agent Card but requires bearer auth for A2A task operations', async () => {
    const card = {
      name: 'Agora', description: 'Federation',
      supportedInterfaces: [{ url: 'https://agora.example/a2a', protocolBinding: 'HTTP+JSON', protocolVersion: '1.0' }],
      provider: { organization: 'Agora', url: 'https://agora.example' }, version: '1.0.0',
      capabilities: { streaming: false, pushNotifications: false, extendedAgentCard: false },
      securitySchemes: { bearerAuth: { httpAuthSecurityScheme: { scheme: 'bearer' } } }, securityRequirements: [{ bearerAuth: [] }],
      defaultInputModes: ['text/plain'], defaultOutputModes: ['text/plain'], skills: [],
    };
    const cancelTask = vi.fn(id => ({
      id, contextId: 'context-1', status: { state: 'cancelled', timestamp: new Date().toISOString() },
      history: [], artifacts: [], metadata: null,
    }));
    const app = buildApp({
      apiAuth: { enabled: true, token: 'admin-token' },
      a2aGatewayService: { agentCard: () => card, sendMessage: vi.fn(), getTask: vi.fn(), cancelTask } as never,
    });

    expect((await app.inject({ method: 'GET', url: '/.well-known/agent-card.json' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/a2a/message:send', payload: {} })).statusCode).toBe(401);
    const cancelled = await app.inject({ method: 'POST', url: '/a2a/tasks/task-1:cancel', headers: { authorization: 'Bearer admin-token' } });
    expect(cancelled.statusCode).toBe(200);
    expect(cancelTask).toHaveBeenCalledWith('task-1');
  });

  it('accepts a scoped node token only for its node and granted operation', async () => {
    const db = createAgoraDatabase({ dbPath: ':memory:' }); databases.push(db); runMigrations(db);
    const credentials = new RuntimeNodeCredentialService(new FederationRepository(db));
    const issued = credentials.issue('web-1', { scopes: ['heartbeat'] });
    const heartbeat = vi.fn((nodeId, input) => {
      const now = new Date().toISOString();
      return { ...input, node_id: nodeId, presence: 'online', registered_at: now, last_seen_at: now, expires_at: now };
    });
    const app = buildApp({
      apiAuth: { enabled: true, token: 'admin-token' }, runtimeNodeCredentialService: credentials,
      runtimeNodeRegistryService: { heartbeat } as never,
    });
    const payload = {
      protocol: 'dsh-agora.node/v1', instance_id: 'instance-1', plugin_version: '0.6.0',
      host_framework: 'deepseek-harness', runtime_provider: 'dsh', agents: [{ agent_ref: 'alpha' }],
      bots: [], capacity: { max_concurrent: 1, active: 0 }, lease_seconds: 90,
    };

    expect((await app.inject({ method: 'PUT', url: '/api/runtime-nodes/web-1/heartbeat', headers: { authorization: `Bearer ${issued.token}` }, payload })).statusCode).toBe(200);
    expect((await app.inject({ method: 'PUT', url: '/api/runtime-nodes/web-2/heartbeat', headers: { authorization: `Bearer ${issued.token}` }, payload })).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url: '/api/runtime-nodes/web-1/dispatches/claim', headers: { authorization: `Bearer ${issued.token}` }, payload: { instance_id: 'instance-1', lease_seconds: 120 } })).statusCode).toBe(403);
  });

  it('reserves runtime-node credential management for a global bearer or dashboard admin', async () => {
    const db = createAgoraDatabase({ dbPath: ':memory:' }); databases.push(db); runMigrations(db);
    const credentials = new RuntimeNodeCredentialService(new FederationRepository(db));
    const accounts = new HumanAccountService({
      accountRepository: new HumanAccountRepository(db),
      identityBindingRepository: new HumanIdentityBindingRepository(db),
    });
    accounts.bootstrapAdmin({ username: 'admin', password: 'admin-pass' });
    accounts.createUser({ username: 'member', password: 'member-pass', role: 'member' });
    const app = buildApp({
      apiAuth: { enabled: true, token: 'control-token' },
      dashboardAuth: { enabled: true, method: 'session', allowedUsers: [], sessionTtlHours: 24 },
      humanAccountService: accounts,
      runtimeNodeCredentialService: credentials,
    });

    const login = await app.inject({
      method: 'POST', url: '/api/dashboard/session/login', payload: { username: 'member', password: 'member-pass' },
    });
    const setCookie = login.headers['set-cookie'];
    const memberCookie = Array.isArray(setCookie) ? setCookie[0] : String(setCookie);
    const denied = await app.inject({
      method: 'POST', url: '/api/runtime-nodes/web-1/credentials', headers: { cookie: memberCookie },
      payload: { scopes: ['heartbeat'] },
    });
    expect(denied.statusCode).toBe(403);

    const issued = await app.inject({
      method: 'POST', url: '/api/runtime-nodes/web-1/credentials', headers: { authorization: 'Bearer control-token' },
      payload: { scopes: ['heartbeat'], label: 'worker' },
    });
    expect(issued.statusCode).toBe(201);
    expect(issued.json()).toMatchObject({ credential: { node_id: 'web-1', scopes: ['heartbeat'] } });
  });

  it('does not let an API bearer impersonate a human merge approver', async () => {
    const decide = vi.fn();
    const app = buildApp({
      apiAuth: { enabled: true, token: 'admin-token' },
      mergeCoordinatorService: { decide } as never,
    });
    const response = await app.inject({
      method: 'POST', url: '/api/merge-proposals/proposal-1/decision',
      headers: { authorization: 'Bearer admin-token' }, payload: { decision: 'approve', reason: 'agent says okay' },
    });
    expect(response.statusCode).toBe(401);
    expect(decide).not.toHaveBeenCalled();
  });
});

function emptyUsage() {
  return { input_tokens: null, output_tokens: null, total_tokens: null, tool_calls: null, cost_usd: null, duration_ms: null };
}
