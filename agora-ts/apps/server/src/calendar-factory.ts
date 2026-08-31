/**
 * Factory helper that wires the Radicale-backed CalendarService from env.
 *
 * Composition intentionally does NOT auto-create the calendar service today
 * (the factory is exported here so deployments can opt in). The REST
 * surface returns 503 with a clear "set RADICALE_URL ..." message when the
 * service is absent, so the gap is explicit per §1.5.
 */
import { CalendarService } from '@agora-ts/core';
import { RadicaleClient } from '@agora-ts/adapters-calendar';

export interface CalendarEnvConfig {
  /** Base URL of the Radicale instance (e.g. http://127.0.0.1:5232). */
  radicaleUrl: string;
  radicaleUsername: string;
  radicalePassword: string;
  /** Path to the work calendar collection (e.g. /alice/work/). */
  radicaleWorkCollection?: string;
  /** Path to the life calendar collection (e.g. /alice/life/). */
  radicaleLifeCollection?: string;
  /** Timezone offset in minutes for "today" boundaries (default 0 = UTC). */
  radicaleTimezoneOffsetMinutes?: number;
}

export function createCalendarServiceFromEnv(env: CalendarEnvConfig): CalendarService {
  const client = new RadicaleClient({
    baseUrl: env.radicaleUrl,
    username: env.radicaleUsername,
    password: env.radicalePassword,
  });
  return new CalendarService({
    client,
    collections: {
      work: env.radicaleWorkCollection ?? `/${env.radicaleUsername}/work/`,
      life: env.radicaleLifeCollection ?? `/${env.radicaleUsername}/life/`,
    },
    ...(env.radicaleTimezoneOffsetMinutes !== undefined
      ? { timezoneOffsetMinutes: env.radicaleTimezoneOffsetMinutes }
      : {}),
  });
}

export function readCalendarEnv(env: NodeJS.ProcessEnv = process.env): CalendarEnvConfig | null {
  const url = env.RADICALE_URL;
  const user = env.RADICALE_USER;
  const password = env.RADICALE_PASSWORD;
  if (!url || !user || !password) return null;
  return {
    radicaleUrl: url,
    radicaleUsername: user,
    radicalePassword: password,
    ...(env.RADICALE_WORK_COLLECTION !== undefined ? { radicaleWorkCollection: env.RADICALE_WORK_COLLECTION } : {}),
    ...(env.RADICALE_LIFE_COLLECTION !== undefined ? { radicaleLifeCollection: env.RADICALE_LIFE_COLLECTION } : {}),
    ...(env.RADICALE_TIMEZONE_OFFSET_MINUTES !== undefined
      ? { radicaleTimezoneOffsetMinutes: Number(env.RADICALE_TIMEZONE_OFFSET_MINUTES) }
      : {}),
  };
}