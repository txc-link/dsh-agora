import type { CalendarConflictDto, CalendarEventDto } from '@agora-ts/contracts';

export function computeCalendarConflicts(events: CalendarEventDto[]): CalendarConflictDto[] {
  const conflicts: CalendarConflictDto[] = [];
  for (let left = 0; left < events.length; left += 1) {
    for (let right = left + 1; right < events.length; right += 1) {
      const a = events[left]!;
      const b = events[right]!;
      const aStart = Date.parse(a.start);
      const aEnd = Date.parse(a.end);
      const bStart = Date.parse(b.start);
      const bEnd = Date.parse(b.end);
      if ([aStart, aEnd, bStart, bEnd].some(value => !Number.isFinite(value))) {
        throw new TypeError('calendar event boundaries must be valid ISO 8601 values');
      }
      if (aStart < bEnd && bStart < aEnd) {
        conflicts.push({
          uid_a: a.uid, uid_b: b.uid, summary_a: a.summary, summary_b: b.summary,
          start: aStart < bStart ? b.start : a.start,
          end: aEnd < bEnd ? a.end : b.end,
        });
      }
    }
  }
  return conflicts;
}

function formatEventLine(event: CalendarEventDto): string {
  return `- ${event.start} → ${event.end} — **${event.summary}**${event.location ? ` @ ${event.location}` : ''}`;
}

function conflictsBlock(conflicts: CalendarConflictDto[]): string {
  return conflicts.length === 0 ? '_no conflicts_' : conflicts.map(
    conflict => `- ⚠ **${conflict.summary_a}** ↔ **${conflict.summary_b}** (overlap ${conflict.start} → ${conflict.end})`,
  ).join('\n');
}

export function generateCalendarMorningReport(input: {
  domain: string; date: string; events: CalendarEventDto[]; conflicts: CalendarConflictDto[];
}): string {
  const events = input.events.length === 0 ? '_no events today_' : input.events.map(formatEventLine).join('\n');
  return `# ${input.domain.toUpperCase()} · morning briefing · ${input.date}\n\n${input.events.length} events · ${input.conflicts.length} conflict(s)\n\n## Schedule\n${events}\n\n## Conflicts\n${conflictsBlock(input.conflicts)}`;
}

export function generateCalendarEveningReport(input: {
  domain: string; date: string; today: CalendarEventDto[]; tomorrow: CalendarEventDto[]; pendingConflicts: CalendarConflictDto[];
}): string {
  const today = input.today.length === 0 ? '_no events completed today_' : input.today.map(formatEventLine).join('\n');
  const tomorrow = input.tomorrow.length === 0 ? '_tomorrow is open_' : input.tomorrow.map(formatEventLine).join('\n');
  return [
    `# ${input.domain.toUpperCase()} · evening check-out · ${input.date}`,
    '', `## Today (${input.today.length})\n${today}`, '',
    `## Tomorrow preview (${input.tomorrow.length})\n${tomorrow}`, '',
    `## Open conflicts (${input.pendingConflicts.length})\n${conflictsBlock(input.pendingConflicts)}`,
  ].join('\n');
}
