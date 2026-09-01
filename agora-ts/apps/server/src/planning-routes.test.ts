import { afterEach, describe, expect, it } from 'vitest';
import type { PlanningBinding, PlanningBindingUpsertInput } from '@agora-ts/contracts';
import { ActionRiskService, PlanningService } from '@agora-ts/core';
import { buildApp } from './app.js';

class Repo {
  binding: PlanningBinding | undefined;
  upsert(input: PlanningBindingUpsertInput): PlanningBinding {
    this.binding = {
      taskId: input.taskId, domain: input.domain,
      externalTaskProvider: input.externalTask?.provider ?? this.binding?.externalTaskProvider ?? null,
      externalTaskRef: input.externalTask?.ref ?? this.binding?.externalTaskRef ?? null,
      externalTaskProjectRef: input.externalTask?.projectRef ?? this.binding?.externalTaskProjectRef ?? null,
      calendarProvider: input.calendarEvent?.provider ?? this.binding?.calendarProvider ?? null,
      calendarEventRef: input.calendarEvent?.ref ?? this.binding?.calendarEventRef ?? null,
      createdAt: this.binding?.createdAt ?? '2026-09-01', updatedAt: '2026-09-01',
    };
    return this.binding;
  }
  getByTask(taskId: string) { return this.binding?.taskId === taskId ? this.binding : undefined; }
  list() { return this.binding ? [this.binding] : []; }
  removeByTask() { this.binding = undefined; return true; }
}

describe('planning routes', () => {
  const apps: ReturnType<typeof buildApp>[] = [];
  afterEach(async () => { while (apps.length) await apps.pop()?.close(); });

  it('projects an external task and calendar event and returns the combined binding', async () => {
    const planningService = new PlanningService({
      repo: new Repo(),
      taskRepo: { getTask: id => id === 'task-1' ? ({ id, title: 'Task', description: null }) as never : null },
      taskProvider: {
        providerId: 'ticktick',
        createTask: async input => ({ id: 'tt-1', projectRef: input.projectRef, title: input.title, content: null, start: null, due: null, timeZone: null, status: 'open' }),
      },
      calendarProvider: {
        providerId: 'google-calendar', listEvents: async () => [],
        createEvent: async (_domain, input) => ({ uid: 'gc-1', summary: input.summary, start: input.start, end: input.end, location: null }),
      },
    });
    const app = buildApp({ planningService });
    apps.push(app);

    expect((await app.inject({ method: 'POST', url: '/api/planning/tasks/task-1/external-task', payload: { domain: 'work', projectRef: 'p-1' } })).statusCode).toBe(201);
    expect((await app.inject({ method: 'POST', url: '/api/planning/tasks/task-1/calendar-event', payload: { domain: 'work', start: '2026-09-02T09:00:00Z', end: '2026-09-02T10:00:00Z' } })).statusCode).toBe(201);
    const response = await app.inject({ method: 'GET', url: '/api/planning/tasks/task-1' });

    expect(response.statusCode).toBe(200);
    expect(response.json().binding).toMatchObject({ externalTaskRef: 'tt-1', calendarEventRef: 'gc-1' });
  });

  it('fails closed before calling a provider when an external write requires a human gate', async () => {
    let providerCalls = 0;
    const planningService = new PlanningService({
      repo: new Repo(),
      taskRepo: { getTask: id => ({ id, title: 'Personal task', description: null }) as never },
      taskProvider: {
        providerId: 'ticktick',
        createTask: async input => {
          providerCalls += 1;
          return { id: 'unexpected', projectRef: input.projectRef, title: input.title, content: null, start: null, due: null, timeZone: null, status: 'open' };
        },
      },
    });
    const actionRiskService = new ActionRiskService({
      repository: {
        insert: record => record,
        getById: () => null,
        listBySubject: () => [],
      },
      idGenerator: () => 'risk-1',
    });
    const app = buildApp({ planningService, actionRiskService });
    apps.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/api/planning/tasks/task-1/external-task',
      payload: { domain: 'life', projectRef: 'personal-list' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ risk_assessment_id: 'risk-1' });
    expect(providerCalls).toBe(0);
  });
});
