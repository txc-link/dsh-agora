import { describe, expect, it } from 'vitest';
import type { IRoutineRepository, RoutineDto, RoutineRunDto, RoutineStatusDto } from '@agora-ts/contracts';
import { RoutineService } from './routine-service.js';

describe('RoutineService', () => {
  it('creates a versioned-safe routine and claims durable runs', () => {
    const routines: RoutineDto[] = []; const runs: RoutineRunDto[] = [];
    const repository: IRoutineRepository = {
      getById: (id: string) => routines.find((r) => r.routine_id === id) ?? null,
      insert: (r: RoutineDto) => { routines.push(r); return r; }, list: () => routines,
      updateStatus: (id: string, status: RoutineStatusDto, updatedAt: string) => { const r = routines.find((x) => x.routine_id === id); if (!r) return null; r.status = status; r.updated_at = updatedAt; return r; },
      claimDue: (input) => { const r = routines[0]; if (!r) return []; const run: RoutineRunDto = { id: 'run-1', routine_id: r.routine_id, scheduled_for: r.next_run_at, status: 'claimed', consumer_ref: input.consumer_ref, lease_token: 'lease-1', lease_expires_at: input.lease_expires_at, attempt_count: 1, error: null, runtime_dispatch_id: null, result: null, artifact_id: null, delivery_status: 'pending', delivery_error: null, created_at: input.now, updated_at: input.now }; runs.push(run); return [run]; },
      attachDispatch: () => null, markSucceeded: (id: string) => runs.find((r) => r.id === id) ?? null, markFailed: () => null,
      updateArtifact: () => null, updateDelivery: () => null, listRuns: () => runs,
    };
    const service = new RoutineService({ repository, now: () => new Date('2026-09-01T00:00:00.000Z'), leaseTokenGenerator: () => 'lease-1' });
    const routine = service.create({ routine_id: 'routine:morning', owner_ref: 'human:ceo', agent_ref: 'agent:assistant', role_ref: 'assistant', name: '晨报', prompt: '生成晨报', schedule: { kind: 'interval', interval_seconds: 3600 }, first_run_at: '2026-09-01T00:00:00.000Z', target_domain: 'domain:company', delivery_binding_ref: 'room:briefing' });
    expect(routine.status).toBe('active');
    expect(service.claimDue({ consumer_ref: 'matrix:node-home-linux' })[0]?.routine_id).toBe('routine:morning');
  });
});
