/**
 * Minimal iCalendar (RFC 5545) serializer for VEVENT blocks.
 *
 * Scope mirrors the parser in `ical.ts`: UID, SUMMARY, DTSTART, DTEND,
 * LOCATION. Everything richer (RRULE, VALARM, ATTENDEE, VTIMEZONE) is out
 * of scope — the contract treats CalDAV as a projection, not a full
 * calendar implementation.
 *
 * Two responsibilities that the parser cannot take over:
 *
 *  1. **Value form**: the DTO contract declares `start`/`end` as ISO 8601
 *     (`calendarEventSchema`), while RFC 5545 requires compact values
 *     (`20260901T090000Z` / `VALUE=DATE:20260901`). This module converts
 *     ISO → RFC 5545, which is the exact inverse of `parseDateTime` in
 *     `ical.ts`, so a written event reads back unchanged.
 *  2. **Transport hygiene**: TEXT escaping and 75-octet line folding with
 *     CRLF endings, folding on UTF-8 code point boundaries (never inside a
 *     multi-byte character).
 */

export interface SerializeICalEventInput {
  readonly uid: string;
  readonly summary: string;
  readonly start: string;
  readonly end: string;
  readonly location?: string | null;
  /** DTSTAMP clock; defaults to the real clock. Injected for deterministic tests. */
  readonly now?: () => Date;
  /** PRODID emitted in the VCALENDAR header; defaults to the agora-ts product id. */
  readonly prodId?: string;
}

export const DEFAULT_PROD_ID = '-//agora-ts//adapters-calendar//EN';

/** RFC 5545 §3.1: content lines SHOULD NOT be longer than 75 octets. */
const MAX_LINE_OCTETS = 75;
const encoder = new TextEncoder();

interface ICalValue {
  /** Property parameters, e.g. `;VALUE=DATE` (may be empty). */
  readonly params: string;
  /** RFC 5545 value, e.g. `20260901T090000Z` or `20260901`. */
  readonly value: string;
  /** Comparable key used only for start/end ordering checks. */
  readonly key: string;
  readonly kind: 'date' | 'zoned' | 'floating';
}

/**
 * Convert an ISO 8601 date/date-time (the DTO contract's form) into the
 * RFC 5545 property value that `parseICalEvents` normalises back.
 *
 *   DATE        2026-09-01            -> DTSTART;VALUE=DATE:20260901
 *   UTC inst.   2026-09-01T09:00:00Z  -> DTSTART:20260901T090000Z
 *   offset inst.2026-09-01T17:00:00+08:00 -> DTSTART:20260901T090000Z
 *   floating    2026-09-01T09:00:00   -> DTSTART:20260901T090000
 *
 * Already-compact RFC 5545 values are accepted unchanged so callers that
 * speak iCalendar natively are not forced through ISO. Anything else is
 * rejected: a write path must fail closed rather than persist a value that
 * other CalDAV clients cannot read.
 */
function toICalValue(raw: string, label: string): ICalValue {
  const value = required(raw, label);
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (dateOnly) {
    assertRealDate(value, label);
    return { params: ';VALUE=DATE', value: `${dateOnly[1]}${dateOnly[2]}${dateOnly[3]}`, key: value, kind: 'date' };
  }
  const compactDate = /^(\d{4})(\d{2})(\d{2})$/u.exec(value);
  if (compactDate) {
    const iso = `${compactDate[1]}-${compactDate[2]}-${compactDate[3]}`;
    assertRealDate(iso, label);
    return { params: ';VALUE=DATE', value, key: iso, kind: 'date' };
  }
  const floating = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/u.exec(value);
  if (floating) {
    const year = floating[1] ?? '';
    const month = floating[2] ?? '';
    const day = floating[3] ?? '';
    const hour = floating[4] ?? '';
    const minute = floating[5] ?? '';
    const second = floating[6] ?? '00';
    assertRealDate(`${year}-${month}-${day}`, label);
    assertRealTime(hour, minute, second, label);
    const wall = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
    return { params: '', value: `${year}${month}${day}T${hour}${minute}${second}`, key: `floating:${wall}`, kind: 'floating' };
  }
  const compact = /^(\d{8}T\d{6})(Z?)$/u.exec(value);
  if (compact) {
    return { params: '', value, key: compact[2] === 'Z' ? `zoned:${value}` : `floating:${value}`, kind: compact[2] === 'Z' ? 'zoned' : 'floating' };
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new TypeError(`${label} must be an ISO 8601 date or date-time: ${value}`);
  if (/(?:Z|[+-]\d{2}:?\d{2})$/u.test(value)) {
    // Zone-qualified instants are stored in UTC (RFC 5545 §3.3.5).
    const utc = parsed.toISOString();
    return { params: '', value: `${utc.slice(0, 19).replace(/[-:]/gu, '')}Z`, key: `zoned:${utc}`, kind: 'zoned' };
  }
  // Floating wall-clock (e.g. fractional seconds, or any ISO form without a
  // zone): `Date` parsed it in the process's local zone, so reading the local
  // components back reproduces the same wall clock without inventing a zone.
  const year = String(parsed.getFullYear());
  const month = pad(parsed.getMonth() + 1);
  const day = pad(parsed.getDate());
  const hour = pad(parsed.getHours());
  const minute = pad(parsed.getMinutes());
  const second = pad(parsed.getSeconds());
  const wall = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
  return { params: '', value: `${year}${month}${day}T${hour}${minute}${second}`, key: `floating:${wall}`, kind: 'floating' };
}

function assertRealDate(iso: string, label: string): void {
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== iso) {
    throw new TypeError(`${label} is not a real calendar date: ${iso}`);
  }
}

