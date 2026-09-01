import { describe, expect, it } from 'vitest';
import { GoogleCalendarAdapter } from './google-calendar.js';

describe('GoogleCalendarAdapter', () => {
  it('lists paginated events and maps date/dateTime values', async () => {
    const calls: URL[] = [];
    const adapter = new GoogleCalendarAdapter({
      accessToken: async () => 'token',
      calendarIds: { work: 'primary', life: 'life@example.test' },
      now: () => new Date('2026-09-01T00:00:00Z'),
      fetchImpl: async (input) => {
        const url = new URL(String(input));
        calls.push(url);
        const second = url.searchParams.get('pageToken') === 'next';
        return Response.json(second ? {
          items: [{ id: 'all-day', summary: '休息', start: { date: '2026-09-02' }, end: { date: '2026-09-03' } }],
        } : {
          nextPageToken: 'next',
          items: [
            { id: 'cancelled', status: 'cancelled', summary: 'skip' },
            { id: 'meeting', summary: '团队会', location: 'Room 1', start: { dateTime: '2026-09-01T09:00:00+08:00' }, end: { dateTime: '2026-09-01T10:00:00+08:00' } },
          ],
        });
      },
    });

    const events = await adapter.listEvents('work');

    expect(events).toEqual([
      { uid: 'meeting', summary: '团队会', location: 'Room 1', start: '2026-09-01T09:00:00+08:00', end: '2026-09-01T10:00:00+08:00' },
      { uid: 'all-day', summary: '休息', location: null, start: '2026-09-02', end: '2026-09-03' },
    ]);
    expect(calls).toHaveLength(2);
    expect(calls[0]?.pathname).toContain('/calendars/primary/events');
    expect(calls[0]?.searchParams.get('singleEvents')).toBe('true');
  });

  it('creates an event without leaking the token into the result', async () => {
    let requestBody: unknown;
    const adapter = new GoogleCalendarAdapter({
      accessToken: 'secret-token',
      calendarIds: { work: 'primary', life: 'life' },
      fetchImpl: async (_input, init) => {
        requestBody = JSON.parse(String(init?.body));
        return Response.json({
          id: 'event-1', summary: 'Review', location: null,
          start: { dateTime: '2026-09-01T12:00:00Z' }, end: { dateTime: '2026-09-01T13:00:00Z' },
        });
      },
    });

    const event = await adapter.createEvent('work', {
      summary: 'Review', start: '2026-09-01T12:00:00Z', end: '2026-09-01T13:00:00Z', location: null,
    });

    expect(requestBody).toEqual({
      summary: 'Review', location: undefined,
      start: { dateTime: '2026-09-01T12:00:00Z' }, end: { dateTime: '2026-09-01T13:00:00Z' },
    });
    expect(JSON.stringify(event)).not.toContain('secret-token');
    expect(event.uid).toBe('event-1');
  });
});
