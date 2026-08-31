/**
 * Minimal iCalendar (RFC 5545) parser for VEVENT blocks.
 *
 * Scope: extract UID, SUMMARY, DTSTART, DTEND, LOCATION. Anything richer
 * (RRULE, recurrence, timezones beyond UTC Z suffix or floating) is out
 * of scope for the v0.1 commitment calendar — the contract explicitly
 * treats CalDAV as a projection, not a full calendar implementation.
 */
import type { CalendarEventDto } from '@agora-ts/contracts';

const FOLD_LINE_ENDING = /\r?\n[ \t]/gu;
const LINEBREAK = /\r?\n/gu;

interface RawLine {
  readonly key: string;
  readonly params: Map<string, string>;
  readonly value: string;
}

function unfold(text: string): string[] {
  const unfolded = text.replace(FOLD_LINE_ENDING, '');
  return unfolded.split(LINEBREAK).filter((line) => line.length > 0);
}

function parseLine(raw: string): RawLine | null {
  const colonAt = raw.indexOf(':');
  if (colonAt < 0) return null;
  const head = raw.slice(0, colonAt);
  const value = raw.slice(colonAt + 1);
  const segments = head.split(';');
  const key = segments[0];
  if (!key) return null;
  const params = new Map<string, string>();
  for (const segment of segments.slice(1)) {
    const eq = segment.indexOf('=');
    if (eq < 0) continue;
    params.set(segment.slice(0, eq).toUpperCase(), segment.slice(eq + 1));
  }
  return { key: key.toUpperCase(), params, value };
}

function parseDateTime(value: string, params: Map<string, string>): string {
  // Floating (no TZID, no Z) → treat as UTC at face value; emit as-is so the
  // caller can interpret in the deployment timezone. Production deployments
  // should prefer UTC ("Z") events.
  void params;
  return value;
}

function unescapeText(value: string): string {
  return value
    .replace(/\\n/gu, '\n')
    .replace(/\\,/gu, ',')
    .replace(/\\;/gu, ';')
    .replace(/\\\\/gu, '\\');
}

export function parseICalEvents(ics: string): CalendarEventDto[] {
  const events: CalendarEventDto[] = [];
  const unfolded = unfold(ics);
  let inEvent = false;
  let buffer: RawLine[] = [];
  for (const raw of unfolded) {
    const line = parseLine(raw);
    if (!line) continue;
    if (line.key === 'BEGIN' && line.value.toUpperCase() === 'VEVENT') {
      inEvent = true;
      buffer = [];
      continue;
    }
    if (line.key === 'END' && line.value.toUpperCase() === 'VEVENT' && inEvent) {
      const event = eventFromLines(buffer);
      if (event) events.push(event);
      inEvent = false;
      buffer = [];
      continue;
    }
    if (inEvent) buffer.push(line);
  }
  return events;
}

function eventFromLines(lines: RawLine[]): CalendarEventDto | null {
  let uid: string | null = null;
  let summary: string | null = null;
  let start: string | null = null;
  let end: string | null = null;
  let location: string | null = null;
  for (const line of lines) {
    switch (line.key) {
      case 'UID':
        uid = line.value;
        break;
      case 'SUMMARY':
        summary = unescapeText(line.value);
        break;
      case 'DTSTART':
        start = parseDateTime(line.value, line.params);
        break;
      case 'DTEND':
        end = parseDateTime(line.value, line.params);
        break;
      case 'LOCATION':
        location = unescapeText(line.value);
        break;
      default:
        break;
    }
  }
  if (!uid || !summary || !start || !end) return null;
  return { uid, summary, start, end, location };
}