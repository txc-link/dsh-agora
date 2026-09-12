import { describe, expect, it } from 'vitest';
import { parseICalEvents } from './ical.js';
import { RadicaleCalendarAdapter } from './radicale-calendar.js';
import { RadicaleClient } from './radicale-client.js';

interface Call {
  readonly url: URL;
  readonly method: string;
  readonly headers: Record<string, string>;
  readonly body: string | null;
}

function harness(options: {
  status?: number;
  collections?: { work: string; life: string };
  newEventRef?: (domain: 'work' | 'life') => string;
}) {
  const calls: Call[] = [];
  const client = new RadicaleClient({
    baseUrl: 'http://127.0.0.1:5232',
    username: 'tester',
    password: 'secret',
    fetchImpl: async (input, init) => {
      const headers = Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>).map(([k, v]) => [k.toLowerCase(), v]));
      calls.push({
        url: new URL(String(input)),
        method: init?.method ?? 'GET',
        headers,
        body: typeof init?.body === 'string' ? init.body : null,
      });
      return new Response(null, { status: options.status ?? 201 });
    },
  });
  const adapter = new RadicaleCalendarAdapter({
    client,
    collections: options.collections ?? { work: '/tester/work/', life: '/tester/life/' },
    ...(options.newEventRef === undefined ? {} : { newEventRef: options.newEventRef }),
    now: () => new Date('2026-09-12T04:00:00Z'),
  });
  return { adapter, calls };
}

const INPUT = { summary: 'Design review', start: '2026-09-01T09:00:00Z', end: '2026-09-01T10:00:00Z', location: 'Conf room A' };

describe('RadicaleCalendarAdapter.createEvent', () => {
  it('PUTs one .ics resource into the domain collection with create-only semantics', async () => {
    const { adapter, calls } = harness({ newEventRef: () => 'generated-1@agora' });

    const event = await adapter.createEvent('work', INPUT);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.method).toBe('PUT');
    expect(calls[0]?.url.toString()).toBe('http://127.0.0.1:5232/tester/work/generated-1@agora.ics');
    expect(calls[0]?.headers['content-type']).toBe('text/calendar; charset=utf-8');
    expect(calls[0]?.headers['if-none-match']).toBe('*');
    expect(calls[0]?.headers.authorization).toBe(`Basic ${Buffer.from('tester:secret').toString('base64')}`);
    expect(calls[0]?.body).toContain('UID:generated-1@agora\r\n');
    expect(calls[0]?.body).toContain('DTSTART:20260901T090000Z\r\n');
    expect(calls[0]?.body).toContain('SUMMARY:Design review\r\n');
    // The DTO must be exactly what a later listEvents would report for this body.
    expect(event).toEqual(parseICalEvents(String(calls[0]?.body))[0]);
    expect(event).toEqual({
      uid: 'generated-1@agora', summary: 'Design review',
      start: '2026-09-01T09:00:00Z', end: '2026-09-01T10:00:00Z', location: 'Conf room A',
    });
  });

  it('routes the life domain to the life collection and omits a blank location', async () => {
    const { adapter, calls } = harness({ newEventRef: () => 'life-1@agora' });

    const event = await adapter.createEvent('life', { ...INPUT, location: '  ' });

    expect(calls[0]?.url.pathname).toBe('/tester/life/life-1@agora.ics');
    expect(calls[0]?.body).not.toContain('LOCATION:');
    expect(event.location).toBeNull();
  });

  it('keeps listEvents on the read path (GET, unchanged)', async () => {
    const { adapter, calls } = harness({
      newEventRef: () => 'x',
    });

    await adapter.listEvents('work');

    expect(calls.map(call => call.method)).toEqual(['GET']);
    expect(calls[0]?.url.pathname).toBe('/tester/work/');
  });

  it('fails closed when the server rejects the write (no silent success)', async () => {
    const { adapter, calls } = harness({ status: 412, newEventRef: () => 'dup@agora' });

    await expect(adapter.createEvent('work', INPUT)).rejects.toThrow(/radicale 412/u);
    expect(calls).toHaveLength(1);
  });

  it('refuses refs that could escape the collection and never calls the network', async () => {
    for (const ref of ['../secrets', 'a/b', 'a b', 'a\nb', '', 'a?x=1']) {
      const { adapter, calls } = harness({ newEventRef: () => ref });
      await expect(adapter.createEvent('work', INPUT)).rejects.toThrow(TypeError);
      expect(calls).toHaveLength(0);
    }
  });

  it('refuses a relative collection before writing', async () => {
    const { adapter, calls } = harness({ collections: { work: 'tester/work', life: '/tester/life/' } });

    await expect(adapter.createEvent('work', INPUT)).rejects.toThrow(/must be an absolute path/u);
    expect(calls).toHaveLength(0);
  });

  it('validates the event body before touching the network', async () => {
    const { adapter, calls } = harness({});

    await expect(adapter.createEvent('work', { ...INPUT, summary: '   ' })).rejects.toThrow(/summary is required/u);
    await expect(adapter.createEvent('work', { ...INPUT, end: '2026-09-01T08:00:00Z' })).rejects.toThrow(/end must be after start/u);
    expect(calls).toHaveLength(0);
  });
});

describe('RadicaleClient.putEvent path guard', () => {
  it('rejects relative paths and traversal', async () => {
    const client = new RadicaleClient({
      baseUrl: 'http://127.0.0.1:5232', username: 'u', password: 'p',
      fetchImpl: async () => new Response(null, { status: 201 }),
    });

    await expect(client.putEvent('tester/work/a.ics', 'x')).rejects.toThrow(/must be absolute/u);
    await expect(client.putEvent('/tester/work/../life/a.ics', 'x')).rejects.toThrow(/traverse/u);
  });

  it('sends If-Match for updates when requested', async () => {
    const calls: Call[] = [];
    const client = new RadicaleClient({
      baseUrl: 'http://127.0.0.1:5232', username: 'u', password: 'p',
      fetchImpl: async (input, init) => {
        calls.push({ url: new URL(String(input)), method: init?.method ?? 'GET', headers: (init?.headers ?? {}) as Record<string, string>, body: null });
        return new Response(null, { status: 204 });
      },
    });

    await client.putEvent('/tester/work/a.ics', 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n', { ifMatch: '"v7"' });

    expect(calls[0]?.method).toBe('PUT');
    expect(calls[0]?.headers['if-match']).toBe('"v7"');
    expect(calls[0]?.headers['if-none-match']).toBeUndefined();
  });
});
