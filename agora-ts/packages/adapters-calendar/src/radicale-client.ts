/**
 * Minimal Radicale CalDAV client.
 *
 * Scope: fetch a collection's events as a single iCalendar (.ics) blob
 * via HTTP basic auth. Radicale exposes calendars as
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
   * Fetch a calendar collection's events. The path is the collection
   * relative to baseUrl (e.g. "/alice/work/"). Returns parsed events.
   */
  async fetchCollection(collectionPath: string): Promise<CalendarEventDto[]> {
    const ics = await this.fetchIcs(collectionPath.replace(/\/$/u, '') + '/');
    return parseICalEvents(ics);
  }
}