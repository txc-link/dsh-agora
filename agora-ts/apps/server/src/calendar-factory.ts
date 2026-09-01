import { CalendarService, type CalendarProviderPort } from '@agora-ts/core';
import { GoogleCalendarAdapter, RadicaleCalendarAdapter, RadicaleClient } from '@agora-ts/adapters-calendar';

export type CalendarEnvConfig = RadicaleCalendarEnvConfig | GoogleCalendarEnvConfig;

export interface RadicaleCalendarEnvConfig {
  provider: 'radicale';
  radicaleUrl: string;
  radicaleUsername: string;
  radicalePassword: string;
  radicaleWorkCollection?: string;
  radicaleLifeCollection?: string;
  timezoneOffsetMinutes?: number;
}

export interface GoogleCalendarEnvConfig {
  provider: 'google';
  googleAccessToken: string;
  googleWorkCalendarId: string;
  googleLifeCalendarId: string;
  googleApiBaseUrl?: string;
  timezoneOffsetMinutes?: number;
}

export function createCalendarProviderFromEnv(env: CalendarEnvConfig): CalendarProviderPort {
  if (env.provider === 'google') {
    return new GoogleCalendarAdapter({
      accessToken: env.googleAccessToken,
      calendarIds: { work: env.googleWorkCalendarId, life: env.googleLifeCalendarId },
      ...(env.googleApiBaseUrl === undefined ? {} : { baseUrl: env.googleApiBaseUrl }),
    });
  }
  const client = new RadicaleClient({
    baseUrl: env.radicaleUrl,
    username: env.radicaleUsername,
    password: env.radicalePassword,
  });
  return new RadicaleCalendarAdapter({
    client,
    collections: {
      work: env.radicaleWorkCollection ?? `/${env.radicaleUsername}/work/`,
      life: env.radicaleLifeCollection ?? `/${env.radicaleUsername}/life/`,
    },
  });
}

export function createCalendarServiceFromEnv(env: CalendarEnvConfig): CalendarService {
  return new CalendarService({
    provider: createCalendarProviderFromEnv(env),
    ...(env.timezoneOffsetMinutes === undefined ? {} : { timezoneOffsetMinutes: env.timezoneOffsetMinutes }),
  });
}

export function readCalendarEnv(env: NodeJS.ProcessEnv = process.env): CalendarEnvConfig | null {
  const explicit = env.CALENDAR_PROVIDER?.trim().toLowerCase();
  const googleHint = explicit === 'google' || env.GOOGLE_CALENDAR_ACCESS_TOKEN !== undefined;
  const radicaleHint = explicit === 'radicale' || env.RADICALE_URL !== undefined || env.RADICALE_USER !== undefined || env.RADICALE_PASSWORD !== undefined;
  if (explicit && explicit !== 'google' && explicit !== 'radicale') {
    throw new Error(`CALENDAR_PROVIDER must be google or radicale, got ${explicit}`);
  }
  if (googleHint) {
    return {
      provider: 'google',
      googleAccessToken: requireEnv(env.GOOGLE_CALENDAR_ACCESS_TOKEN, 'GOOGLE_CALENDAR_ACCESS_TOKEN'),
      googleWorkCalendarId: requireEnv(env.GOOGLE_CALENDAR_WORK_ID, 'GOOGLE_CALENDAR_WORK_ID'),
      googleLifeCalendarId: requireEnv(env.GOOGLE_CALENDAR_LIFE_ID, 'GOOGLE_CALENDAR_LIFE_ID'),
      ...(env.GOOGLE_CALENDAR_API_BASE_URL === undefined ? {} : { googleApiBaseUrl: env.GOOGLE_CALENDAR_API_BASE_URL }),
      ...optionalOffset(env.CALENDAR_TIMEZONE_OFFSET_MINUTES ?? env.RADICALE_TIMEZONE_OFFSET_MINUTES),
    };
  }
  if (radicaleHint) {
    return {
      provider: 'radicale',
      radicaleUrl: requireEnv(env.RADICALE_URL, 'RADICALE_URL'),
      radicaleUsername: requireEnv(env.RADICALE_USER, 'RADICALE_USER'),
      radicalePassword: requireEnv(env.RADICALE_PASSWORD, 'RADICALE_PASSWORD'),
      ...(env.RADICALE_WORK_COLLECTION === undefined ? {} : { radicaleWorkCollection: env.RADICALE_WORK_COLLECTION }),
      ...(env.RADICALE_LIFE_COLLECTION === undefined ? {} : { radicaleLifeCollection: env.RADICALE_LIFE_COLLECTION }),
      ...optionalOffset(env.CALENDAR_TIMEZONE_OFFSET_MINUTES ?? env.RADICALE_TIMEZONE_OFFSET_MINUTES),
    };
  }
  return null;
}

function requireEnv(value: string | undefined, name: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${name} is required for the selected calendar provider`);
  return normalized;
}

function optionalOffset(value: string | undefined): { timezoneOffsetMinutes?: number } {
  if (value === undefined) return {};
  const offset = Number(value);
  if (!Number.isFinite(offset) || !Number.isInteger(offset) || Math.abs(offset) > 14 * 60) {
    throw new Error('CALENDAR_TIMEZONE_OFFSET_MINUTES must be an integer between -840 and 840');
  }
  return { timezoneOffsetMinutes: offset };
}
