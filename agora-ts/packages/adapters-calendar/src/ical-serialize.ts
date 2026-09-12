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
 *     multi-byte character). Control characters (C0 and DEL) are refused in
 *     UID/SUMMARY/LOCATION rather than written into the resource.
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
  const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (isoDate) {
    const compact = `${isoDate[1]}${isoDate[2]}${isoDate[3]}`;
    return dateValue(isoDate, compact, ';VALUE=DATE', value, label);
  }
  const compactDate = /^(\d{4})(\d{2})(\d{2})$/u.exec(value);
  if (compactDate) {
    const iso = `${compactDate[1]}-${compactDate[2]}-${compactDate[3]}`;
    return dateValue(compactDate, value, ';VALUE=DATE', iso, label);
  }
  if (/^\d{8}T\d{6}Z?$/u.test(value)) {
    const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/u.exec(value);
    /* istanbul ignore if -- guarded by the shape test above */
    if (!match) throw new TypeError(`${label} must be a compact RFC 5545 date-time: ${value}`);
    return zonedOrFloating(match, value, label);
  }
  if (/^\d{4}-\d{2}-\d{2}T/u.test(value)) {
    const iso = parseIsoDateTime(value, label);
    return iso.kind === 'zoned'
      ? { params: '', value: compactZoned(iso.epochMs), key: zonedKey(iso.epochMs), kind: 'zoned' }
      : { params: '', value: `${iso.compactYear}${iso.compactMonth}${iso.compactDay}T${iso.compactTime}`, key: iso.key, kind: 'floating' };
  }
  throw new TypeError(`${label} must be an ISO 8601 date or date-time: ${value}`);
}

/** Convert a ${year,month,day} match into a DATE value with a normalised key. */
function dateValue(match: RegExpExecArray, compactValue: string, params: string, key: string, label: string): ICalValue {
  const year = match[1] ?? '';
  const month = match[2] ?? '';
  const day = match[3] ?? '';
  assertRealDate(year, month, day, label);
  return { params, value: compactValue, key, kind: 'date' };
}

/** Shared handling for the compact RFC 5545 date-time form (with or without Z). */
function zonedOrFloating(match: RegExpExecArray, value: string, label: string): ICalValue {
  const [, y, mo, d, h, mi, s, utc] = match;
  assertRealDate(y ?? '', mo ?? '', d ?? '', label);
  assertRealTime(h ?? '', mi ?? '', s ?? '', label);
  if (utc === 'Z') {
    const epochMs = epochMsFromFields(y ?? '', mo ?? '', d ?? '', h ?? '', mi ?? '', s ?? '', 0, 0);
    return { params: '', value, key: zonedKey(epochMs), kind: 'zoned' };
  }
  const wall = `${y}-${mo}-${d}T${h}:${mi}:${s}`;
  return { params: '', value, key: `floating:${wall}`, kind: 'floating' };
}

interface ParsedIsoDateTime {
  readonly kind: 'zoned' | 'floating';
  readonly key: string;
  readonly epochMs: number;
  readonly compactYear: string;
  readonly compactMonth: string;
  readonly compactDay: string;
  readonly compactTime: string;
}

/**
 * Strict ISO 8601 date-time parser. The shape is pinned by regex and every
 * field is range-checked against real calendar rules (including leap years)
 * before any arithmetic: `Date.parse` is never consulted, so impossible inputs
 * such as `2026-02-30` or `2026-13-99T99:99:99` are refused instead of being
 * silently rolled over into a different instant.
 */
