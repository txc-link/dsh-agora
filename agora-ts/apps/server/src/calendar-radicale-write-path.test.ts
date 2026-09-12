import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PlanningBinding, PlanningBindingUpsertInput } from '@agora-ts/contracts';
import { parseICalEvents, RadicaleCalendarAdapter, RadicaleClient } from '@agora-ts/adapters-calendar';
import { PlanningService } from '@agora-ts/core';
import { createCalendarProviderFromEnv } from './calendar-factory.js';

/**
 * Regression guard for the Radicale write path.
 *
 * Before this slice the Radicale adapter implemented `listEvents` only, so
 * `PlanningService.canProjectCalendarEvents` (== `provider.createEvent !==
 * undefined`, the exact predicate `apps/server/src/app.ts` consults) was
 * false and `POST /api/planning/tasks/:id/calendar-event` answered **503
 * "Writable calendar provider is not configured"** forever.
 *
 * This test pins both halves of the fix:
 *   1. the composed Radicale provider (through `createCalendarProviderFromEnv`,
 *      i.e. the same composition root the server uses) now exposes
 *      `createEvent`, so the 503 gate is no longer taken; and
 *   2. the write really is a CalDAV `PUT` into the configured collection, and
 *      its body reads back through the same parser `listEvents` uses.
 *
 * The companion `calendar-radicale-read-path.test.ts` pins the read path with
 * a byte-for-byte Radicale export fixture.
 */

interface Captured {
  readonly url: string;
  readonly method: string;
  readonly contentType: string | null;
  readonly ifNoneMatch: string | null;
  readonly authorization: string | null;
  readonly body: string;
}

class MemoryPlanningRepo {
  private binding: PlanningBinding | undefined;
  upsert(input: PlanningBindingUpsertInput): PlanningBinding {
    const now = '2026-09-12T04:00:00.000Z';
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
    this.binding = { ...this.binding, syncMode: mode };
    return this.binding;
  }
  recordSyncResult(taskId: string, input: { status: PlanningBinding['lastSyncStatus']; syncedAt: string }): PlanningBinding {
    if (!this.binding || this.binding.taskId !== taskId) throw new Error('not found');
    this.binding = { ...this.binding, lastSyncStatus: input.status, lastSyncAt: input.syncedAt };
    return this.binding;
  }
}

const taskRepo = {
  getTask: (id: string) => id === 'task-1'
    ? { id, title: 'Plan the week', description: 'Life pack projection' } as never
    : null,
};

function stubFetch(captured: Captured[], status = 201): void {
  vi.stubGlobal('fetch', (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    captured.push({
      url: String(input),
      method: init?.method ?? 'GET',
      contentType: headers['content-type'] ?? null,
      ifNoneMatch: headers['if-none-match'] ?? null,
      authorization: headers.authorization ?? null,
      body: typeof init?.body === 'string' ? init.body : '',
    });
    return new Response(null, { status });
  }) as typeof fetch);
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('Radicale write path (composition root → CalDAV PUT)', () => {
  it('exposes createEvent through the composition root so the 503 gate is no longer taken', () => {
    const provider = createCalendarProviderFromEnv({
      provider: 'radicale',
      radicaleUrl: 'http://127.0.0.1:5232',
      radicaleUsername: 'tester',
      radicalePassword: 'secret',
    });

    expect(provider.providerId).toBe('radicale');
    expect(provider.createEvent).toBeTypeOf('function');
    const service = new PlanningService({ repo: new MemoryPlanningRepo(), taskRepo, calendarProvider: provider });
    // apps/server/src/app.ts:5011 answers 503 exactly when this is false.
    expect(service.canProjectCalendarEvents).toBe(true);
  });

  it('PUTs a create-only .ics into the work collection and binds the task to it', async () => {
    const captured: Captured[] = [];
    stubFetch(captured);
    const provider = createCalendarProviderFromEnv({
      provider: 'radicale',
      radicaleUrl: 'http://127.0.0.1:5232',
      radicaleUsername: 'tester',
      radicalePassword: 'secret',
      radicaleWorkCollection: '/tester/work/',
      radicaleLifeCollection: '/tester/life/',
    });
    const service = new PlanningService({ repo: new MemoryPlanningRepo(), taskRepo, calendarProvider: provider });

    const binding = await service.projectCalendarEvent({
      taskId: 'task-1', domain: 'work', summary: 'Plan the week',
      start: '2026-09-14T01:00:00Z', end: '2026-09-14T01:30:00Z', location: 'home',
    });

    expect(captured).toHaveLength(1);
    const call = captured[0];
    expect(call?.method).toBe('PUT');
    expect(call?.contentType).toBe('text/calendar; charset=utf-8');
    expect(call?.ifNoneMatch).toBe('*');
    expect(call?.authorization).toBe(`Basic ${Buffer.from('tester:secret').toString('base64')}`);
    const path = new URL(String(call?.url)).pathname;
    expect(path.startsWith('/tester/work/')).toBe(true);
    expect(path.endsWith('.ics')).toBe(true);

    const parsed = parseICalEvents(String(call?.body));
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      summary: 'Plan the week', location: 'home',
      start: '2026-09-14T01:00:00Z', end: '2026-09-14T01:30:00Z',
    });
    // The binding must reference exactly the resource that was written.
    expect(binding).toMatchObject({ taskId: 'task-1', domain: 'work', calendarProvider: 'radicale' });
    expect(binding.calendarEventRef).toBe(parsed[0]?.uid);
    expect(path).toBe(`/tester/work/${String(parsed[0]?.uid)}.ics`);
  });

  it('keeps the write fail-closed when Radicale rejects the resource', async () => {
    const captured: Captured[] = [];
    stubFetch(captured, 403);
    const client = new RadicaleClient({ baseUrl: 'http://127.0.0.1:5232', username: 'tester', password: 'secret' });
    const adapter = new RadicaleCalendarAdapter({ client, collections: { work: '/tester/work/', life: '/tester/life/' } });

    await expect(adapter.createEvent('work', {
      summary: 'Plan the week', start: '2026-09-14T01:00:00Z', end: '2026-09-14T01:30:00Z',
    })).rejects.toThrow(/radicale 403/u);
    expect(captured).toHaveLength(1);
  });
});