function assertRealTime(hour: string, minute: string, second: string, label: string): void {
  const numeric = Number(hour);
  const minuteValue = Number(minute);
  const secondValue = Number(second);
  const leapSecond = secondValue === 60;
  if (numeric > 23 || minuteValue > 59 || (secondValue > 59 && !leapSecond)) {
    throw new TypeError(`${label} is not a real wall-clock time: ${hour}:${minute}:${second}`);
  }
}

/**
 * Serialise one event as a standalone VCALENDAR. DTSTAMP defaults to the
 * injected clock so tests stay deterministic.
 */
export function serializeICalEvent(input: SerializeICalEventInput): string {
  const uid = required(input.uid, 'uid');
  if (hasControlCharacter(uid)) throw new TypeError('uid must not contain control characters');
  const summary = required(input.summary, 'summary');
  const start = toICalValue(input.start, 'start');
  const end = toICalValue(input.end, 'end');
  assertOrdered(start, end);
  const stamp = (input.now?.() ?? new Date()).toISOString().replace(/[-:]/gu, '').replace(/\.\d{3}/u, '');
  const location = input.location?.trim();
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${input.prodId ?? DEFAULT_PROD_ID}`,
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `SUMMARY:${escapeText(summary)}`,
    `DTSTART${start.params}:${start.value}`,
    `DTEND${end.params}:${end.value}`,
    ...(location ? [`LOCATION:${escapeText(location)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

/**
 * Start/end may not be mixed forms (an all-day start with a timed end is not
 * a representable VEVENT), and the end must be strictly after the start
 * (DTEND is exclusive, so an equal value is a zero-length event).
 */
function assertOrdered(start: ICalValue, end: ICalValue): void {
  if (start.kind !== end.kind) {
    throw new TypeError('start and end must use the same DATE or DATE-TIME form and the same zone convention');
  }
  if (end.key <= start.key) {
    throw new TypeError(`end must be after start (start=${start.key}, end=${end.key})`);
  }
}

function required(value: string, label: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new TypeError(`${label} is required`);
  return normalized;
}

/** RFC 5545 §3.3.11 TEXT escaping (backslash first). */
function escapeText(value: string): string {
  return value
    .replace(/\\/gu, '\\\\')
    .replace(/\r\n|\r|\n/gu, '\\n')
    .replace(/;/gu, '\\;')
    .replace(/,/gu, '\\,');
}

/**
 * Fold a content line at 75 octets. Continuation lines start with a single
 * space, which itself counts against the budget; folding walks whole code
 * points so multi-byte characters are never split (RFC 5545 §3.1 allows
 * only UTF-8 sequences to be kept intact).
 */
function foldLine(line: string): string {
  if (encoder.encode(line).length <= MAX_LINE_OCTETS) return line;
  const parts: string[] = [];
  let current = '';
  let octets = 0;
  for (const character of line) {
    const size = encoder.encode(character).length;
    const budget = parts.length === 0 ? MAX_LINE_OCTETS : MAX_LINE_OCTETS - 1;
    if (octets + size > budget) {
      parts.push(current);
      current = '';
      octets = 0;
    }
    current += character;
    octets += size;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** True when any code point is a C0 control (includes CR/LF/NUL) or DEL. */
function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}
