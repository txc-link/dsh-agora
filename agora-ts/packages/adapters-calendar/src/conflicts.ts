/**
 * Conflict detection for a list of calendar events.
 *
 * Two events conflict iff their [start, end) intervals overlap in wall-clock
 * time. We compare as ISO 8601 strings — `String#localeCompare` is safe for
 * the subset of ISO 8601 we emit (YYYY-MM-DDTHH:MM:SS[Z|+HH:MM]) because the
 * format is lexicographically ordered.
 */
import type { CalendarConflictDto, CalendarEventDto } from '@agora-ts/contracts';

function lt(a: string, b: string): boolean {
  return a < b;
}

export function computeConflicts(events: CalendarEventDto[]): CalendarConflictDto[] {
  const conflicts: CalendarConflictDto[] = [];
  for (let i = 0; i < events.length; i += 1) {
    for (let j = i + 1; j < events.length; j += 1) {
      const a = events[i]!;
      const b = events[j]!;
      // overlap iff a.start < b.end && b.start < a.end
      if (lt(a.start, b.end) && lt(b.start, a.end)) {
        conflicts.push({
          uid_a: a.uid,
          uid_b: b.uid,
          summary_a: a.summary,
          summary_b: b.summary,
          start: lt(a.start, b.start) ? b.start : a.start,
          end: lt(a.end, b.end) ? a.end : b.end,
        });
      }
    }
  }
  return conflicts;
}