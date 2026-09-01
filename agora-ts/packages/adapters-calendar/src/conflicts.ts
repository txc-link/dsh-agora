/**
 * Conflict detection for a list of calendar events.
 *
 * Two events conflict iff their [start, end) intervals overlap in wall-clock
 * time. Boundaries are parsed to instants so events with different UTC
 * offsets compare correctly.
 */
import type { CalendarConflictDto, CalendarEventDto } from '@agora-ts/contracts';

export function computeConflicts(events: CalendarEventDto[]): CalendarConflictDto[] {
  const conflicts: CalendarConflictDto[] = [];
  for (let i = 0; i < events.length; i += 1) {
    for (let j = i + 1; j < events.length; j += 1) {
      const a = events[i]!;
      const b = events[j]!;
      const aStart = Date.parse(a.start);
      const aEnd = Date.parse(a.end);
      const bStart = Date.parse(b.start);
      const bEnd = Date.parse(b.end);
      if ([aStart, aEnd, bStart, bEnd].some(value => !Number.isFinite(value))) {
        throw new TypeError('calendar event boundaries must be valid ISO 8601 values');
      }
      // overlap iff a.start < b.end && b.start < a.end
      if (aStart < bEnd && bStart < aEnd) {
        conflicts.push({
          uid_a: a.uid,
          uid_b: b.uid,
          summary_a: a.summary,
          summary_b: b.summary,
          start: aStart < bStart ? b.start : a.start,
          end: aEnd < bEnd ? a.end : b.end,
        });
      }
    }
  }
  return conflicts;
}
