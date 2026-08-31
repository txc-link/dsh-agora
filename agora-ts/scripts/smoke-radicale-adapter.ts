/**
 * Smoke harness for the Radicale calendar adapter (2026-08-31).
 *
 * Boots a tiny in-process HTTP server that pretends to be Radicale,
 * serves a fixed VCALENDAR blob, and drives RadicaleClient +
 * computeConflicts + generateMorningReport end-to-end. Verifies the
 * adapter round-trips without needing a real Radicale container.
 *
 * Run: `npx tsx scripts/smoke-radicale-adapter.ts`
 * Exit: 0 on success, non-zero on any mismatch.
 */
import { createServer } from 'node:http';
import {
  RadicaleClient,
  computeConflicts,
  generateMorningReport,
  parseICalEvents,
} from '@agora-ts/adapters-calendar';

const SAMPLE_ICS = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//agora-ts//smoke//EN',
  'BEGIN:VEVENT',
  'UID:smoke-1@work',
  'SUMMARY:Smoke stand-up',
  'DTSTART:20260831T090000Z',
  'DTEND:20260831T100000Z',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:smoke-2@work',
  'SUMMARY:Smoke vendor call',
  'DTSTART:20260831T093000Z',
  'DTEND:20260831T103000Z',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\n');

interface SmokeResult {
  port: number;
  events: number;
  conflicts: number;
  reportIncludes: string[];
}

async function main(): Promise<SmokeResult> {
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/calendar' });
    response.end(SAMPLE_ICS);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('failed to bind smoke server');
  const port = address.port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const client = new RadicaleClient({ baseUrl, username: 'alice', password: 'smoke' });
  const events = await client.fetchCollection('/alice/work/');
  const conflicts = computeConflicts(events);
  const markdown = generateMorningReport({
    domain: 'work',
    date: '2026-08-31',
    events,
    conflicts,
  });

  await new Promise<void>((resolve) => server.close(() => resolve()));

  // Validate via the pure parser as a second path (no HTTP).
  const reparsed = parseICalEvents(SAMPLE_ICS);
  if (reparsed.length !== events.length) {
    throw new Error(`parser mismatch: http=${events.length} inline=${reparsed.length}`);
  }

  return {
    port,
    events: events.length,
    conflicts: conflicts.length,
    reportIncludes: [
      '# WORK · morning briefing',
      '2 events',
      'Smoke stand-up',
      'Smoke vendor call',
    ].filter((needle) => markdown.includes(needle)),
  };
}

main()
  .then((result) => {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ ok: true, ...result }, null, 2));
    if (result.events !== 2 || result.conflicts !== 1) {
      throw new Error(`expected 2 events / 1 conflict, got ${result.events} / ${result.conflicts}`);
    }
    if (result.reportIncludes.length < 4) {
      throw new Error(`missing expected strings in report: ${JSON.stringify(result.reportIncludes)}`);
    }
  })
  .catch((cause: unknown) => {
    // eslint-disable-next-line no-console
    console.error('smoke-radicale-adapter failed:', cause instanceof Error ? cause.message : cause);
    process.exit(1);
  });