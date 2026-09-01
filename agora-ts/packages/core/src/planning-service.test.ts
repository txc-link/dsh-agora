import { describe, expect, it } from 'vitest';
import type { PlanningBinding, PlanningBindingUpsertInput } from '@agora-ts/contracts';
import { PlanningService } from './planning-service.js';

class MemoryPlanningRepo {
  private binding: PlanningBinding | undefined;
  upsert(input: PlanningBindingUpsertInput): PlanningBinding {
    const now = '2026-09-01T00:00:00.000Z';
    this.binding = {
      taskId: input.taskId, domain: input.domain,
      externalTaskProvider: input.externalTask?.provider ?? this.binding?.externalTaskProvider ?? null,
      externalTaskRef: input.externalTask?.ref ?? this.binding?.externalTaskRef ?? null,
      externalTaskProjectRef: input.externalTask?.projectRef ?? this.binding?.externalTaskProjectRef ?? null,
      calendarProvider: input.calendarEvent?.provider ?? this.binding?.calendarProvider ?? null,
      calendarEventRef: input.calendarEvent?.ref ?? this.binding?.calendarEventRef ?? null,
      syncMode: input.syncMode ?? this.binding?.syncMode ?? 'manual',
      lastSyncStatus: this.binding?.lastSyncStatus ?? 'pending',
      lastSyncAt: this.binding?.lastSyncAt ?? null,
      lastSyncError: this.binding?.lastSyncError ?? null,
      createdAt: this.binding?.createdAt ?? now, updatedAt: now,
    };
    return this.binding;
  }
  getByTask(taskId: string): PlanningBinding | undefined { return this.binding?.taskId === taskId ? this.binding : undefined; }
  list(): readonly PlanningBinding[] { return this.binding ? [this.binding] : []; }
  removeByTask(taskId: string): boolean { if (this.binding?.taskId !== taskId) return false; this.binding = undefined; return true; }
  setSyncMode(taskId: string, mode: PlanningBinding['syncMode']): PlanningBinding {
    if (!this.binding || this.binding.taskId !== taskId) throw new Error('not found');
    this.binding = { ...this.binding, syncMode: mode, lastSyncStatus: 'pending', lastSyncError: null };
    return this.binding;
  }
  recordSyncResult(taskId: string, input: { status: PlanningBinding['lastSyncStatus']; syncedAt: string; error?: string | null }): PlanningBinding {
    if (!this.binding || this.binding.taskId !== taskId) throw new Error('not found');
    this.binding = { ...this.binding, lastSyncStatus: input.status, lastSyncAt: input.syncedAt, lastSyncError: input.error ?? null };
    return this.binding;
  }
}

const taskRepo = {
  getTask: (id: string) => id === 'task-1' ? ({ id, title: 'Research memory', description: 'Compare options' }) as never : null,
};

describe('PlanningService', () => {
  it('projects an Agora task and event while preserving one durable binding', async () => {
    const repo = new MemoryPlanningRepo();
    const service = new PlanningService({
      repo,
      taskRepo,
      taskProvider: {
        providerId: 'ticktick',
        createTask: async input => ({ id: 'tt-1', projectRef: input.projectRef, title: input.title, content: input.content ?? null, start: input.start ?? null, due: input.due ?? null, timeZone: input.timeZone ?? null, status: 'open' }),
      },
      calendarProvider: {
        providerId: 'google-calendar',
        listEvents: async () => [],
        createEvent: async (_domain, input) => ({ uid: 'gcal-1', summary: input.summary, start: input.start, end: input.end, location: input.location ?? null }),
      },
    });

    await service.projectExternalTask({ taskId: 'task-1', domain: 'work', projectRef: 'project-1' });
    const binding = await service.projectCalendarEvent({ taskId: 'task-1', domain: 'work', start: '2026-09-02T09:00:00Z', end: '2026-09-02T10:00:00Z' });

    expect(binding).toMatchObject({
      taskId: 'task-1', domain: 'work', externalTaskProvider: 'ticktick', externalTaskRef: 'tt-1',
      calendarProvider: 'google-calendar', calendarEventRef: 'gcal-1',
    });
  });

  it('does not call a provider for an unknown Agora task', async () => {
    let called = false;
    const service = new PlanningService({
      repo: new MemoryPlanningRepo(), taskRepo,
      taskProvider: { providerId: 'ticktick', createTask: async () => { called = true; throw new Error('unexpected'); } },
    });
    await expect(service.projectExternalTask({ taskId: 'missing', domain: 'life', projectRef: 'inbox' })).rejects.toThrow('task not found');
    expect(called).toBe(false);
  });

  it('returns an existing projection without creating a duplicate provider object', async () => {
    const repo = new MemoryPlanningRepo();
    repo.upsert({ taskId: 'task-1', domain: 'work', externalTask: { provider: 'ticktick', ref: 'already', projectRef: 'p-1' } });
    let called = false;
    const service = new PlanningService({
      repo, taskRepo,
      taskProvider: { providerId: 'ticktick', createTask: async () => { called = true; throw new Error('unexpected'); } },
    });

    const binding = await service.projectExternalTask({ taskId: 'task-1', domain: 'work', projectRef: 'p-1' });
    expect(binding.externalTaskRef).toBe('already');
    expect(called).toBe(false);
  });
});