function parseIsoDateTime(value: string, label: string): ParsedIsoDateTime {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(Z|[+-]\d{2}:?\d{2})?$/u.exec(value);
  if (!match) throw new TypeError(`${label} must be an ISO 8601 date or date-time: ${value}`);
  const [, y, mo, d, h, mi, sRaw, fraction, zone] = match;
  const second = sRaw ?? '00';
  const millis = fraction === undefined ? 0 : Number(`0.${fraction}`) * 1000;
  assertRealDate(y ?? '', mo ?? '', d ?? '', label);
  assertRealTime(h ?? '', mi ?? '', second, label);
  const zoned = zone !== undefined;
  const offsetMinutes = zoned ? offsetMinutesOf(zone === 'Z' ? '+00:00' : zone, label) : 0;
  const epochMs = epochMsFromFields(y ?? '', mo ?? '', d ?? '', h ?? '', mi ?? '', second, millis, offsetMinutes);
  if (zoned) {
    return { kind: 'zoned', key: zonedKey(epochMs), epochMs, compactYear: y ?? '', compactMonth: mo ?? '', compactDay: d ?? '', compactTime: `${h}${mi}${second}` };
  }
  const fractionKey = millis === 0 ? '' : `.${String(millis).padStart(3, '0')}`;
  const wall = `${y}-${mo}-${d}T${h}:${mi}:${second}${fractionKey}`;
  return { kind: 'floating', key: `floating:${wall}`, epochMs, compactYear: y ?? '', compactMonth: mo ?? '', compactDay: d ?? '', compactTime: `${h}${mi}${second}` };
}

/** Parse a `Z`/`±HH:MM`/`±HHMM` offset, refusing out-of-range hours or minutes. */
function offsetMinutesOf(zone: string, label: string): number {
  const match = /^([+-])(\d{2}):?(\d{2})$/u.exec(zone);
  if (!match) throw new TypeError(`${label} has an invalid UTC offset: ${zone}`);
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  if (hours > 23 || minutes > 59) throw new TypeError(`${label} has an out-of-range UTC offset: ${zone}`);
  const magnitude = hours * 60 + minutes;
  return match[1] === '-' ? -magnitude : magnitude;
}

function compactZoned(epochMs: number): string {
  const date = new Date(epochMs);
  return `${String(date.getUTCFullYear()).padStart(4, '0')}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

/** Zero-padded epoch key so lexicographic and chronological order coincide. */
function zonedKey(epochMs: number): string {
  return `zoned:${String(Math.round(epochMs)).padStart(17, '0')}`;
}

/** Days since 1970-01-01 (proleptic Gregorian), cycle-safe for all 4-digit years. */
function daysFromCivil(year: number, month: number, day: number): number {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

function epochMsFromFields(
  year: string, month: string, day: string,
  hour: string, minute: string, second: string,
  millisecond: number, offsetMinutes: number,
): number {
  return ((daysFromCivil(Number(year), Number(month), Number(day)) * 86400
    + Number(hour) * 3600 + Number(minute) * 60 + Number(second)) * 1000 + millisecond)
    - offsetMinutes * 60000;
}

function assertRealDate(year: string, month: string, day: string, label: string): void {
  const numericYear = Number(year);
  const numericMonth = Number(month);
  const numericDay = Number(day);
  const daysInMonth = [31, ((numericYear % 4 === 0 && numericYear % 100 !== 0) || numericYear % 400 === 0) ? 29 : 28,
    31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (numericMonth < 1 || numericMonth > 12 || numericDay < 1 || numericDay > (daysInMonth[numericMonth - 1] ?? 0)) {
    throw new TypeError(`${label} is not a real calendar date: ${year}-${month}-${day}`);
  }
}

/**
 * Wall-clock field ranges. Leap seconds (`:60`) are refused rather than
 * accepted and silently rolled into the next minute: this path must fail
 * closed on a value the rest of the stack cannot represent faithfully.
 */
function assertRealTime(hour: string, minute: string, second: string, label: string): void {
  const numeric = Number(hour);
  const minuteValue = Number(minute);
  const secondValue = Number(second);
  if (numeric < 0 || numeric > 23 || minuteValue < 0 || minuteValue > 59 || secondValue < 0 || secondValue > 59) {
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
  if (hasControlCharacter(summary)) throw new TypeError('summary must not contain control characters');
  const start = toICalValue(input.start, 'start');
  const end = toICalValue(input.end, 'end');
  assertOrdered(start, end);
  const stamp = (input.now?.() ?? new Date()).toISOString().replace(/[-:]/gu, '').replace(/\.\d{3}/u, '');
  const location = input.location?.trim();
  if (location && hasControlCharacter(location)) throw new TypeError('location must not contain control characters');
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
