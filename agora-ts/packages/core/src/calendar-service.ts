import type { CalendarConflictDto, CalendarEventDto, CalendarDomainDto } from '@agora-ts/contracts';
import {
  computeConflicts,
  generateEveningReport,
  generateMorningReport,
  type RadicaleClient,
} from '@agora-ts/adapters-calendar';

export interface CalendarServiceCollections {
  work: string;
  life: string;
}

export interface CalendarServiceOptions {
  client: RadicaleClient;
  collections: CalendarServiceCollections;
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
 * CalendarService — orchestrates the Radicale adapter for the
 * commitment / commitment-calendar projection. All read methods are
 * async because they fan out to the adapter; the morning/evening
 * builders compose the pure formatters from `@agora-ts/adapters-calendar`.
 */
export class CalendarService {
  private readonly client: RadicaleClient;
  private readonly collections: CalendarServiceCollections;
  private readonly offsetMinutes: number;
  private readonly now: () => Date;

  constructor(options: CalendarServiceOptions) {
    this.client = options.client;
    this.collections = options.collections;
    this.offsetMinutes = options.timezoneOffsetMinutes ?? 0;
    this.now = options.now ?? (() => new Date());
  }

  private collectionPath(domain: CalendarDomainDto): string {
    return domain === 'work' ? this.collections.work : this.collections.life;
  }

  private currentDate(): string {
    return isoDateInTz(this.now(), this.offsetMinutes);
  }

  private tomorrowDate(): string {
    const tomorrow = new Date(this.now().getTime() + DAY_MS);
    return isoDateInTz(tomorrow, this.offsetMinutes);
  }

  async listEvents(domain: CalendarDomainDto): Promise<CalendarEventDto[]> {
    return this.client.fetchCollection(this.collectionPath(domain));
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
    return computeConflicts(events);
  }

  async morningReport(domain: CalendarDomainDto): Promise<string> {
    const events = await this.listEvents(domain);
    const conflicts = computeConflicts(events);
    return generateMorningReport({ domain, date: this.currentDate(), events, conflicts });
  }

  async eveningReport(domain: CalendarDomainDto): Promise<string> {
    const events = await this.listEvents(domain);
    const tomorrow = await this.listTomorrow(domain);
    const conflicts = computeConflicts(events);
    return generateEveningReport({
      domain,
      date: this.currentDate(),
      today: events,
      tomorrow,
      pendingConflicts: conflicts,
    });
  }
}