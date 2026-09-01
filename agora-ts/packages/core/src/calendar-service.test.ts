import { describe, expect, it } from 'vitest';
import type { CalendarDomainDto, CalendarEventDto } from '@agora-ts/contracts';
import { CalendarService } from './calendar-service.js';

class StubCalendarProvider {
  readonly providerId = 'test';
  private readonly byDomain = new Map<CalendarDomainDto, CalendarEventDto[]>();
  setDomain(domain: CalendarDomainDto, events: CalendarEventDto[]): void {
    this.byDomain.set(domain, events);
  }
  listEvents(domain: CalendarDomainDto): Promise<CalendarEventDto[]> {
    const events = this.byDomain.get(domain) ?? [];
    return Promise.resolve(events);
  }
}

const ev = (overrides: Partial<CalendarEventDto> & { uid: string; start: string; end: string }): CalendarEventDto => ({
  summary: overrides.uid,
  location: null,
  ...overrides,
});

const providerFor = (): StubCalendarProvider => new StubCalendarProvider();

describe('CalendarService', () => {
  it('listToday buckets events whose start or end matches the configured date', async () => {
    const provider = providerFor();
    provider.setDomain('work', [
      ev({ uid: 'a', start: '2026-08-31T09:00:00Z', end: '2026-08-31T10:00:00Z' }),
      ev({ uid: 'b', start: '2026-08-31T23:00:00Z', end: '2026-09-01T01:00:00Z' }),
      ev({ uid: 'c', start: '2026-09-01T03:00:00Z', end: '2026-09-01T04:00:00Z' }),
    ]);
    const service = new CalendarService({
      provider,
      now: () => new Date('2026-08-31T12:00:00Z'),
    });

    const today = await service.listToday('work');
    expect(today.map((e) => e.uid).sort()).toEqual(['a', 'b']);
  });

  it('listConflicts and morningReport delegate to the pure helpers', async () => {
    const provider = providerFor();
    provider.setDomain('work', [
      ev({ uid: 'a', summary: 'Stand-up', start: '2026-08-31T09:00:00Z', end: '2026-08-31T10:30:00Z' }),
      ev({ uid: 'b', summary: 'Vendor call', start: '2026-08-31T10:00:00Z', end: '2026-08-31T11:00:00Z' }),
    ]);
    const service = new CalendarService({
      provider,
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
    const provider = providerFor();
    provider.setDomain('work', [ev({ uid: 'w', start: '2026-08-31T09:00:00Z', end: '2026-08-31T10:00:00Z' })]);
    provider.setDomain('life', [ev({ uid: 'l', start: '2026-08-31T19:00:00Z', end: '2026-08-31T20:00:00Z' })]);

    const service = new CalendarService({
      provider,
      now: () => new Date('2026-08-31T12:00:00Z'),
    });

    expect((await service.listToday('work')).map((e) => e.uid)).toEqual(['w']);
    expect((await service.listToday('life')).map((e) => e.uid)).toEqual(['l']);
  });
});
