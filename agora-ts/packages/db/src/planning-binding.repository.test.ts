import { afterEach, describe, expect, it } from 'vitest';
import { createAgoraDatabase, runMigrations } from './database.js';
import { PlanningBindingRepository } from './repositories/planning-binding.repository.js';

describe('PlanningBindingRepository', () => {
  const databases: ReturnType<typeof createAgoraDatabase>[] = [];
  afterEach(() => { while (databases.length) databases.pop()?.close(); });

  it('merges task and calendar provider refs without storing credentials', () => {
    const db = createAgoraDatabase({ dbPath: ':memory:' });
    databases.push(db);
    runMigrations(db);
    db.prepare(`INSERT INTO tasks (id,title,type,creator,team,workflow,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)`)
      .run('task-1', 'Title', 'general', 'user', '{}', '{}', '2026-09-01', '2026-09-01');
    const repo = new PlanningBindingRepository(db);

    repo.upsert({ taskId: 'task-1', domain: 'life', externalTask: { provider: 'ticktick', ref: 'tt-1', projectRef: 'p-1' } });
    const binding = repo.upsert({ taskId: 'task-1', domain: 'life', calendarEvent: { provider: 'google-calendar', ref: 'gc-1' } });

    expect(binding).toMatchObject({ externalTaskRef: 'tt-1', calendarEventRef: 'gc-1', domain: 'life', syncMode: 'manual', lastSyncStatus: 'pending' });
    expect(repo.list()).toHaveLength(1);

    const configured = repo.setSyncMode('task-1', 'bidirectional');
    expect(configured.syncMode).toBe('bidirectional');
    const synced = repo.recordSyncResult('task-1', { status: 'conflict', syncedAt: '2026-09-01T01:00:00.000Z', error: 'terminal disagreement' });
    expect(synced).toMatchObject({ lastSyncStatus: 'conflict', lastSyncAt: '2026-09-01T01:00:00.000Z', lastSyncError: 'terminal disagreement' });
  });
});
