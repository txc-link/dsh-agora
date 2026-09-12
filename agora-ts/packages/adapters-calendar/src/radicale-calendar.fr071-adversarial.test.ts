/**
 * FR-071 independent adversarial suite.
 *
 * Author: non-implementer independent reviewer.
 * Scope: CalDAV PUT write path, path confinement, collection isolation,
 * create-only/duplicate-UID semantics, time-shape validation, timeout and
 * upstream-error fail-closed behavior.
 *
 * This file is additive only. It does not modify any implementation file.
 */
import { describe, expect, it } from 'vitest';
import { parseICalEvents } from './ical.js';
import { RadicaleCalendarAdapter } from './radicale-calendar.js';
import { RadicaleClient } from './radicale-client.js';

const BASE = 'http://127.0.0.1:5232';
const WORK = '/tester/work/';
const LIFE = '/tester/life/';
const VALID_INPUT = {
  summary: 'synthetic review probe',
  start: '2026-09-01T09:00:00Z',
  end: '2026-09-01T10:00:00Z',
  location: 'synthetic-only',
};

interface Call {
  readonly url: URL;
  readonly method: string;
  readonly headers: Record<string, string>;
  readonly body: string | null;
}

function recordingFetch(
  calls: Call[],
  responder: (url: URL, init: RequestInit | undefined) => Response | Promise<Response>,
): typeof fetch {
  return async (input, init) => {
    const url = new URL(String(input));
    const headerMap: Record<string, string> = {};
    new Headers(init?.headers).forEach((value, key) => { headerMap[key.toLowerCase()] = value; });
    calls.push({
      url,
      method: init?.method ?? 'GET',
      headers: headerMap,
      body: typeof init?.body === 'string' ? init.body : null,
    });
    return responder(url, init);
  };
}

