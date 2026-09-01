import type { CalendarDomainDto, CalendarEventDto } from '@agora-ts/contracts';
import type { LinkedCalendarEventState } from '@agora-ts/core';

type AccessTokenSource = string | (() => string | Promise<string>);

export interface GoogleCalendarAdapterOptions {
  readonly accessToken: AccessTokenSource;
  readonly calendarIds: { readonly work: string; readonly life: string };
  readonly baseUrl?: string;
  readonly fetchImpl?: typeof globalThis.fetch;
  readonly timeoutMs?: number;
  readonly now?: () => Date;
  readonly pastDays?: number;
  readonly futureDays?: number;
}

export interface GoogleCalendarCreateEventInput {
  readonly summary: string;
  readonly start: string;
  readonly end: string;
  readonly location?: string | null;
}

interface GoogleEvent {
  id?: string;
  etag?: string;
  status?: string;
  summary?: string;
  location?: string | null;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

export class GoogleCalendarAdapter {
  readonly providerId = 'google-calendar';
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly origin: URL;

  constructor(private readonly options: GoogleCalendarAdapterOptions) {
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.origin = new URL(options.baseUrl ?? 'https://www.googleapis.com');
  }

  async listEvents(domain: CalendarDomainDto): Promise<CalendarEventDto[]> {
    const events: CalendarEventDto[] = [];
    let pageToken: string | undefined;
    do {
      const url = this.eventsUrl(domain);
      url.searchParams.set('singleEvents', 'true');
      url.searchParams.set('orderBy', 'startTime');
      url.searchParams.set('maxResults', '2500');
      const now = this.options.now?.() ?? new Date();
      const pastDays = this.options.pastDays ?? 1;
      const futureDays = this.options.futureDays ?? 30;
      url.searchParams.set('timeMin', new Date(now.getTime() - pastDays * 86_400_000).toISOString());
      url.searchParams.set('timeMax', new Date(now.getTime() + futureDays * 86_400_000).toISOString());
      if (pageToken) url.searchParams.set('pageToken', pageToken);
      const page = await this.requestJson<{ items?: GoogleEvent[]; nextPageToken?: string }>(url, { method: 'GET' });
      for (const item of page.items ?? []) {
        const mapped = mapGoogleEvent(item);
        if (mapped) events.push(mapped);
      }
      pageToken = page.nextPageToken?.trim() || undefined;
    } while (pageToken);
    return events;
  }

  async createEvent(domain: CalendarDomainDto, input: GoogleCalendarCreateEventInput): Promise<CalendarEventDto> {
    const event = await this.requestJson<GoogleEvent>(this.eventsUrl(domain), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        summary: required(input.summary, 'summary'),
        ...(input.location ? { location: input.location } : {}),
        start: eventTime(input.start),
        end: eventTime(input.end),
      }),
    });
    const mapped = mapGoogleEvent(event);
    if (!mapped) throw new Error('Google Calendar create returned an incomplete event');
    return mapped;
  }

  async getEventState(domain: CalendarDomainDto, eventRef: string): Promise<LinkedCalendarEventState> {
    const ref = required(eventRef, 'eventRef');
    const response = await this.request(this.eventUrl(domain, ref), { method: 'GET' });
    if (response.status === 404 || response.status === 410) {
      return { ref, state: 'cancelled', version: null };
    }
    await ensureOk(response, 'Google Calendar', 'GET', this.eventUrl(domain, ref).pathname);
    const event = await response.json() as GoogleEvent;
    return {
      ref,
      state: event.status === 'cancelled' ? 'cancelled' : 'scheduled',
      version: event.etag?.trim() || null,
    };
  }

  async cancelEvent(domain: CalendarDomainDto, eventRef: string, version?: string | null): Promise<void> {
    const ref = required(eventRef, 'eventRef');
    const url = this.eventUrl(domain, ref);
    const response = await this.request(url, {
      method: 'DELETE',
      ...(version ? { headers: { 'if-match': version } } : {}),
    });
    if (response.status === 404 || response.status === 410) return;
    await ensureOk(response, 'Google Calendar', 'DELETE', url.pathname);
  }

  private eventsUrl(domain: CalendarDomainDto): URL {
    const calendarId = domain === 'work' ? this.options.calendarIds.work : this.options.calendarIds.life;
    return new URL(`/calendar/v3/calendars/${encodeURIComponent(required(calendarId, `${domain} calendarId`))}/events`, this.origin);
  }

  private eventUrl(domain: CalendarDomainDto, eventRef: string): URL {
    const url = this.eventsUrl(domain);
    url.pathname += `/${encodeURIComponent(required(eventRef, 'eventRef'))}`;
    return url;
  }

  private async requestJson<T>(url: URL, init: RequestInit): Promise<T> {
    const response = await this.request(url, init);
    await ensureOk(response, 'Google Calendar', init.method ?? 'GET', url.pathname);
    return await response.json() as T;
  }

  private async request(url: URL, init: RequestInit): Promise<Response> {
    const token = await resolveToken(this.options.accessToken);
    const timeout = AbortSignal.timeout(this.options.timeoutMs ?? 10_000);
    return await this.fetchImpl(url, {
      ...init,
      headers: { accept: 'application/json', authorization: `Bearer ${token}`, ...init.headers },
      signal: timeout,
    });
  }
}

async function ensureOk(response: Response, provider: string, method: string, path: string): Promise<void> {
  if (!response.ok) throw new Error(`${provider} returned HTTP ${response.status} for ${method} ${path}`);
}

function mapGoogleEvent(event: GoogleEvent): CalendarEventDto | null {
  if (event.status === 'cancelled') return null;
  const uid = event.id?.trim();
  const start = event.start?.dateTime ?? event.start?.date;
  const end = event.end?.dateTime ?? event.end?.date;
  if (!uid || !start || !end) return null;
  return { uid, summary: event.summary?.trim() || '(untitled)', start, end, location: event.location?.trim() || null };
}

function eventTime(value: string): { date: string } | { dateTime: string } {
  const normalized = required(value, 'event time');
  return /^\d{4}-\d{2}-\d{2}$/u.test(normalized) ? { date: normalized } : { dateTime: normalized };
}

async function resolveToken(source: AccessTokenSource): Promise<string> {
  return required(typeof source === 'function' ? await source() : source, 'Google Calendar access token');
}

function required(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new TypeError(`${label} is required`);
  return normalized;
}
