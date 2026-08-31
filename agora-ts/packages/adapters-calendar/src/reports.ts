/**
 * Markdown report generators for morning / evening briefings.
 *
 * Morning: list today's events + any conflicts + a single-line summary.
 * Evening: list today's events + tomorrow's preview + pending conflicts.
 * The formatters are pure — they take events + conflicts as inputs so the
 * REST + CLI + connector can all share the same shape without coupling.
 */
import type { CalendarConflictDto, CalendarEventDto } from '@agora-ts/contracts';

function formatEventLine(event: CalendarEventDto): string {
  const time = `${event.start} → ${event.end}`;
  const where = event.location ? ` @ ${event.location}` : '';
  return `- ${time} — **${event.summary}**${where}`;
}

function conflictsBlock(conflicts: CalendarConflictDto[]): string {
  if (conflicts.length === 0) return '_no conflicts_';
  const lines = conflicts.map(
    (c) => `- ⚠ **${c.summary_a}** ↔ **${c.summary_b}** (overlap ${c.start} → ${c.end})`,
  );
  return lines.join('\n');
}

export interface MorningReportInput {
  domain: string;
  date: string; // YYYY-MM-DD
  events: CalendarEventDto[];
  conflicts: CalendarConflictDto[];
}

export function generateMorningReport(input: MorningReportInput): string {
  const header = `# ${input.domain.toUpperCase()} · morning briefing · ${input.date}`;
  const counts = `${input.events.length} events · ${input.conflicts.length} conflict(s)`;
  const events = input.events.length === 0
    ? '_no events today_'
    : input.events.map(formatEventLine).join('\n');
  return `${header}\n\n${counts}\n\n## Schedule\n${events}\n\n## Conflicts\n${conflictsBlock(input.conflicts)}`;
}

export interface EveningReportInput {
  domain: string;
  date: string; // YYYY-MM-DD
  today: CalendarEventDto[];
  tomorrow: CalendarEventDto[];
  pendingConflicts: CalendarConflictDto[];
}

export function generateEveningReport(input: EveningReportInput): string {
  const header = `# ${input.domain.toUpperCase()} · evening check-out · ${input.date}`;
  const todayBlock = input.today.length === 0
    ? '_no events completed today_'
    : input.today.map(formatEventLine).join('\n');
  const tomorrowBlock = input.tomorrow.length === 0
    ? '_tomorrow is open_'
    : input.tomorrow.map(formatEventLine).join('\n');
  return [
    header,
    '',
    `## Today (${input.today.length})\n${todayBlock}`,
    '',
    `## Tomorrow preview (${input.tomorrow.length})\n${tomorrowBlock}`,
    '',
    `## Open conflicts (${input.pendingConflicts.length})\n${conflictsBlock(input.pendingConflicts)}`,
  ].join('\n');
}