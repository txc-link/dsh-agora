import { describe, expect, it } from 'vitest';
import { readCalendarEnv } from './calendar-factory.js';

describe('calendar factory', () => {
  it('selects Google with explicit separate domain calendars', () => {
    expect(readCalendarEnv({
      CALENDAR_PROVIDER: 'google', GOOGLE_CALENDAR_ACCESS_TOKEN: 'token',
      GOOGLE_CALENDAR_WORK_ID: 'work', GOOGLE_CALENDAR_LIFE_ID: 'life',
      CALENDAR_TIMEZONE_OFFSET_MINUTES: '480',
    })).toEqual({
      provider: 'google', googleAccessToken: 'token', googleWorkCalendarId: 'work', googleLifeCalendarId: 'life', timezoneOffsetMinutes: 480,
    });
  });

  it('rejects partial provider configuration instead of silently disabling it', () => {
    expect(() => readCalendarEnv({ CALENDAR_PROVIDER: 'google', GOOGLE_CALENDAR_ACCESS_TOKEN: 'token' }))
      .toThrow('GOOGLE_CALENDAR_WORK_ID');
  });
});
