import type { CalendarDomainDto, CalendarEventDto } from '@agora-ts/contracts';

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

  private eventsUrl(domain: CalendarDomainDto): URL {
    const calendarId = domain === 'work' ? this.options.calendarIds.work : this.options.calendarIds.life;
    return new URL(`/calendar/v3/calendars/${encodeURIComponent(required(calendarId, `${domain} calendarId`))}/events`, this.origin);
  }

  private async requestJson<T>(url: URL, init: RequestInit): Promise<T> {
    const token = await resolveToken(this.options.accessToken);
    const timeout = AbortSignal.timeout(this.options.timeoutMs ?? 10_000);
    const response = await this.fetchImpl(url, {
      ...init,
      headers: { accept: 'application/json', authorization: `Bearer ${token}`, ...init.headers },
      signal: timeout,
    });
    if (!response.ok) throw new Error(`Google Calendar returned HTTP ${response.status} for ${init.method ?? 'GET'} ${url.pathname}`);
    return await response.json() as T;
  }
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
