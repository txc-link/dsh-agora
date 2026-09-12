/**
 * Minimal Radicale CalDAV client.
 *
 * Scope: fetch a collection's events as a single iCalendar (.ics) blob
 * (GET) and create/replace one event resource (CalDAV `PUT`,
 * RFC 4791 §5.3.2) — both over HTTP basic auth. Radicale exposes
 * calendars as
 *   {baseUrl}/{user}/{collection}/<event>.ics
 * The compact list of events can be obtained by issuing a PROPFIND on
 * the collection and then GETting each href; for v0.1 we fetch a single
 * "feed" endpoint that Radicale can publish via its --export flag, and
 * fall back to PROPFIND + per-event GETs for accuracy. The interface is
 * deliberately narrow (`fetchCollection`) so the Core CalendarService
 * can swap in a stub for tests.
 */
import type { CalendarEventDto } from '@agora-ts/contracts';
import { parseICalEvents } from './ical.js';

export interface RadicaleClientOptions {
  baseUrl: string;
  username: string;
  password: string;
  /** Optional Node 20+ global fetch override for tests. */
  fetchImpl?: typeof fetch;
  /** Optional timeout in ms (default 8000). */
  timeoutMs?: number;
}

export interface RadicalePutOptions {
  /**
   * Create-only write: sends `If-None-Match: *` so the server rejects the
   * write (412) instead of overwriting an existing resource.
   */
  readonly createOnly?: boolean;
  /** Optimistic concurrency for updates: sent as `If-Match` when set. */
  readonly ifMatch?: string | null;
}

export class RadicaleClient {
  constructor(private readonly options: RadicaleClientOptions) {}

  private get fetchImpl(): typeof fetch {
    return this.options.fetchImpl ?? globalThis.fetch;
  }

  private authHeader(): string {
    const token = Buffer.from(`${this.options.username}:${this.options.password}`).toString('base64');
    return `Basic ${token}`;
  }

  private async fetchIcs(path: string): Promise<string> {
    const url = new URL(path, this.options.baseUrl).toString();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 8000);
    try {
      const response = await this.fetchImpl(url, {
        method: 'GET',
        headers: {
          authorization: this.authHeader(),
          accept: 'text/calendar',
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`radicale ${response.status} ${response.statusText} for ${path}`);
      }
      return await response.text();
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Create or replace one calendar object resource (CalDAV `PUT`).
   *
   * `eventPath` is relative to baseUrl and must be absolute
   * (e.g. `/tester/work/<uid>.ics`). Collection traversal is refused: the
   * adapter owns path construction, so a traversal attempt means a caller
   * is trying to write outside the configured collection.
   */
  async putEvent(eventPath: string, ics: string, options: RadicalePutOptions = {}): Promise<void> {
    const path = assertCalDavPath(eventPath);
    const headers: Record<string, string> = {
      authorization: this.authHeader(),
      'content-type': 'text/calendar; charset=utf-8',
    };
    if (options.createOnly === true) {
      headers['if-none-match'] = '*';
    } else if (options.ifMatch) {
      headers['if-match'] = options.ifMatch;
    }
    const url = new URL(path, this.options.baseUrl).toString();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 8000);
    try {
      const response = await this.fetchImpl(url, {
        method: 'PUT',
        headers,
        body: ics,
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`radicale ${response.status} ${response.statusText} for ${path}`);
      }
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Fetch a calendar collection's events. The path is the collection
   * relative to baseUrl (e.g. "/alice/work/"). Returns parsed events.
   */
  async fetchCollection(collectionPath: string): Promise<CalendarEventDto[]> {
    const ics = await this.fetchIcs(collectionPath.replace(/\/$/u, '') + '/');
    return parseICalEvents(ics);
  }
}

function assertCalDavPath(path: string): string {
  const value = path.trim();
  if (!value.startsWith('/')) throw new TypeError('CalDAV path must be absolute (start with "/")');
  if (value.includes('..')) throw new TypeError('CalDAV path must not traverse collections');
  if (hasControlCharacter(value)) throw new TypeError('CalDAV path must not contain control characters');
  return value;
}

/** True when any code point is a C0 control (includes CR/LF/NUL) or DEL. */
function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}
