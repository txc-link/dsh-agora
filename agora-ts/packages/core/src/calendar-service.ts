import type { CalendarConflictDto, CalendarEventDto, CalendarDomainDto } from '@agora-ts/contracts';
import type { CalendarProviderPort } from './calendar-provider-port.js';
import { computeCalendarConflicts, generateCalendarEveningReport, generateCalendarMorningReport } from './calendar-reporting.js';

export interface CalendarServiceOptions {
  provider: CalendarProviderPort;
  /** Timezone offset in minutes for "today" boundaries (default 0 = UTC). */
  timezoneOffsetMinutes?: number;
  /** Clock injected for deterministic tests. */
  now?: () => Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Return the YYYY-MM-DD date (in the configured timezone) for a given
 * instant. Used to bucket events into "today" / "tomorrow".
 */
export function isoDateInTz(date: Date, offsetMinutes: number): string {
  const shifted = new Date(date.getTime() + offsetMinutes * 60_000);
  return shifted.toISOString().slice(0, 10);
}

function bucketByDate(events: CalendarEventDto[], date: string): CalendarEventDto[] {
  return events.filter((event) => event.start.slice(0, 10) === date || event.end.slice(0, 10) === date);
}

/**
 * CalendarService — orchestrates a provider-neutral calendar port for the
 * commitment / commitment-calendar projection. All read methods are
 * async because they fan out to the adapter; the morning/evening
 * builders compose Core-owned pure formatters.
 */
export class CalendarService {
  private readonly provider: CalendarProviderPort;
  private readonly offsetMinutes: number;
  private readonly now: () => Date;

  constructor(options: CalendarServiceOptions) {
    this.provider = options.provider;
    this.offsetMinutes = options.timezoneOffsetMinutes ?? 0;
    this.now = options.now ?? (() => new Date());
  }

  private currentDate(): string {
    return isoDateInTz(this.now(), this.offsetMinutes);
  }

  private tomorrowDate(): string {
    const tomorrow = new Date(this.now().getTime() + DAY_MS);
    return isoDateInTz(tomorrow, this.offsetMinutes);
  }

  async listEvents(domain: CalendarDomainDto): Promise<CalendarEventDto[]> {
    return this.provider.listEvents(domain);
  }

  async listToday(domain: CalendarDomainDto): Promise<CalendarEventDto[]> {
    const events = await this.listEvents(domain);
    return bucketByDate(events, this.currentDate());
  }

  async listTomorrow(domain: CalendarDomainDto): Promise<CalendarEventDto[]> {
    const events = await this.listEvents(domain);
    return bucketByDate(events, this.tomorrowDate());
  }

  async listConflicts(domain: CalendarDomainDto): Promise<CalendarConflictDto[]> {
    const events = await this.listEvents(domain);
    return computeCalendarConflicts(events);
  }

  async morningReport(domain: CalendarDomainDto): Promise<string> {
    const events = await this.listEvents(domain);
    const conflicts = computeCalendarConflicts(events);
    return generateCalendarMorningReport({ domain, date: this.currentDate(), events, conflicts });
  }

  async eveningReport(domain: CalendarDomainDto): Promise<string> {
    const events = await this.listEvents(domain);
    const tomorrow = await this.listTomorrow(domain);
    const conflicts = computeCalendarConflicts(events);
    return generateCalendarEveningReport({
      domain,
      date: this.currentDate(),
      today: events,
      tomorrow,
      pendingConflicts: conflicts,
    });
  }
}
