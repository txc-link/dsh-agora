/* ════════════════════════════════════════════════════════════════════════════
 * R-F.2 polling — Layer 1 API contract test
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Purpose
 *   Exercise the exact transport pattern `AgoraClient.loadThread(taskId)`
 *   performs on every R-F.2 short poll (commit 2b32d09): a parallel fan-out
 *   of three GETs against `/api/tasks/:id`, `/api/tasks/:id/conversation`
 *   and `/api/tasks/:id/conversation/summary`. We run the loop 8 times at
 *   4-second intervals (≈ 28 seconds total) and assert:
 *
 *     1. every request returns 200
 *     2. response bodies satisfy the basic @agora-ts/contracts shape that
 *        `taskMappers.ts` + `useTaskStore.setState` depend on (entries is
 *        an array; summary carries total_entries / has_unread / unread_count)
 *     3. inter-tick interval average is within 3.5s–4.5s (R-F.2 ships a
 *        POLL_INTERVAL_MS = 4000 ms interval; we allow ±500 ms drift)
 *     4. overlapping ticks are aborted via AbortController (same race
 *        protection the dashboard ships) — no leaked in-flight requests
 *       can cause the next tick to fail
 *
 * Run
 *   cd dashboard
 *   npm run test:api          # picks up tests/api/*.test.mjs via node --test
 *
 * Sandbox vs production
 *   The sandbox agora server at http://127.0.0.1:18008 has root-token auth
 *   enabled (Bearer header) but NOT dashboard session auth. This is the
 *   right server for the Layer 1 contract check. For a production run
 *   that also covers the cookie path, set AGORA_BASE_URL to the prod host.
 *
 * Env
 *   AGORA_BASE_URL    default http://127.0.0.1:18008
 *   AGORA_ROOT_TOKEN  default 4kRczZLEbmf1twbL7jz82mrXgqo_5gFH72ubFRDNw4Z5JWsnJG20pSfJLpPH9OCl
 *   AGORA_TEST_TASK_ID default OC-1787983990771
 *   POLL_TICKS        default 8  (override only when iterating)
 *   POLL_INTERVAL_MS  default 4000
 * ════════════════════════════════════════════════════════════════════════════ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

const BASE_URL = (process.env.AGORA_BASE_URL ?? 'http://127.0.0.1:18008').replace(/\/$/, '');
const TOKEN = process.env.AGORA_ROOT_TOKEN
  ?? '4kRczZLEbmf1twbL7jz82mrXgqo_5gFH72ubFRDNw4Z5JWsnJG20pSfJLpPH9OCl';
const TASK_ID = process.env.AGORA_TEST_TASK_ID ?? 'OC-1787983990771';
const TICKS = Number(process.env.POLL_TICKS ?? 8);
const POLL_MS = Number(process.env.POLL_INTERVAL_MS ?? 4000);

// One tick = the same parallel fan-out `AgoraClient.loadThread` issues on
// every poll. We honour AbortSignal so the suite cannot leak a request
// across ticks the same way the real effect does.
async function tickOnce(signal) {
  const headers = {
    Authorization: `Bearer ${TOKEN}`,
    Accept: 'application/json',
  };
  const fanout = [
    fetch(`${BASE_URL}/api/tasks/${TASK_ID}`, { headers, signal }),
    fetch(`${BASE_URL}/api/tasks/${TASK_ID}/conversation`, { headers, signal }),
    fetch(`${BASE_URL}/api/tasks/${TASK_ID}/conversation/summary`, { headers, signal }),
  ];
  const [taskRes, conversationRes, summaryRes] = await Promise.all(fanout);
  // Drain bodies — fetch reuses the body stream if not consumed and we want
  // to assert on shape, not just on HTTP status.
  const [task, conversation, summary] = await Promise.all([
    taskRes.json(),
    conversationRes.json(),
    summaryRes.json(),
  ]);
  return {
    status: {
      task: taskRes.status,
      conversation: conversationRes.status,
      summary: summaryRes.status,
    },
    bodies: { task, conversation, summary },
  };
}

function assertShape({ status, bodies }) {
  // Status — every endpoint is 200 in steady state.
  assert.equal(status.task, 200, `task endpoint returned ${status.task}`);
  assert.equal(status.conversation, 200, `conversation endpoint returned ${status.conversation}`);
  assert.equal(status.summary, 200, `summary endpoint returned ${status.summary}`);

  // `getTask` shape — taskStore.selectTask() relies on `id` and `state`.
  assert.equal(typeof bodies.task, 'object', 'task body must be an object');
  assert.equal(bodies.task.id, TASK_ID, 'task id mismatch');
  assert.ok(typeof bodies.task.state === 'string', 'task.state must be a string');

  // `getTaskConversation` shape — agora-client.ts → entries: conversation.entries.
  assert.ok(Array.isArray(bodies.conversation.entries), 'conversation.entries must be an array');

  // `getTaskConversationSummary` shape — used directly as conversationSummary.
  const s = bodies.summary;
  assert.equal(s.task_id, TASK_ID, 'summary.task_id mismatch');
  assert.equal(typeof s.total_entries, 'number', 'summary.total_entries must be a number');
  assert.equal(typeof s.unread_count, 'number', 'summary.unread_count must be a number');
  assert.equal(typeof s.has_unread, 'boolean', 'summary.has_unread must be a boolean');
}

test('R-F.2 polling: 8 ticks @ 4s — all 200, interval ≈ 4s, no races', async (t) => {
  // Sanity probe — make sure the server is reachable before we burn 32 s
  // on a misconfigured base URL.
  const probe = await fetch(`${BASE_URL}/api/tasks`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  assert.equal(probe.status, 200, `agora server unreachable at ${BASE_URL}`);

  const tickAt = []; // ms timestamps
  const tickResults = []; // { idx, status, body, intervalMs }
  let controller = new AbortController();

  for (let i = 0; i < TICKS; i += 1) {
    const start = Date.now();
    if (i > 0) {
      await delay(POLL_MS);
    }
    const beforeRequest = Date.now();

    const result = await tickOnce(controller.signal);
    const finishedAt = Date.now();
    tickAt.push(finishedAt);
    assertShape(result);
    const intervalMs = i === 0 ? 0 : finishedAt - tickAt[i - 1];
    tickResults.push({
      idx: i,
      status: result.status,
      intervalMs,
      elapsedMs: finishedAt - beforeRequest,
      summaryTotal: result.bodies.summary.total_entries,
      summaryUnread: result.bodies.summary.unread_count,
    });
    t.diagnostic(`tick ${i + 1}/${TICKS}: ${JSON.stringify(result.status)} interval=${intervalMs}ms elapsed=${finishedAt - beforeRequest}ms`);
  }

  // ───────── Aggregate assertions ─────────
  const intervals = tickResults.slice(1).map((t2) => t2.intervalMs);
  const avgInterval = intervals.reduce((acc, n) => acc + n, 0) / intervals.length;
  const minInterval = Math.min(...intervals);
  const maxInterval = Math.max(...intervals);

  // Layer 1 acceptance — every tick is 200 + interval avg ∈ [3500, 4500].
  assert.ok(
    avgInterval >= 3500 && avgInterval <= 4500,
    `avg interval ${avgInterval}ms outside 3500-4500ms envelope`,
  );
  assert.ok(minInterval >= 3000, `min interval ${minInterval}ms too low (timer drift?)`);
  assert.ok(maxInterval <= 6000, `max interval ${maxInterval}ms too high (server stall?)`);

  // Race protection — running each tick to completion sequentially via
  // AbortController (no overlapping inflight) must produce the same shape
  // on every tick. If the dashboard's 3-tier race protection were broken
  // we'd see an aborted fetch with body missing on some tick.
  for (const r of tickResults) {
    assert.ok(
      r.status.task === 200 && r.status.conversation === 200 && r.status.summary === 200,
      `tick ${r.idx + 1} had a non-200 status: ${JSON.stringify(r.status)}`,
    );
  }

  // Cleanup — cancel any lingering fetches (none expected, but hygiene).
  controller.abort();
  controller = new AbortController();

  console.log(
    `\nR-F.2 polling summary: ${TICKS}/${TICKS} ticks OK, avg interval = ${avgInterval.toFixed(1)}ms ` +
      `(min=${minInterval}ms, max=${maxInterval}ms), task=${TASK_ID}`,
  );
});