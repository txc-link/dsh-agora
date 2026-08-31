import { describe, expect, it } from 'vitest';
import type { CalendarEventDto } from '@agora-ts/contracts';
import type { RadicaleClient, RadicaleClientOptions } from '@agora-ts/adapters-calendar';
import { CalendarService } from './calendar-service.js';

class StubRadicaleClient implements Pick<RadicaleClient, 'fetchCollection'> {
  private readonly byCollection = new Map<string, CalendarEventDto[]>();
  setCollection(path: string, events: CalendarEventDto[]): void {
    this.byCollection.set(path, events);
  }
  fetchCollection(collectionPath: string): Promise<CalendarEventDto[]> {
    const events = this.byCollection.get(collectionPath) ?? [];
    return Promise.resolve(events);
  }
}

const ev = (overrides: Partial<CalendarEventDto> & { uid: string; start: string; end: string }): CalendarEventDto => ({
  summary: overrides.uid,
  location: null,
  ...overrides,
});

const clientFor = (): { client: StubRadicaleClient; opts: RadicaleClientOptions } => ({
  client: new StubRadicaleClient(),
  opts: {} as RadicaleClientOptions,
});

describe('CalendarService', () => {
  it('listToday buckets events whose start or end matches the configured date', async () => {
    const { client } = clientFor();
    client.setCollection('/alice/work', [
      ev({ uid: 'a', start: '2026-08-31T09:00:00Z', end: '2026-08-31T10:00:00Z' }),
      ev({ uid: 'b', start: '2026-08-31T23:00:00Z', end: '2026-09-01T01:00:00Z' }),
      ev({ uid: 'c', start: '2026-09-01T03:00:00Z', end: '2026-09-01T04:00:00Z' }),
    ]);
    const service = new CalendarService({
      client: client as unknown as RadicaleClient,
      collections: { work: '/alice/work', life: '/alice/life' },
      now: () => new Date('2026-08-31T12:00:00Z'),
    });

    const today = await service.listToday('work');
    expect(today.map((e) => e.uid).sort()).toEqual(['a', 'b']);
  });

  it('listConflicts and morningReport delegate to the pure helpers', async () => {
    const { client } = clientFor();
    client.setCollection('/alice/work', [
      ev({ uid: 'a', summary: 'Stand-up', start: '2026-08-31T09:00:00Z', end: '2026-08-31T10:30:00Z' }),
      ev({ uid: 'b', summary: 'Vendor call', start: '2026-08-31T10:00:00Z', end: '2026-08-31T11:00:00Z' }),
    ]);
    const service = new CalendarService({
      client: client as unknown as RadicaleClient,
      collections: { work: '/alice/work', life: '/alice/life' },
      now: () => new Date('2026-08-31T08:00:00Z'),
    });

    const conflicts = await service.listConflicts('work');
    expect(conflicts).toHaveLength(1);

    const markdown = await service.morningReport('work');
    expect(markdown).toContain('# WORK · morning briefing');
    expect(markdown).toContain('2 events · 1 conflict');
    expect(markdown).toContain('**Stand-up**');
  });

  it('routes work vs life to the right collection', async () => {
    const { client } = clientFor();
    client.setCollection('/alice/work', [ev({ uid: 'w', start: '2026-08-31T09:00:00Z', end: '2026-08-31T10:00:00Z' })]);
    client.setCollection('/alice/life', [ev({ uid: 'l', start: '2026-08-31T19:00:00Z', end: '2026-08-31T20:00:00Z' })]);

    const service = new CalendarService({
      client: client as unknown as RadicaleClient,
      collections: { work: '/alice/work', life: '/alice/life' },
      now: () => new Date('2026-08-31T12:00:00Z'),
    });

    expect((await service.listToday('work')).map((e) => e.uid)).toEqual(['w']);
    expect((await service.listToday('life')).map((e) => e.uid)).toEqual(['l']);
  });
});