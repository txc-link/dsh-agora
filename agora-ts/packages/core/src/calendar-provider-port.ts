import type { CalendarDomainDto, CalendarEventDto } from '@agora-ts/contracts';

export interface CreateCalendarEventInput {
  readonly summary: string;
  readonly start: string;
  readonly end: string;
  readonly location?: string | null;
}

export interface CalendarProviderPort {
  readonly providerId: string;
  listEvents(domain: CalendarDomainDto): Promise<CalendarEventDto[]>;
  createEvent?(domain: CalendarDomainDto, input: CreateCalendarEventInput): Promise<CalendarEventDto>;
}
