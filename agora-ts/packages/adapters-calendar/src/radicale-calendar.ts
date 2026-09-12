import { randomUUID } from 'node:crypto';
import type { CalendarDomainDto, CalendarEventDto } from '@agora-ts/contracts';
import type { CreateCalendarEventInput } from '@agora-ts/core';
import { parseICalEvents } from './ical.js';
import { serializeICalEvent } from './ical-serialize.js';
import type { RadicaleClient } from './radicale-client.js';

export interface RadicaleCalendarAdapterOptions {
  readonly client: RadicaleClient;
  readonly collections: { readonly work: string; readonly life: string };
  /** Event ref factory; defaults to `<uuid>@agora`. Injected for deterministic tests. */
  readonly newEventRef?: (domain: CalendarDomainDto) => string;
  /** DTSTAMP clock; defaults to the real clock. Injected for deterministic tests. */
  readonly now?: () => Date;
}

const EVENT_REF_PATTERN = /^[A-Za-z0-9._:@-]+$/u;

export class RadicaleCalendarAdapter {
  readonly providerId = 'radicale';
  constructor(private readonly options: RadicaleCalendarAdapterOptions) {}

  listEvents(domain: CalendarDomainDto): Promise<CalendarEventDto[]> {
    return this.options.client.fetchCollection(this.collectionFor(domain));
  }

  /**
   * Create one calendar object resource via CalDAV `PUT` (RFC 4791 §5.3.2).
   *
   * The write is create-only (`If-None-Match: *`), so a ref collision fails
   * closed with the server's 412 instead of silently overwriting somebody
   * else's event. The returned DTO is produced by running the serialised
   * body through the same parser `listEvents` uses, so a written event reads
   * back identically (details view: `ical.ts` normalises RFC 5545 values to
   * ISO 8601 for the DTO contract).
   *
   * Present because the Core port declares `createEvent?`; without it
   * `PlanningService.canProjectCalendarEvents` stays false and
   * `POST /api/planning/tasks/:id/calendar-event` answers 503.
   */
  async createEvent(domain: CalendarDomainDto, input: CreateCalendarEventInput): Promise<CalendarEventDto> {
    const uid = eventRef(this.options.newEventRef, domain);
    const ics = serializeICalEvent({
      uid,
      summary: input.summary,
      start: input.start,
      end: input.end,
      location: input.location ?? null,
      ...(this.options.now === undefined ? {} : { now: this.options.now }),
    });
    const [parsed] = parseICalEvents(ics);
    if (!parsed) throw new Error('serialised calendar event did not round-trip through the iCal parser');
    await this.options.client.putEvent(this.eventPath(domain, uid), ics, { createOnly: true });
    return parsed;
  }

  private collectionFor(domain: CalendarDomainDto): string {
    return domain === 'work' ? this.options.collections.work : this.options.collections.life;
  }

  private eventPath(domain: CalendarDomainDto, uid: string): string {
    const collection = this.collectionFor(domain).replace(/\/+$/u, '');
    if (!collection.startsWith('/')) {
      throw new TypeError(`radicale collection for ${domain} must be an absolute path: ${collection}`);
    }
    return `${collection}/${uid}.ics`;
  }
}

function eventRef(factory: ((domain: CalendarDomainDto) => string) | undefined, domain: CalendarDomainDto): string {
  const raw = (factory?.(domain) ?? `${randomUUID()}@agora`).trim();
  if (!EVENT_REF_PATTERN.test(raw)) {
    throw new TypeError(`event ref must match ${String(EVENT_REF_PATTERN)}: ${raw}`);
  }
  return raw;
}
