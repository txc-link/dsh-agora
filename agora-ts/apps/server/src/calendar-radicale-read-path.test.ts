import { describe, expect, it } from 'vitest';
import { CalendarService } from '@agora-ts/core';
import { RadicaleCalendarAdapter, RadicaleClient } from '@agora-ts/adapters-calendar';

/**
 * Regression guard for the Radicale read path.
 *
 * Radicale answers `GET /{user}/{collection}/` with an iCalendar export whose
 * DTSTART/DTEND use RFC 5545's compact form (`20260912T004141Z`). That is NOT
 * ISO 8601 — `Date.parse` yields NaN and `start.slice(0, 10)` never equals a
 * `YYYY-MM-DD` bucket key — so before the parser normalised these values the
 * whole provider was silently dead: `/api/calendar/today` always returned
 * `[]` and conflict detection threw as soon as two events were present.
 *
 * The fixture below is a byte-for-byte capture of a real Radicale 3.1.8
 * export, including the PYVOBJECT PRODID, so the test fails if the parser
 * ever regresses to passing compact values through.
 */
const RADICALE_EXPORT = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//PYVOBJECT//NONSGML Version 1//EN',
  'BEGIN:VEVENT',
  'UID:verify-1789180901',
  'DTSTART:20260912T004141Z',
  'DTEND:20260912T044141Z',
  'DTSTAMP:20260912T024141Z',
  'LOCATION:home-linux',
  'SUMMARY:Radicale installation check',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

const RADICALE_EXPORT_OVERLAPPING = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//PYVOBJECT//NONSGML Version 1//EN',
  'BEGIN:VEVENT',
  'UID:overlap-a',
  'DTSTART:20260912T010000Z',
  'DTEND:20260912T030000Z',
  'SUMMARY:Design review',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:overlap-b',
  'DTSTART:20260912T020000Z',
  'DTEND:20260912T040000Z',
  'SUMMARY:Vendor call',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

interface Captured {
  url: string;
  method: string;
  authorization: string | null;
}

function serviceFor(exportBody: string, captured: Captured[]): CalendarService {
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    captured.push({
      url: String(input),
      method: init?.method ?? 'GET',
      authorization: headers.get('authorization'),
    });
    return new Response(exportBody, { status: 200, headers: { 'content-type': 'text/calendar' } });
  }) as typeof fetch;
  const client = new RadicaleClient({
    baseUrl: 'http://127.0.0.1:5232',
    username: 'tester',
    password: 'secret',
    fetchImpl,
  });
  return new CalendarService({
    provider: new RadicaleCalendarAdapter({
      client,
      collections: { work: '/tester/work/', life: '/tester/life/' },
    }),
    now: () => new Date('2026-09-12T02:42:00Z'),
  });
}

describe('radicale calendar read path', () => {
  it('surfaces a same-day Radicale event through listToday', async () => {
    const captured: Captured[] = [];
    const events = await serviceFor(RADICALE_EXPORT, captured).listToday('work');

    expect(captured).toEqual([
      {
        url: 'http://127.0.0.1:5232/tester/work/',
        method: 'GET',
        authorization: `Basic ${Buffer.from('tester:secret').toString('base64')}`,
      },
    ]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      uid: 'verify-1789180901',
      summary: 'Radicale installation check',
      start: '2026-09-12T00:41:41Z',
      end: '2026-09-12T04:41:41Z',
      location: 'home-linux',
    });
  });

  it('detects overlaps between Radicale events instead of throwing on compact dates', async () => {
    const conflicts = await serviceFor(RADICALE_EXPORT_OVERLAPPING, []).listConflicts('work');
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({ uid_a: 'overlap-a', uid_b: 'overlap-b' });
  });

  it('routes the life collection to its own URL', async () => {
    const captured: Captured[] = [];
    await serviceFor(RADICALE_EXPORT, captured).listEvents('life');
    expect(captured[0]?.url).toBe('http://127.0.0.1:5232/tester/life/');
  });
});
