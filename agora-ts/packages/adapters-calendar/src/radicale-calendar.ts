import type { CalendarDomainDto, CalendarEventDto } from '@agora-ts/contracts';
import type { RadicaleClient } from './radicale-client.js';

export interface RadicaleCalendarAdapterOptions {
  readonly client: RadicaleClient;
  readonly collections: { readonly work: string; readonly life: string };
}

export class RadicaleCalendarAdapter {
  readonly providerId = 'radicale';
  constructor(private readonly options: RadicaleCalendarAdapterOptions) {}

  listEvents(domain: CalendarDomainDto): Promise<CalendarEventDto[]> {
    return this.options.client.fetchCollection(domain === 'work' ? this.options.collections.work : this.options.collections.life);
  }
}
