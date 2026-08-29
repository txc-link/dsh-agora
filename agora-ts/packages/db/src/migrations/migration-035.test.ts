/**
 * migration-035.test.ts — R-D (T-3) task_conversation_entries rebuild.
 *
 * Verifies migration 035:
 *   1. legacy rows survive the rebuild (binding_id preserved, thread_task_binding_id NULL)
 *   2. new column allows NULL binding_id + linked thread_task_binding_id
 *   3. indexes still work (dedupe unique)
 */

import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createAgoraDatabase,
  runMigrations,
  TaskConversationRepository,
  TaskContextBindingRepository,
  TaskRepository,
} from '../index.js';

const tempPaths: string[] = [];

function freshDb() {
  const dir = mkdtempSync(join(tmpdir(), 'agora-ts-m035-'));
  tempPaths.push(dir);
  const db = createAgoraDatabase({ dbPath: join(dir, 'm035.db') });
  runMigrations(db);
  return db;
}

afterEach(() => {
  while (tempPaths.length > 0) {
    const dir = tempPaths.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

import { afterEach } from 'vitest';

function seedTask(db: ReturnType<typeof createAgoraDatabase>, id: string): void {
  new TaskRepository(db).insertTask({
    id,
    title: 'demo',
    description: null,
    type: 'oneoff',
    priority: 'normal',
    creator: 'user:1',
    locale: 'zh-CN',
    project_id: null,
    skill_policy: null,
    team: { members: [] },
    workflow: { stages: [], graph: { graph_version: 1, entry_nodes: [], nodes: [], edges: [] } },
    control: null,
  });
}

describe('migration 035 task_conversation_entries rebuild', () => {
  it('legacy insert with binding_id still works and is readable', () => {
    const db = freshDb();
    const repo = new TaskConversationRepository(db);
    const ctxRepo = new TaskContextBindingRepository(db);

    // task + legacy binding required by FK
    seedTask(db, 'T-L1');
    const binding = ctxRepo.insert({
      id: 'b-ctx-legacy-1',
      task_id: 'T-L1',
      im_provider: 'discord',
      status: 'active',
    });

    const entry = repo.insert({
      id: 'cv-legacy-1',
      task_id: 'T-L1',
      binding_id: binding.id,
      provider: 'discord',
      direction: 'inbound',
      author_kind: 'human',
      body: 'legacy reply',
      occurred_at: '2026-08-01T00:00:00Z',
    });
    expect(entry.binding_id).toBe(binding.id);
    expect(entry.thread_task_binding_id).toBeNull();
    expect(repo.getById('cv-legacy-1')!.body).toBe('legacy reply');
  });

  it('insert with NULL binding_id + thread_task_binding_id works (R-D inbound)', () => {
    const db = freshDb();
    const repo = new TaskConversationRepository(db);
    seedTask(db, 'T-R1');
    db.prepare(`INSERT INTO thread_task_bindings (thread_key, task_id, created_at, updated_at)
      VALUES ('mx_0123456789abcdef', 'T-R1', '2026-08-30T00:00:00Z', '2026-08-30T00:00:00Z')`).run();

    const entry = repo.insert({
      id: 'cv-rd-1',
      task_id: 'T-R1',
      binding_id: null,
      thread_task_binding_id: 'mx_0123456789abcdef',
      provider: 'matrix',
      provider_message_ref: '$evt-1',
      parent_message_ref: '$parent-1',
      direction: 'inbound',
      author_kind: 'human',
      author_ref: '@user:agent-hub.local',
      body: '答复内容',
      occurred_at: '2026-08-30T12:00:00Z',
      dedupe_key: 'matrix:$evt-1',
    });
    expect(entry.binding_id).toBeNull();
    expect(entry.thread_task_binding_id).toBe('mx_0123456789abcdef');
    expect(entry.parent_message_ref).toBe('$parent-1');
  });

  it('dedupe unique index still enforces idempotency', () => {
    const db = freshDb();
    const repo = new TaskConversationRepository(db);
    seedTask(db, 'T-R2');

    const first = repo.insert({
      id: 'cv-rd-2a',
      task_id: 'T-R2',
      binding_id: null,
      provider: 'matrix',
      provider_message_ref: '$evt-2',
      direction: 'inbound',
      author_kind: 'agent',
      body: 'reply',
      occurred_at: '2026-08-30T12:00:00Z',
      dedupe_key: 'matrix:$evt-2',
    });
    const second = repo.insert({
      id: 'cv-rd-2b',
      task_id: 'T-R2',
      binding_id: null,
      provider: 'matrix',
      provider_message_ref: '$evt-2',
      direction: 'inbound',
      author_kind: 'agent',
      body: 'reply',
      occurred_at: '2026-08-30T12:00:00Z',
      dedupe_key: 'matrix:$evt-2',
    });
    expect(second.id).toBe(first.id);
    expect(repo.listByTask('T-R2')).toHaveLength(1);
  });
});