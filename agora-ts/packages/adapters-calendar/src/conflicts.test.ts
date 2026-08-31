import { describe, expect, it } from 'vitest';
import type { CalendarEventDto } from '@agora-ts/contracts';
import { computeConflicts } from './conflicts.js';

const ev = (overrides: Partial<CalendarEventDto> & { uid: string; start: string; end: string }): CalendarEventDto => ({
  summary: overrides.uid,
  location: null,
  ...overrides,
});

describe('computeConflicts', () => {
  it('returns no conflicts when events are non-overlapping', () => {
    const events = [
      ev({ uid: 'a', start: '2026-08-31T09:00:00Z', end: '2026-08-31T10:00:00Z' }),
      ev({ uid: 'b', start: '2026-08-31T10:00:00Z', end: '2026-08-31T11:00:00Z' }),
      ev({ uid: 'c', start: '2026-08-31T11:00:00Z', end: '2026-08-31T12:00:00Z' }),
    ];
    expect(computeConflicts(events)).toEqual([]);
  });

  it('detects overlap between two intervals and surfaces the intersecting window', () => {
    const events = [
      ev({ uid: 'a', summary: 'Stand-up', start: '2026-08-31T09:00:00Z', end: '2026-08-31T10:30:00Z' }),
      ev({ uid: 'b', summary: 'Vendor call', start: '2026-08-31T10:00:00Z', end: '2026-08-31T11:00:00Z' }),
    ];
    const conflicts = computeConflicts(events);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      uid_a: 'a',
      uid_b: 'b',
      summary_a: 'Stand-up',
      summary_b: 'Vendor call',
      start: '2026-08-31T10:00:00Z',
      end: '2026-08-31T10:30:00Z',
    });
  });

  it('treats contained intervals as overlapping', () => {
    const events = [
      ev({ uid: 'outer', start: '2026-08-31T08:00:00Z', end: '2026-08-31T18:00:00Z' }),
      ev({ uid: 'inner', start: '2026-08-31T12:00:00Z', end: '2026-08-31T13:00:00Z' }),
    ];
    expect(computeConflicts(events)).toHaveLength(1);
  });

  it('does not flag touching boundaries as a conflict (end == start)', () => {
    const events = [
      ev({ uid: 'a', start: '2026-08-31T09:00:00Z', end: '2026-08-31T10:00:00Z' }),
      ev({ uid: 'b', start: '2026-08-31T10:00:00Z', end: '2026-08-31T11:00:00Z' }),
    ];
    expect(computeConflicts(events)).toEqual([]);
  });

  it('reports each overlapping pair exactly once', () => {
    const events = [
      ev({ uid: 'a', start: '2026-08-31T09:00:00Z', end: '2026-08-31T12:00:00Z' }),
      ev({ uid: 'b', start: '2026-08-31T10:00:00Z', end: '2026-08-31T11:00:00Z' }),
      ev({ uid: 'c', start: '2026-08-31T10:30:00Z', end: '2026-08-31T12:30:00Z' }),
    ];
    const conflicts = computeConflicts(events);
    const pairs = conflicts.map((c) => `${c.uid_a}|${c.uid_b}`).sort();
    expect(pairs).toEqual(['a|b', 'a|c', 'b|c'].sort());
  });
});