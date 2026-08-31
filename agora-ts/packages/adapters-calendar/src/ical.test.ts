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

describe('parseICalEvents', () => {
  it('extracts VEVENT blocks with required fields', () => {
    const events = parseICalEvents(SAMPLE);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      uid: 'event-1@work',
      summary: 'Design review',
      start: '20260831T090000Z',
      end: '20260831T100000Z',
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
});