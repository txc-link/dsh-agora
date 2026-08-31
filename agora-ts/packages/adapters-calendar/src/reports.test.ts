import { describe, expect, it } from 'vitest';
import type { CalendarEventDto } from '@agora-ts/contracts';
import { generateEveningReport, generateMorningReport } from './reports.js';

const ev = (overrides: Partial<CalendarEventDto> & { uid: string; start: string; end: string }): CalendarEventDto => ({
  summary: overrides.uid,
  location: null,
  ...overrides,
});

describe('morning report', () => {
  it('summarises empty days honestly with a "no events" marker', () => {
    const md = generateMorningReport({ domain: 'work', date: '2026-08-31', events: [], conflicts: [] });
    expect(md).toContain('# WORK · morning briefing · 2026-08-31');
    expect(md).toContain('0 events');
    expect(md).toContain('_no events today_');
    expect(md).toContain('_no conflicts_');
  });

  it('lists today events and surfaces conflicts in a dedicated section', () => {
    const events = [
      ev({ uid: 'a', summary: 'Stand-up', start: '2026-08-31T09:00:00Z', end: '2026-08-31T09:30:00Z', location: 'Room A' }),
      ev({ uid: 'b', summary: 'Vendor call', start: '2026-08-31T10:00:00Z', end: '2026-08-31T11:00:00Z' }),
    ];
    const conflicts = [
      {
        uid_a: 'a',
        uid_b: 'b',
        summary_a: 'Stand-up',
        summary_b: 'Vendor call',
        start: '2026-08-31T09:30:00Z',
        end: '2026-08-31T11:00:00Z',
      },
    ];
    const md = generateMorningReport({ domain: 'life', date: '2026-08-31', events, conflicts });
    expect(md).toContain('# LIFE · morning briefing');
    expect(md).toContain('2 events · 1 conflict');
    expect(md).toContain('**Stand-up** @ Room A');
    expect(md).toContain('⚠ **Stand-up** ↔ **Vendor call**');
  });
});

describe('evening report', () => {
  it('renders an empty tomorrow + no conflicts when both are empty', () => {
    const md = generateEveningReport({
      domain: 'work',
      date: '2026-08-31',
      today: [],
      tomorrow: [],
      pendingConflicts: [],
    });
    expect(md).toContain('# WORK · evening check-out · 2026-08-31');
    expect(md).toContain('_no events completed today_');
    expect(md).toContain('_tomorrow is open_');
    expect(md).toContain('Open conflicts (0)');
  });
});