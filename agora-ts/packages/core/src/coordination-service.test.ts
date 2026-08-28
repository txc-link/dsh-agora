import { afterEach, describe, expect, it } from 'vitest';
import { createAgoraDatabase, runMigrations, CoordinationRepository, RuntimeNodeRepository, type AgoraDatabase } from '@agora-ts/db';
import { createCoordinationRunRequestSchema, type RuntimeResultEnvelopeDto } from '@agora-ts/contracts';
import { CoordinationService, synthesize } from './coordination-service.js';
import { RuntimeNodeRegistryService } from './runtime-node-registry-service.js';

const databases: AgoraDatabase[] = [];

afterEach(() => {
  while (databases.length > 0) databases.pop()?.close();
});

describe('CoordinationService', () => {
  it('fans out within budget and records conflicts, drift, and scorecards', () => {
    const db = createAgoraDatabase({ dbPath: ':memory:' });
    databases.push(db);
    runMigrations(db);
    const runtimeRepository = new RuntimeNodeRepository(db);
    const runtimeNodes = new RuntimeNodeRegistryService(runtimeRepository);
    runtimeNodes.heartbeat('web-1', heartbeat(['alpha', 'beta', 'gamma']));
    const repository = new CoordinationRepository(db);
    const service = new CoordinationService({ repository, runtimeNodes });

    const run = service.createRun(createCoordinationRunRequestSchema.parse({
      prompt: 'Measure the repository smoke scripts.',
      mode: 'fanout',
      candidates: ['alpha', 'beta', 'gamma'].map(agent => ({ runtime_target_ref: `dsh:web-1:${agent}` })),
      budget: { max_agents: 2, max_dispatches: 2 },
      idempotency_key: 'coordination-test-fanout',
    }));

    expect(run.members).toHaveLength(2);
    completeNext(runtimeNodes, 'alpha', envelope('17 smoke scripts', 'rev-a', 'e-alpha'));
    completeNext(runtimeNodes, 'beta', envelope('21 smoke scripts', 'rev-b', 'e-beta'));

    const completed = service.reconcileRun(run.id);
    expect(completed.status).toBe('completed');
    expect(completed.synthesis?.conflicts.map(item => item.kind)).toEqual(expect.arrayContaining([
      'claim_conflict',
      'environment_drift',
    ]));
    expect(repository.listScorecards(undefined, 'general')).toHaveLength(2);
    expect(repository.listScorecards(undefined, 'general')[0]?.observations).toBe(1);
  });

  it('stops a run when reported token usage exceeds its budget', () => {
    const db = createAgoraDatabase({ dbPath: ':memory:' });
    databases.push(db);
    runMigrations(db);
    const runtimeNodes = new RuntimeNodeRegistryService(new RuntimeNodeRepository(db));
    runtimeNodes.heartbeat('web-1', heartbeat(['alpha']));
    const service = new CoordinationService({ repository: new CoordinationRepository(db), runtimeNodes });
    const run = service.createRun(createCoordinationRunRequestSchema.parse({
      prompt: 'Do bounded work.',
      mode: 'single',
      candidates: [{ runtime_target_ref: 'dsh:web-1:alpha' }],
      budget: { max_tokens: 10 },
      idempotency_key: 'coordination-test-token-budget',
    }));

    completeNext(runtimeNodes, 'alpha', {
      ...envelope('done', 'rev-a', 'e-alpha'),
      usage: { input_tokens: 80, output_tokens: 20, total_tokens: 100, tool_calls: 1, cost_usd: 0.01, duration_ms: 50 },
    });

    expect(service.reconcileRun(run.id)).toMatchObject({
      status: 'budget_exhausted',
      stop_reason: 'max_tokens reached',
    });
  });

  it('does not create an additional council round when information gain is below policy', () => {
    const db = createAgoraDatabase({ dbPath: ':memory:' }); databases.push(db); runMigrations(db);
    const runtimeNodes = new RuntimeNodeRegistryService(new RuntimeNodeRepository(db));
    runtimeNodes.heartbeat('web-1', heartbeat(['alpha', 'beta', 'verifier']));
    const service = new CoordinationService({ repository: new CoordinationRepository(db), runtimeNodes });
    const run = service.createRun(createCoordinationRunRequestSchema.parse({
      prompt: 'Find independent evidence.', mode: 'council',
      candidates: ['alpha', 'beta', 'verifier'].map(agent => ({ runtime_target_ref: `dsh:web-1:${agent}` })),
      budget: { max_agents: 3, max_dispatches: 3, min_information_gain: 0.75 }, idempotency_key: 'coordination-low-gain',
    }));
    const shared = envelope('Same result', 'rev-a', 'shared-evidence');
    completeNext(runtimeNodes, 'alpha', shared);
    completeNext(runtimeNodes, 'beta', shared);

    const completed = service.reconcileRun(run.id);
    expect(completed.status).toBe('completed');
    expect(completed.members).toHaveLength(2);
    expect(completed.stop_reason).toMatch(/information gain/u);
  });

  it('rejects reuse of an idempotency key with a different request', () => {
    const db = createAgoraDatabase({ dbPath: ':memory:' }); databases.push(db); runMigrations(db);
    const runtimeNodes = new RuntimeNodeRegistryService(new RuntimeNodeRepository(db));
    runtimeNodes.heartbeat('web-1', heartbeat(['alpha']));
    const service = new CoordinationService({ repository: new CoordinationRepository(db), runtimeNodes });
    const request = createCoordinationRunRequestSchema.parse({
      prompt: 'First request', mode: 'single', candidates: [{ runtime_target_ref: 'dsh:web-1:alpha' }],
      idempotency_key: 'coordination-idempotency-conflict',
    });
    service.createRun(request);

    expect(() => service.createRun({ ...request, prompt: 'Different request' })).toThrow(/different request/u);
  });

  it('does not overbook multiple agents on a node beyond its advertised free capacity', () => {
    const db = createAgoraDatabase({ dbPath: ':memory:' }); databases.push(db); runMigrations(db);
    const runtimeNodes = new RuntimeNodeRegistryService(new RuntimeNodeRepository(db));
    runtimeNodes.heartbeat('web-1', { ...heartbeat(['alpha', 'beta']), capacity: { max_concurrent: 1, active: 0 } });
    const service = new CoordinationService({ repository: new CoordinationRepository(db), runtimeNodes });
    const run = service.createRun(createCoordinationRunRequestSchema.parse({
      prompt: 'Respect node capacity', mode: 'fanout',
      candidates: ['alpha', 'beta'].map(agent => ({ runtime_target_ref: `dsh:web-1:${agent}` })),
      budget: { max_agents: 2, max_dispatches: 2 }, idempotency_key: 'coordination-node-capacity',
    }));

    expect(run.members).toHaveLength(1);
  });

  it('persists cancelled member states and their terminal observations', () => {
    const db = createAgoraDatabase({ dbPath: ':memory:' }); databases.push(db); runMigrations(db);
    const repository = new CoordinationRepository(db);
    const runtimeNodes = new RuntimeNodeRegistryService(new RuntimeNodeRepository(db));
    runtimeNodes.heartbeat('web-1', heartbeat(['alpha']));
    const service = new CoordinationService({ repository, runtimeNodes });
    const run = service.createRun(createCoordinationRunRequestSchema.parse({
      prompt: 'Cancel this request', mode: 'single', candidates: [{ runtime_target_ref: 'dsh:web-1:alpha' }],
      idempotency_key: 'coordination-cancel-observation',
    }));

    const cancelled = service.cancelRun(run.id, 'operator cancelled');
    expect(cancelled.members[0]?.status).toBe('cancelled');
    expect(repository.listScorecards('dsh:web-1:alpha', 'general')[0]).toMatchObject({
      observations: 1,
      success_rate: 0,
      cancellation_rate: 1,
    });
  });
});

