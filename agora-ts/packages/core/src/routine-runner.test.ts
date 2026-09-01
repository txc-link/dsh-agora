import { describe, expect, it } from 'vitest';
import type { IRoutineRepository, RoutineDto, RoutineRunDto, RoutineStatusDto } from '@agora-ts/contracts';
import { RoutineService } from './routine-service.js';
import { RoutineRunner, type RoutineDeliveryPort, type RoutineRuntimePort } from './routine-runner.js';

function buildRoutine(): RoutineDto {
  return {
    routine_id: 'routine:briefing', owner_ref: 'org:acme', agent_ref: 'dsh:node-a:assistant', role_ref: 'role:ea',
    name: '晨报', prompt: '汇总今日任务和冲突', schedule: { kind: 'interval', interval_seconds: 3_600 },
    first_run_at: '2026-09-01T00:00:00.000Z', next_run_at: '2026-09-01T00:00:00.000Z', last_run_at: null,
    target_domain: 'domain:company', delivery_binding_ref: '!briefing:example.org', status: 'active', metadata: {},
    created_at: '2026-09-01T00:00:00.000Z', updated_at: '2026-09-01T00:00:00.000Z',
  };
}

function memoryRepository(routine: RoutineDto, run: RoutineRunDto): IRoutineRepository {
  const runs = [run];
  return {
    getById: id => id === routine.routine_id ? routine : null,
    insert: value => value,
    list: () => [routine],
    updateStatus: (id: string, status: RoutineStatusDto, updatedAt: string) => {
      if (id !== routine.routine_id) return null;
      routine.status = status; routine.updated_at = updatedAt; return routine;
    },
    claimDue: () => [],
    attachDispatch: (id, leaseToken, dispatchId, updatedAt) => {
      const value = runs.find(item => item.id === id);
      if (!value || value.lease_token !== leaseToken || value.status !== 'claimed') return null;
      value.runtime_dispatch_id = dispatchId; value.updated_at = updatedAt; return value;
    },
    markSucceeded: (id, leaseToken, updatedAt, result) => {
      const value = runs.find(item => item.id === id);
      if (!value || value.lease_token !== leaseToken || value.status !== 'claimed') return null;
      value.status = 'succeeded'; value.result = result ?? null; value.lease_expires_at = null; value.updated_at = updatedAt; return value;
    },
    markFailed: (id, leaseToken, error, updatedAt) => {
      const value = runs.find(item => item.id === id);
      if (!value || value.lease_token !== leaseToken || value.status !== 'claimed') return null;
      value.status = 'failed'; value.error = error; value.lease_expires_at = null; value.updated_at = updatedAt; return value;
    },
    updateArtifact: (id, artifactId, updatedAt) => {
      const value = runs.find(item => item.id === id); if (!value) return null;
      value.artifact_id = artifactId; value.updated_at = updatedAt; return value;
    },
    updateDelivery: (id, status, error, updatedAt) => {
      const value = runs.find(item => item.id === id); if (!value) return null;
      value.delivery_status = status; value.delivery_error = error; value.updated_at = updatedAt; return value;
    },
    listRuns: filters => runs.filter(item => (!filters.routine_id || item.routine_id === filters.routine_id)
      && (!filters.status || item.status === filters.status)
      && (!filters.delivery_status || item.delivery_status === filters.delivery_status)),
  };
}

function claimedRun(): RoutineRunDto {
  return {
    id: 'run-1', routine_id: 'routine:briefing', scheduled_for: '2026-09-01T00:00:00.000Z', status: 'claimed',
    consumer_ref: 'runner-1', lease_token: 'lease-1', lease_expires_at: '2026-09-01T00:02:00.000Z', attempt_count: 1,
    runtime_dispatch_id: 'dispatch-1', result: null, artifact_id: null, delivery_status: 'pending', delivery_error: null,
    error: null, created_at: '2026-09-01T00:00:00.000Z', updated_at: '2026-09-01T00:00:00.000Z',
  };
}

describe('RoutineRunner', () => {
  it('reconciles a completed dispatch, writes an artifact and delivers the result', async () => {
    const routine = buildRoutine(); const run = claimedRun();
    const repository = memoryRepository(routine, run);
    const service = new RoutineService({ repository, now: () => new Date('2026-09-01T00:01:00.000Z') });
    const delivered: string[] = [];
    const runtime: RoutineRuntimePort = {
      resolveTarget: () => ({ node_id: 'node-a', runtime_target_ref: routine.agent_ref }),
      createDispatch: () => ({ id: 'dispatch-1' }),
      getDispatch: () => ({ id: 'dispatch-1', status: 'completed', result: { answer: '今日无冲突' }, result_envelope: null, error: null }),
    };
    const delivery: RoutineDeliveryPort = { deliver: async input => { delivered.push(`${input.bindingRef}:${input.text}`); } };
    const artifacts = { createMarkdown: (input: { name: string; content: string; ownerRef: string; metadata: Record<string, unknown> }) => {
      expect(input.ownerRef).toBe(run.id); expect(input.content).toBe('今日无冲突'); return { id: 'artifact-1' };
    } };
    const runner = new RoutineRunner({ routineService: service, repository, runtime, artifacts, delivery, consumerRef: 'runner-1', now: () => new Date('2026-09-01T00:01:00.000Z') });
    const result = await runner.runOnce();
    expect(result.completed).toBe(1); expect(result.delivered).toBe(1); expect(delivered).toEqual(['!briefing:example.org:今日无冲突']);
    expect(run.status).toBe('succeeded'); expect(run.artifact_id).toBe('artifact-1'); expect(run.delivery_status).toBe('delivered');
  });

  it('marks failed dispatches and keeps the failure auditable', async () => {
    const routine = buildRoutine(); const run = claimedRun();
    const repository = memoryRepository(routine, run);
    const service = new RoutineService({ repository, now: () => new Date('2026-09-01T00:01:00.000Z') });
    const runtime: RoutineRuntimePort = {
      resolveTarget: () => ({ node_id: 'node-a', runtime_target_ref: routine.agent_ref }),
      createDispatch: () => ({ id: 'dispatch-1' }),
      getDispatch: () => ({ id: 'dispatch-1', status: 'failed', result: null, result_envelope: null, error: 'agent offline' }),
    };
    const runner = new RoutineRunner({ routineService: service, repository, runtime, consumerRef: 'runner-1', now: () => new Date('2026-09-01T00:01:00.000Z') });
    const result = await runner.runOnce();
    expect(result.failed).toBe(1); expect(run.status).toBe('failed'); expect(run.error).toContain('agent offline');
  });

  it('retries a failed delivery without rerunning the agent', async () => {
    const routine = buildRoutine();
    const run = { ...claimedRun(), status: 'succeeded' as const, lease_token: null, lease_expires_at: null, result: { answer: '更新后的简报' }, delivery_status: 'failed' as const, delivery_error: 'timeout' };
    const repository = memoryRepository(routine, run);
    const service = new RoutineService({ repository, now: () => new Date('2026-09-01T00:01:00.000Z') });
    let count = 0;
    const delivery: RoutineDeliveryPort = { deliver: async () => { count += 1; } };
    const runner = new RoutineRunner({ routineService: service, repository, runtime: { resolveTarget: () => null, createDispatch: () => ({ id: 'unused' }), getDispatch: () => null }, delivery, consumerRef: 'runner-1', now: () => new Date('2026-09-01T00:01:00.000Z') });
    const result = await runner.runOnce();
    expect(result.delivered).toBe(1); expect(count).toBe(1); expect(run.delivery_status).toBe('delivered');
  });
});