async function attemptPut(path: string): Promise<{ calls: Call[]; error: unknown }> {
  const calls: Call[] = [];
  const client = new RadicaleClient({
    baseUrl: BASE,
    username: 'u',
    password: 'p',
    fetchImpl: recordingFetch(calls, () => new Response(null, { status: 201 })),
  });
  let error: unknown = null;
  try {
    await client.putEvent(path, 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n');
  } catch (caught) {
    error = caught;
  }
  return { calls, error };
}

async function attemptCreate(
  domain: string,
  input: { summary: string; start: string; end: string; location?: string | null },
  ref = 'probe@agora',
  status = 201,
): Promise<{ calls: Call[]; error: unknown; event: unknown }> {
  const calls: Call[] = [];
  const client = new RadicaleClient({
    baseUrl: BASE,
    username: 'tester',
    password: 'secret',
    fetchImpl: recordingFetch(calls, () => new Response(null, { status })),
  });
  const adapter = new RadicaleCalendarAdapter({
    client,
    collections: { work: WORK, life: LIFE },
    newEventRef: () => ref,
    now: () => new Date('2026-09-12T12:00:00Z'),
  });
  let error: unknown = null;
  let event: unknown = null;
  try {
    event = await adapter.createEvent(domain as 'work', input);
  } catch (caught) {
    error = caught;
  }
  return { calls, error, event };
}

describe('FR-071 independent adversarial — CalDAV path confinement', () => {
  it('D-ADV-P01 rejects literal traversal before network', async () => {
    const result = await attemptPut('/tester/work/../life/a.ics');
    expect(result.error).toBeInstanceOf(TypeError);
    expect(result.calls).toEqual([]);
  });

  it.each([
    '/tester/work/%2e%2e/life/a.ics',
    '/tester/work/%2E%2E/life/a.ics',
    '/tester/work/%2e./life/a.ics',
    '/tester/work/.%2e/life/a.ics',
  ])('D-ADV-P02 rejects URL-encoded traversal before network: %s', async (path) => {
    const result = await attemptPut(path);
    expect(result.error).toBeInstanceOf(TypeError);
    expect(result.calls).toEqual([]);
  });

  it.each([
    '/tester/work/%2e%2e%2flife/a.ics',
    '/tester/work/%5c..%5clife%5ca.ics',
    '/tester/work/%252e%252e/life/a.ics',
    '/tester/work/\u200b.\u200b./life/a.ics',
    '/tester/work/．．/life/a.ics',
    '/tester/work/%ef%bc%8e%ef%bc%8e/life/a.ics',
  ])('D-ADV-P03 suspicious-but-contained variant cannot escape work: %s', async (path) => {
    const result = await attemptPut(path);
    if (!result.error) {
      expect(result.calls).toHaveLength(1);
      expect(result.calls[0]?.url.pathname.startsWith(WORK)).toBe(true);
    }
  });
});

describe('FR-071 independent adversarial — collection/domain isolation', () => {
  it('D-ADV-C01 work domain writes only under the work collection', async () => {
    const result = await attemptCreate('work', VALID_INPUT, 'work-ref@agora');
    expect(result.error).toBeNull();
    expect(result.calls).toHaveLength(1);
    expect(result.calls[0]?.url.pathname).toBe(`${WORK}work-ref@agora.ics`);
  });

  it('D-ADV-C02 life domain writes only under the life collection', async () => {
    const result = await attemptCreate('life', VALID_INPUT, 'life-ref@agora');
    expect(result.error).toBeNull();
    expect(result.calls).toHaveLength(1);
    expect(result.calls[0]?.url.pathname).toBe(`${LIFE}life-ref@agora.ics`);
  });

  it('D-ADV-C03 unknown runtime domain must not fall through to life', async () => {
    const result = await attemptCreate('admin', VALID_INPUT, 'admin-ref@agora');
    expect(result.error).toBeInstanceOf(TypeError);
    expect(result.calls).toEqual([]);
  });

  it('D-ADV-C05 rejects protocol-relative collection before network', async () => {
    const calls: Call[] = [];
    const client = new RadicaleClient({
      baseUrl: BASE,
      username: 'tester',
      password: 'secret',
      fetchImpl: recordingFetch(calls, () => new Response(null, { status: 201 })),
    });
    const adapter = new RadicaleCalendarAdapter({
      client,
      collections: { work: '//evil.example/tester/work', life: LIFE },
      newEventRef: () => 'evil-ref@agora',
      now: () => new Date('2026-09-12T12:00:00Z'),
    });
    let error: unknown = null;
    try {
      await adapter.createEvent('work', VALID_INPUT);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(TypeError);
    expect(calls).toEqual([]);
  });

  it.each([
    '../life/escape',
    '%2e%2e/life/escape',
    'a/b',
    'a\\b',
    'a\nb',
  ])('D-ADV-C04 rejects hostile event ref before network: %s', async (ref) => {
    const result = await attemptCreate('work', VALID_INPUT, ref);
    expect(result.error).toBeInstanceOf(TypeError);
    expect(result.calls).toEqual([]);
  });
});

describe('FR-071 independent adversarial — create-only / duplicate UID', () => {
  it('D-ADV-D01 sends If-None-Match: * for create-only writes', async () => {
    const result = await attemptCreate('work', VALID_INPUT, 'create-only@agora');
    expect(result.error).toBeNull();
    expect(result.calls[0]?.headers['if-none-match']).toBe('*');
  });

  it('D-ADV-D02 upstream 412 rejects and never reports success', async () => {
    const result = await attemptCreate('work', VALID_INPUT, 'dup@agora', 412);
    expect(result.error).toBeInstanceOf(Error);
    expect(String(result.error)).toMatch(/412/u);
    expect(result.event).toBeNull();
  });

  it('D-ADV-D03 duplicate UID reuses the same resource path and fails closed', async () => {
    let call = 0;
    const calls: Call[] = [];
    const client = new RadicaleClient({
      baseUrl: BASE,
      username: 'tester',
      password: 'secret',
      fetchImpl: recordingFetch(calls, () => new Response(null, { status: call++ === 0 ? 201 : 412 })),
    });
    const adapter = new RadicaleCalendarAdapter({
      client,
      collections: { work: WORK, life: LIFE },
      newEventRef: () => 'same@agora',
      now: () => new Date('2026-09-12T12:00:00Z'),
    });
    await expect(adapter.createEvent('work', VALID_INPUT)).resolves.toMatchObject({ uid: 'same@agora' });
    await expect(adapter.createEvent('work', VALID_INPUT)).rejects.toThrow(/412/u);
    expect(calls).toHaveLength(2);
    expect(calls[0]?.url.pathname).toBe(calls[1]?.url.pathname);
    expect(calls[1]?.headers['if-none-match']).toBe('*');
  });
});

describe('FR-071 independent adversarial — time-shape fail-closed', () => {
  it('D-ADV-T01 valid UTC round-trips through the same DTO shape', async () => {
    const result = await attemptCreate('work', VALID_INPUT, 'utc@agora');
    expect(result.error).toBeNull();
    expect(result.event).toEqual({
      uid: 'utc@agora',
      summary: VALID_INPUT.summary,
      start: VALID_INPUT.start,
      end: VALID_INPUT.end,
      location: VALID_INPUT.location,
    });
  });

  it('D-ADV-T02 zone-qualified ISO is normalised to UTC', async () => {
    const result = await attemptCreate('work', {
      summary: 'offset probe',
      start: '2026-09-01T17:00:00+08:00',
      end: '2026-09-01T18:00:00+08:00',
    }, 'offset@agora');
    expect(result.error).toBeNull();
    expect(result.event).toMatchObject({
      start: '2026-09-01T09:00:00Z',
      end: '2026-09-01T10:00:00Z',
    });
  });

  it('D-ADV-T03 floating wall-clock remains floating', async () => {
    const result = await attemptCreate('work', {
      summary: 'floating probe',
      start: '2026-09-01T09:00:00',
      end: '2026-09-01T10:00:00',
    }, 'floating@agora');
    expect(result.error).toBeNull();
    expect(result.event).toMatchObject({
      start: '2026-09-01T09:00:00',
      end: '2026-09-01T10:00:00',
    });
  });

  it.each(['Infinity', 'NaN', '2026-09-01T25:00:00Z', '2026-09-01T09:60:00Z', '2026-09-01T09:00:00+99:00'])(
    'D-ADV-T04 rejects non-finite/invalid time value before network: %s',
    async (bad) => {
      const result = await attemptCreate('work', { summary: 'bad time', start: bad, end: validEndFor(bad) }, 'bad@agora');
      expect(result.error).toBeInstanceOf(TypeError);
      expect(result.calls).toEqual([]);
    },
  );

  it('D-ADV-T05 rejects Gregorian-impossible date 2026-02-30 before network', async () => {
    const result = await attemptCreate('work', {
      summary: 'invalid gregorian date',
      start: '2026-02-30T09:00:00Z',
      end: '2026-02-30T10:00:00Z',
    }, 'feb30@agora');
    expect(result.error).toBeInstanceOf(TypeError);
    expect(result.calls).toEqual([]);
  });

  it('D-ADV-T06 rejects Gregorian-impossible date 2026-04-31 before network', async () => {
    const result = await attemptCreate('work', {
      summary: 'invalid gregorian date',
      start: '2026-04-31T09:00:00Z',
      end: '2026-04-31T10:00:00Z',
    }, 'apr31@agora');
    expect(result.error).toBeInstanceOf(TypeError);
    expect(result.calls).toEqual([]);
  });

  it('D-ADV-T07 rejects impossible compact RFC 5545 date-time before network', async () => {
    const result = await attemptCreate('work', {
      summary: 'invalid compact',
      start: '20261399T999999Z',
      end: '20261400T999999Z',
    }, 'compact@agora');
    expect(result.error).toBeInstanceOf(TypeError);
    expect(result.calls).toEqual([]);
  });

  it('D-ADV-T08 rejects reverse-order mixed ISO/compact date-time before network', async () => {
    const result = await attemptCreate('work', {
      summary: 'reverse mixed',
      start: '2026-09-01T09:00:00Z',
      end: '20260901T080000Z',
    }, 'mixed@agora');
    expect(result.error).toBeInstanceOf(TypeError);
    expect(result.calls).toEqual([]);
  });
});

describe('FR-071 independent adversarial — timeout and upstream errors', () => {
  it('D-ADV-E01 timeout abort fails closed', async () => {
    const client = new RadicaleClient({
      baseUrl: BASE,
      username: 'u',
      password: 'p',
      timeoutMs: 10,
      fetchImpl: (_input, init) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
      }),
    });
    await expect(client.putEvent('/tester/work/a.ics', 'x')).rejects.toThrow(/abort/iu);
  });

  it('D-ADV-E02 upstream error body is not echoed in the thrown error', async () => {
    const client = new RadicaleClient({
      baseUrl: BASE,
      username: 'u',
      password: 'p',
      fetchImpl: async () => new Response('SECRET_UPSTREAM_BODY', { status: 500, statusText: 'Server Error' }),
    });
    let error: unknown = null;
    try {
      await client.putEvent('/tester/work/a.ics', 'x');
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(Error);
    expect(String(error)).toContain('radicale 500');
    expect(String(error)).not.toContain('SECRET_UPSTREAM_BODY');
  });

  it('D-ADV-E03 non-2xx redirect/status is not treated as success', async () => {
    const client = new RadicaleClient({
      baseUrl: BASE,
      username: 'u',
      password: 'p',
      fetchImpl: async () => new Response(null, { status: 302 }),
    });
    await expect(client.putEvent('/tester/work/a.ics', 'x')).rejects.toThrow(/302/u);
  });
});

describe('FR-071 independent adversarial — host confinement', () => {
  it.each([
    '//evil.example/tester/work/a.ics',
    '///evil.example/tester/work/a.ics',
    '/\\evil.example/tester/work/a.ics',
  ])('D-ADV-P04 rejects protocol-relative/backslash host switch before network: %s', async (path) => {
    const result = await attemptPut(path);
    expect(result.error).toBeInstanceOf(TypeError);
    expect(result.calls).toEqual([]);
  });
});

function validEndFor(bad: string): string {
  if (bad === '2026-09-01T25:00:00Z') return '2026-09-01T26:00:00Z';
  if (bad === '2026-09-01T09:60:00Z') return '2026-09-01T10:60:00Z';
  if (bad === '2026-09-01T09:00:00+99:00') return '2026-09-01T10:00:00+99:00';
  return '2026-09-01T10:00:00Z';
}