describe('synthesize', () => {
  it('flags claims without linked evidence', () => {
    const member = {
      id: 'member-1', run_id: 'run-1', dispatch_id: 'dispatch-1', runtime_target_ref: 'dsh:web:alpha',
      role: 'primary' as const, round: 1, status: 'completed' as const, selection_score: 50,
      selection_reason: [], result_envelope: { ...envelope('answer', 'rev-a', 'e-1'), claims: [{ id: 'claim-1', statement: 'Unverified statement', evidence_ids: [] }] },
      usage: null, observation_recorded_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), completed_at: new Date().toISOString(),
    };
    expect(synthesize([member]).conflicts).toContainEqual(expect.objectContaining({ kind: 'unsupported_claim' }));
  });
});

function heartbeat(agentRefs: string[]) {
  return {
    protocol: 'dsh-agora.node/v1' as const,
    instance_id: 'instance-1',
    plugin_version: '0.6.0',
    host_framework: 'deepseek-harness' as const,
    runtime_provider: 'dsh' as const,
    agents: agentRefs.map(agent_ref => ({ agent_ref, roles: ['worker'], capabilities: ['repository.inspect'] })),
    bots: [],
    capacity: { max_concurrent: 4, active: 0 },
    lease_seconds: 300,
  };
}

function completeNext(runtimeNodes: RuntimeNodeRegistryService, agentRef: string, result: RuntimeResultEnvelopeDto): void {
  const claimed = runtimeNodes.claimDispatch('web-1', 'instance-1', 120);
  expect(claimed?.runtime_target_ref).toBe(`dsh:web-1:${agentRef}`);
  runtimeNodes.completeDispatch('web-1', claimed!.id, {
    instance_id: 'instance-1',
    claim_token: claimed!.claim_token!,
    status: 'completed',
    result_envelope: result,
  });
}

function envelope(statement: string, revision: string, evidenceId: string): RuntimeResultEnvelopeDto {
  return {
    schema: 'agora.runtime-result/v1',
    answer: statement,
    claims: [{ id: `claim-${evidenceId}`, statement, evidence_ids: [evidenceId] }],
    evidence: [{ id: evidenceId, kind: 'measurement', label: statement }],
    environment: { runtime_provider: 'dsh', workspace_alias: 'agora', revision },
    usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15, tool_calls: 1, cost_usd: 0.001, duration_ms: 100 },
  };
}
