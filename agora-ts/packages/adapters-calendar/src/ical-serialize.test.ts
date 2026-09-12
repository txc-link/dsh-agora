import { describe, expect, it } from 'vitest';
import { parseICalEvents } from './ical.js';
import { serializeICalEvent } from './ical-serialize.js';

const NOW = () => new Date('2026-09-12T04:00:00Z');

function octetLengths(ics: string): number[] {
  return ics.split('\r\n').map(line => new TextEncoder().encode(line).length);
}

describe('serializeICalEvent', () => {
  it('round-trips a UTC instant through the parser', () => {
    const ics = serializeICalEvent({
      uid: 'event-1@agora', summary: 'Design review',
      start: '2026-09-01T09:00:00Z', end: '2026-09-01T10:00:00Z',
      location: 'Conf room A', now: NOW,
    });

    expect(ics).toContain('BEGIN:VCALENDAR\r\n');
    expect(ics).toContain('UID:event-1@agora\r\n');
    expect(ics).toContain('DTSTAMP:20260912T040000Z\r\n');
    expect(ics).toContain('DTSTART:20260901T090000Z\r\n');
    expect(ics).toContain('DTEND:20260901T100000Z\r\n');
    expect(ics).toContain('LOCATION:Conf room A\r\n');
    expect(parseICalEvents(ics)).toEqual([
      { uid: 'event-1@agora', summary: 'Design review', start: '2026-09-01T09:00:00Z', end: '2026-09-01T10:00:00Z', location: 'Conf room A' },
    ]);
  });

  it('converts offset instants to UTC and all-day values to VALUE=DATE', () => {
    const timed = serializeICalEvent({
      uid: 'zoned', summary: 'Call', start: '2026-09-01T17:00:00+08:00', end: '2026-09-01T18:00:00+08:00', now: NOW,
    });
    expect(timed).toContain('DTSTART:20260901T090000Z\r\n');
    expect(parseICalEvents(timed)[0]).toMatchObject({ start: '2026-09-01T09:00:00Z', end: '2026-09-01T10:00:00Z' });

    const allDay = serializeICalEvent({ uid: 'holiday', summary: '休息', start: '2026-09-02', end: '2026-09-03', now: NOW });
    expect(allDay).toContain('DTSTART;VALUE=DATE:20260902\r\n');
    expect(allDay).toContain('DTEND;VALUE=DATE:20260903\r\n');
    expect(parseICalEvents(allDay)[0]).toMatchObject({ start: '2026-09-02', end: '2026-09-03', location: null });
  });

  it('escapes TEXT values so separators survive the round trip', () => {
    const summary = 'Plan; review, then \\ done';
    const location = 'Room 1, floor 2; east';
    const ics = serializeICalEvent({
      uid: 'escaped', summary, start: '2026-09-01T09:00:00Z', end: '2026-09-01T10:00:00Z', location, now: NOW,
    });

    expect(ics).toContain('SUMMARY:Plan\\; review\\, then \\\\ done\r\n');
    expect(ics).toContain('LOCATION:Room 1\\, floor 2\\; east\r\n');
    expect(parseICalEvents(ics)[0]).toMatchObject({ summary, location });
  });

  it('keeps every folded line within 75 octets without splitting multi-byte characters', () => {
    const summary = '会议安排'.repeat(40);
    const ics = serializeICalEvent({
      uid: 'folded', summary, start: '2026-09-01T09:00:00Z', end: '2026-09-01T10:00:00Z', now: NOW,
    });

    const lengths = octetLengths(ics);
    expect(Math.max(...lengths)).toBeLessThanOrEqual(75);
    const continuation = ics.split('\r\n').filter(line => line.startsWith(' '));
    expect(continuation.length).toBeGreaterThan(0);
    // Unfolding must restore the original text exactly (no U+FFFD from split code points).
    expect(ics).not.toContain('\uFFFD');
    expect(parseICalEvents(ics)[0]?.summary).toBe(summary);
  });

  it('emits a floating wall-clock time without inventing a zone', () => {
    const ics = serializeICalEvent({
      uid: 'floating', summary: 'Standup', start: '2026-09-01T09:00:00', end: '2026-09-01T09:30:00', now: NOW,
    });

    expect(ics).toContain('DTSTART:20260901T090000\r\n');
    expect(parseICalEvents(ics)[0]).toMatchObject({ start: '2026-09-01T09:00:00', end: '2026-09-01T09:30:00' });
  });

  it('fails closed on unordered, mixed-form, and unparsable values', () => {
    const base = { uid: 'x', summary: 'y', now: NOW };
    expect(() => serializeICalEvent({ ...base, start: '2026-09-01T10:00:00Z', end: '2026-09-01T09:00:00Z' }))
      .toThrow(/end must be after start/u);
    expect(() => serializeICalEvent({ ...base, start: '2026-09-01T09:00:00Z', end: '2026-09-01T09:00:00Z' }))
      .toThrow(/end must be after start/u);
    expect(() => serializeICalEvent({ ...base, start: '2026-09-01', end: '2026-09-01T09:00:00Z' }))
      .toThrow(/same DATE or DATE-TIME form/u);
    expect(() => serializeICalEvent({ ...base, start: '2026-09-01T09:00:00Z', end: '2026-09-01T10:00:00' }))
      .toThrow(/same DATE or DATE-TIME form/u);
    expect(() => serializeICalEvent({ ...base, start: 'tomorrow', end: '2026-09-02T10:00:00Z' }))
      .toThrow(/ISO 8601/u);
    expect(serializeICalEvent({ ...base, start: '2026-09-01T09:00:00.250', end: '2026-09-01T10:00:00.250' }))
      .toContain('DTSTART:20260901T090000\r\n');
    expect(() => serializeICalEvent({ uid: 'x', summary: '   ', start: '2026-09-01T09:00:00Z', end: '2026-09-01T10:00:00Z' }))
      .toThrow(/summary is required/u);
    expect(() => serializeICalEvent({ ...base, start: '2026-02-31', end: '2026-03-01' }))
      .toThrow(/not a real calendar date/u);
    expect(() => serializeICalEvent({ uid: 'a\nb', summary: 'y', start: '2026-09-01T09:00:00Z', end: '2026-09-01T10:00:00Z' }))
      .toThrow(/uid must not contain control characters/u);
  });

  it('omits LOCATION when it is blank and keeps the VCALENDAR envelope', () => {
    const ics = serializeICalEvent({
      uid: 'no-location', summary: 'Focus', start: '2026-09-01T09:00:00Z', end: '2026-09-01T10:00:00Z', location: '   ', now: NOW,
    });

    expect(ics).not.toContain('LOCATION:');
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('PRODID:-//agora-ts//adapters-calendar//EN\r\n');
  });
});
