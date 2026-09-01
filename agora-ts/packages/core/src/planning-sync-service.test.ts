import { describe, expect, it } from 'vitest';
import type { PlanningBinding } from '@agora-ts/contracts';
import { PlanningSyncService } from './planning-sync-service.js';

function binding(overrides: Partial<PlanningBinding> = {}): PlanningBinding {
  return {
    taskId: 'task-1', domain: 'work',
    externalTaskProvider: 'ticktick', externalTaskRef: 'tt-1', externalTaskProjectRef: 'project-1',
    calendarProvider: 'google-calendar', calendarEventRef: 'gc-1',
    syncMode: 'bidirectional', lastSyncStatus: 'pending', lastSyncAt: null, lastSyncError: null,
    createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

class SyncRepo {
  constructor(public current: PlanningBinding) {}
  upsert() { return this.current; }
  getByTask(taskId: string) { return taskId === this.current.taskId ? this.current : undefined; }
  list() { return [this.current]; }
  removeByTask() { return false; }
  setSyncMode(_taskId: string, mode: 'manual' | 'bidirectional') { this.current = { ...this.current, syncMode: mode }; return this.current; }
  recordSyncResult(_taskId: string, input: { status: 'pending' | 'synced' | 'conflict' | 'failed'; syncedAt: string; error?: string | null }) {
    this.current = { ...this.current, lastSyncStatus: input.status, lastSyncAt: input.syncedAt, lastSyncError: input.error ?? null };
    return this.current;
  }
}

describe('PlanningSyncService', () => {
  it('advances an active Agora task when TickTick is completed', async () => {
    let state = 'active';
    const service = new PlanningSyncService({
      repo: new SyncRepo(binding()),
      taskPort: {
        getTask: () => ({ id: 'task-1', state }),
        transitionTask: (_id, next) => { state = next; return { id: 'task-1', state }; },
      },
      taskProvider: {
        providerId: 'ticktick', createTask: async () => { throw new Error('unused'); },
        getTask: async () => ({ id: 'tt-1', projectRef: 'project-1', title: 'Task', content: null, start: null, due: null, timeZone: null, status: 'completed' }),
      },
      calendarProvider: {
        providerId: 'google-calendar', listEvents: async () => [],
        getEventState: async () => ({ ref: 'gc-1', state: 'scheduled', version: 'v1' }),
      },
    });

    const result = await service.syncTask('task-1');
    expect(result).toMatchObject({ status: 'synced', localState: 'done', actions: ['agora:done'] });
  });

  it('propagates Agora cancellation to TickTick deletion and Google cancellation', async () => {
    const actions: string[] = [];
    const service = new PlanningSyncService({
      repo: new SyncRepo(binding()),
      taskPort: { getTask: () => ({ id: 'task-1', state: 'cancelled' }), transitionTask: () => { throw new Error('unused'); } },
      taskProvider: {
        providerId: 'ticktick', createTask: async () => { throw new Error('unused'); },
        getTask: async () => ({ id: 'tt-1', projectRef: 'project-1', title: 'Task', content: null, start: null, due: null, timeZone: null, status: 'open' }),
        deleteTask: async () => { actions.push('ticktick'); },
      },
      calendarProvider: {
        providerId: 'google-calendar', listEvents: async () => [],
        getEventState: async () => ({ ref: 'gc-1', state: 'scheduled', version: 'v1' }),
        cancelEvent: async () => { actions.push('google'); },
      },
    });

    const result = await service.syncTask('task-1');
    expect(result).toMatchObject({ status: 'synced', localState: 'cancelled' });
    expect(actions).toEqual(['ticktick', 'google']);
  });

  it('propagates Agora completion to TickTick without cancelling the calendar event', async () => {
    const actions: string[] = [];
    const service = new PlanningSyncService({
      repo: new SyncRepo(binding()),
      taskPort: { getTask: () => ({ id: 'task-1', state: 'done' }), transitionTask: () => { throw new Error('unused'); } },
      taskProvider: {
        providerId: 'ticktick', createTask: async () => { throw new Error('unused'); },
        getTask: async () => ({ id: 'tt-1', projectRef: 'project-1', title: 'Task', content: null, start: null, due: null, timeZone: null, status: 'open' }),
        completeTask: async () => { actions.push('ticktick:complete'); },
      },
      calendarProvider: {
        providerId: 'google-calendar', listEvents: async () => [],
        getEventState: async () => ({ ref: 'gc-1', state: 'scheduled', version: 'v1' }),
        cancelEvent: async () => { actions.push('google:cancel'); },
      },
    });

    const result = await service.syncTask('task-1');
    expect(result).toMatchObject({ status: 'synced', externalTaskState: 'completed', calendarEventState: 'scheduled' });
    expect(actions).toEqual(['ticktick:complete']);
  });

  it('propagates Google cancellation into Agora and the still-open TickTick task', async () => {
    let state = 'active';
    const actions: string[] = [];
    const service = new PlanningSyncService({
      repo: new SyncRepo(binding()),
      taskPort: {
        getTask: () => ({ id: 'task-1', state }),
        transitionTask: (_id, next) => { state = next; actions.push(`agora:${next}`); return { id: 'task-1', state }; },
      },
      taskProvider: {
        providerId: 'ticktick', createTask: async () => { throw new Error('unused'); },
        getTask: async () => ({ id: 'tt-1', projectRef: 'project-1', title: 'Task', content: null, start: null, due: null, timeZone: null, status: 'open' }),
        deleteTask: async () => { actions.push('ticktick:delete'); },
      },
      calendarProvider: {
        providerId: 'google-calendar', listEvents: async () => [],
        getEventState: async () => ({ ref: 'gc-1', state: 'cancelled', version: 'v2' }),
      },
    });

    const result = await service.syncTask('task-1');
    expect(result).toMatchObject({ status: 'synced', localState: 'cancelled', externalTaskState: 'deleted', calendarEventState: 'cancelled' });
    expect(actions).toEqual(['agora:cancelled', 'ticktick:delete']);
  });

  it('records a conflict before mutation when providers disagree', async () => {
    let mutations = 0;
    const repo = new SyncRepo(binding());
    const service = new PlanningSyncService({
      repo,
      taskPort: { getTask: () => ({ id: 'task-1', state: 'active' }), transitionTask: () => { mutations += 1; throw new Error('unexpected'); } },
      taskProvider: {
        providerId: 'ticktick', createTask: async () => { throw new Error('unused'); },
        getTask: async () => ({ id: 'tt-1', projectRef: 'project-1', title: 'Task', content: null, start: null, due: null, timeZone: null, status: 'completed' }),
        completeTask: async () => { mutations += 1; }, deleteTask: async () => { mutations += 1; },
      },
      calendarProvider: {
        providerId: 'google-calendar', listEvents: async () => [],
        getEventState: async () => ({ ref: 'gc-1', state: 'cancelled', version: 'v2' }),
        cancelEvent: async () => { mutations += 1; },
      },
    });

    const result = await service.syncTask('task-1');
    expect(result.status).toBe('conflict');
    expect(mutations).toBe(0);
    expect(repo.current.lastSyncStatus).toBe('conflict');
  });

  it('skips bindings without bidirectional consent', async () => {
    const service = new PlanningSyncService({
      repo: new SyncRepo(binding({ syncMode: 'manual' })),
      taskPort: { getTask: () => { throw new Error('must not read task'); }, transitionTask: () => { throw new Error('unused'); } },
    });
    await expect(service.syncTask('task-1')).resolves.toMatchObject({ status: 'skipped' });
  });
});
