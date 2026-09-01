import { describe, expect, it } from 'vitest';
import type { RoutineDto } from '@agora-ts/contracts';
import { createAgoraDatabase, runMigrations } from './database.js';
import { RoutineRepository } from './repositories/routine.repository.js';

describe('RoutineRepository', () => {
  it('persists routines, claims due runs and closes a lease', () => {
    const db = createAgoraDatabase({ dbPath: ':memory:' });
    runMigrations(db);
    const repository = new RoutineRepository(db);
    const routine: RoutineDto = {
      routine_id: 'routine-1', owner_ref: 'org:acme', agent_ref: 'agent:ea', role_ref: 'role:assistant',
      name: 'morning brief', prompt: 'summarize priorities', schedule: { kind: 'interval', interval_seconds: 3600 },
      first_run_at: '2026-09-01T08:00:00.000Z', next_run_at: '2026-09-01T08:00:00.000Z', last_run_at: null,
      target_domain: 'work', delivery_binding_ref: 'matrix:room:briefing', status: 'active', metadata: {},
      created_at: '2026-09-01T07:00:00.000Z', updated_at: '2026-09-01T07:00:00.000Z',
    };
    repository.insert(routine);
    expect(repository.list({ owner_ref: 'org:acme' })).toHaveLength(1);
    const runs = repository.claimDue({
      now: '2026-09-01T08:01:00.000Z', consumer_ref: 'worker:1', lease_expires_at: '2026-09-01T08:05:00.000Z',
      limit: 5, lease_token_factory: () => 'lease-1',
    });
    expect(runs).toHaveLength(1);
    expect(runs[0]?.status).toBe('claimed');
    expect(repository.attachDispatch(runs[0]!.id, 'lease-1', 'dispatch-1', '2026-09-01T08:01:30.000Z')?.runtime_dispatch_id).toBe('dispatch-1');
    expect(repository.markSucceeded(runs[0]!.id, 'lease-1', '2026-09-01T08:02:00.000Z', { answer: 'done' })?.status).toBe('succeeded');
    expect(repository.markSucceeded(runs[0]!.id, 'lease-1', '2026-09-01T08:02:00.000Z', { answer: 'done' })).toBeNull();
    expect(repository.updateArtifact(runs[0]!.id, 'artifact-1', '2026-09-01T08:03:00.000Z')?.artifact_id).toBe('artifact-1');
    expect(repository.updateDelivery(runs[0]!.id, 'delivered', null, '2026-09-01T08:03:00.000Z')?.delivery_status).toBe('delivered');
    expect(repository.getById('routine-1')?.next_run_at).toBe('2026-09-01T09:00:00.000Z');
  });

  it('keeps daily schedules at their declared local time', () => {
    const db = createAgoraDatabase({ dbPath: ':memory:' });
    runMigrations(db);
    const repository = new RoutineRepository(db);
    repository.insert({
      routine_id: 'routine-daily', owner_ref: 'org:acme', agent_ref: 'agent:ea', role_ref: 'role:assistant', name: 'morning', prompt: 'brief',
      schedule: { kind: 'daily', local_time: '07:30', timezone: 'Asia/Shanghai' }, first_run_at: '2026-09-01T23:30:00.000Z', next_run_at: '2026-09-01T23:30:00.000Z',
      last_run_at: null, target_domain: 'work', delivery_binding_ref: 'matrix:room:briefing', status: 'active', metadata: {},
      created_at: '2026-09-01T00:00:00.000Z', updated_at: '2026-09-01T00:00:00.000Z',
    });
    const runs = repository.claimDue({ now: '2026-09-01T23:31:00.000Z', consumer_ref: 'worker:1', lease_expires_at: '2026-09-02T00:00:00.000Z', limit: 1, lease_token_factory: () => 'lease-daily' });
    expect(runs).toHaveLength(1);
    expect(repository.getById('routine-daily')?.next_run_at).toBe('2026-09-02T23:30:00.000Z');
  });
});
