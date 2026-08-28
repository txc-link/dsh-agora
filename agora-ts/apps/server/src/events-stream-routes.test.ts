/**
 * tests/events-stream-routes.test.ts — RED tests for /api/events/stream
 *
 * These tests describe the SSE contract:
 *   - 200 OK with text/event-stream content-type
 *   - Each event is `data: <json>\n\n`
 *   - New flow_log insertions on the watched task are pushed within the
 *     server's poll interval (≤ 1s in tests).
 *   - Client disconnect clears the server-side timer.
 */

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  FlowLogRepository,
  ProgressLogRepository,
  createAgoraDatabase,
  runMigrations,
} from '@agora-ts/db';
import {
  createProjectServiceFromDb,
  createTaskServiceFromDb,
} from '@agora-ts/testing';
import { buildApp } from './app.js';

const tempPaths: string[] = [];
const templatesDir = resolve(process.cwd(), 'templates');

function makeDbPath() {
  const dir = mkdtempSync(join(tmpdir(), 'agora-ts-events-stream-'));
  tempPaths.push(dir);
  return join(dir, 'events.db');
}

function makeDb() {
  const db = createAgoraDatabase({ dbPath: makeDbPath() });
  runMigrations(db);
  return db;
}

afterEach(() => {
  while (tempPaths.length > 0) {
    const dir = tempPaths.pop();
    if (!dir) continue;
  }
});

function buildTestApp() {
  const db = makeDb();
  const projectService = createProjectServiceFromDb(db);
  const taskService = createTaskServiceFromDb(db, { templatesDir });
  const flowLogRepository = new FlowLogRepository(db);
  const progressLogRepository = new ProgressLogRepository(db);
  return buildApp({
    db,
    projectService,
    taskService,
    flowLogRepository,
    progressLogRepository,
  });
}

describe('GET /api/events/stream (SSE)', () => {
  it('rejects when neither task_id nor project_id is given', async () => {
    const app = buildTestApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/events/stream',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ message: expect.stringMatching(/task_id|project_id/) });
  });

  it('opens a text/event-stream response with the SSE preamble', async () => {
    // app.inject hangs forever after reply.hijack() because light-my-request
    // does not know to resolve when the handler hijacks the socket. Spin up
    // a real Fastify .listen server and curl it instead.
    const app = buildTestApp();
    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    try {
      const url = new URL('/api/events/stream?project_id=node-a', address);
      const controller = new AbortController();
      const response = await fetch(url, { signal: controller.signal });
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/event-stream');
      expect(response.headers.get('cache-control')).toBe('no-cache');
      // Read just the preamble, then abort.
      const reader = response.body?.getReader();
      if (reader) {
        const { value } = await reader.read();
        const text = value ? new TextDecoder().decode(value) : '';
        expect(text).toMatch(/retry: 1000/);
        expect(text).toMatch(/event: open/);
        await reader.cancel();
      }
      controller.abort();
    } finally {
      await app.close();
    }
  });
});