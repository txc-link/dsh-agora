import { describe, expect, it } from 'vitest';
import { parseICalEvents } from './ical.js';

const SAMPLE = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//agora-ts//adapters-calendar//EN',
  'BEGIN:VEVENT',
  'UID:event-1@work',
  'SUMMARY:Design review',
  'DTSTART:20260831T090000Z',
  'DTEND:20260831T100000Z',
  'LOCATION:Conf room A',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:event-2@life',
  'SUMMARY:Morning run',
  'DTSTART:20260831T070000Z',
  'DTEND:20260831T080000Z',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:event-malformed',
  'SUMMARY:missing times',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\n');

const eventWith = (lines: string[]): string =>
  [
    'BEGIN:VCALENDAR',
    'BEGIN:VEVENT',
    'UID:dt-1',
    'SUMMARY:time normalisation probe',
    ...lines,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\n');

describe('parseICalEvents', () => {
  it('extracts VEVENT blocks with required fields', () => {
    const events = parseICalEvents(SAMPLE);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      uid: 'event-1@work',
      summary: 'Design review',
      start: '2026-08-31T09:00:00Z',
      end: '2026-08-31T10:00:00Z',
      location: 'Conf room A',
    });
    expect(events[1]?.location).toBeNull();
  });

  it('drops events missing UID, SUMMARY, DTSTART, or DTEND', () => {
    const events = parseICalEvents(SAMPLE);
    const malformed = events.find((e) => e.uid === 'event-malformed');
    expect(malformed).toBeUndefined();
  });

  it('unfolds RFC 5545 continuation lines before parsing', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'UID:folded-1',
      'SUMMARY:Long summary that wraps onto',
      ' the next line',
      'DTSTART:20260831T090000Z',
      'DTEND:20260831T100000Z',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const events = parseICalEvents(ics);
    // RFC 5545 §3.1: the CRLF + single WSP that begins a continuation line
    // is the fold delimiter and is removed on unfold; the space therefore
    // does NOT survive as content.
    expect(events[0]?.summary).toBe('Long summary that wraps ontothe next line');
  });

  it('unescapes standard RFC 5545 text escapes', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'UID:esc-1',
      'SUMMARY:Discuss \\, plan \\; ship',
      'DTSTART:20260831T090000Z',
      'DTEND:20260831T100000Z',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n');
    const events = parseICalEvents(ics);
    expect(events[0]?.summary).toBe('Discuss , plan ; ship');
  });

  it('normalises RFC 5545 DATE-TIME into ISO 8601 that Date.parse accepts', () => {
    const [event] = parseICalEvents(
      eventWith(['DTSTART:20260831T090000Z', 'DTEND:20260831T100000Z']),
    );
    expect(event?.start).toBe('2026-08-31T09:00:00Z');
    expect(event?.end).toBe('2026-08-31T10:00:00Z');
    expect(Number.isFinite(Date.parse(event!.start))).toBe(true);
  });

  it('normalises a VALUE=DATE all-day event to a bare ISO date', () => {
    const [event] = parseICalEvents(
      eventWith(['DTSTART;VALUE=DATE:20260831', 'DTEND;VALUE=DATE:20260901']),
    );
    expect(event?.start).toBe('2026-08-31');
    expect(event?.end).toBe('2026-09-01');
    // CalendarService buckets by `start.slice(0, 10)`, so the ISO date form
    // is what makes all-day events land in "today" at all.
    expect(event?.start.slice(0, 10)).toBe('2026-08-31');
  });

  it('keeps floating and TZID-qualified wall times zone-less instead of inventing UTC', () => {
    const [floating] = parseICalEvents(
      eventWith(['DTSTART:20260831T090000', 'DTEND:20260831T100000']),
    );
    expect(floating?.start).toBe('2026-08-31T09:00:00');

    const [withTzid] = parseICalEvents(
      eventWith([
        'DTSTART;TZID=Asia/Shanghai:20260831T090000',
        'DTEND;TZID=Asia/Shanghai:20260831T100000',
      ]),
    );
    expect(withTzid?.start).toBe('2026-08-31T09:00:00');
  });

  it('passes ISO 8601 values through untouched', () => {
    const [event] = parseICalEvents(
      eventWith(['DTSTART:2026-08-31T09:00:00Z', 'DTEND:2026-08-31T10:00:00Z']),
    );
    expect(event?.start).toBe('2026-08-31T09:00:00Z');
  });
});
