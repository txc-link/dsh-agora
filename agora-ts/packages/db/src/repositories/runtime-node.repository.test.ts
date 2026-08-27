import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createAgoraDatabase, runMigrations, type AgoraDatabase } from '../database.js';
import { RuntimeNodeRepository } from './runtime-node.repository.js';

const tempPaths: string[] = [];
const databases: AgoraDatabase[] = [];

function makeDbPath() {
  const dir = mkdtempSync(join(tmpdir(), 'agora-ts-runtime-node-repository-'));
  tempPaths.push(dir);
  return join(dir, 'tasks.db');
}

afterEach(() => {
  while (databases.length > 0) databases.pop()?.close();
  while (tempPaths.length > 0) {
    const dir = tempPaths.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('runtime node repository', () => {
  it('persists heartbeats and marks an expired lease stale', () => {
    const db = createAgoraDatabase({ dbPath: makeDbPath() });
    databases.push(db);
    runMigrations(db);
    const repository = new RuntimeNodeRepository(db);
    const now = new Date('2026-08-26T01:00:00.000Z');

    const node = repository.upsertNode('web-1', {
      protocol: 'dsh-agora.node/v1',
      instance_id: 'instance-1',
      plugin_version: '0.2.0',
      host_framework: 'deepseek-harness',
      runtime_provider: 'dsh',
      agents: [{
        agent_ref: 'default',
        display_name: 'Default agent',
        roles: ['worker'],
        capabilities: ['session.resume'],
      }],
      bots: [{
        provider: 'discord',
        bot_ref: 'discord-main',
        platform_id: '1234',
        agent_ref: 'default',
        connected: true,
        capabilities: ['send'],
      }],
      capacity: { max_concurrent: 2, active: 0 },
      lease_seconds: 90,
    }, now);

    expect(node.presence).toBe('online');
    expect(repository.getNode('web-1', new Date('2026-08-26T01:01:31.000Z'))).toMatchObject({
      node_id: 'web-1',
      presence: 'stale',
    });
  });

  it('claims and completes dispatches idempotently', () => {
    const db = createAgoraDatabase({ dbPath: makeDbPath() });
    databases.push(db);
    runMigrations(db);
    const repository = new RuntimeNodeRepository(db);
    repository.upsertNode('web-1', {
      protocol: 'dsh-agora.node/v1',
      instance_id: 'instance-1',
      plugin_version: '0.2.0',
      host_framework: 'deepseek-harness',
      runtime_provider: 'dsh',
      agents: [{ agent_ref: 'default', roles: [], capabilities: [] }],
      bots: [],
      capacity: { max_concurrent: 1, active: 0 },
      lease_seconds: 90,
    });
    const input = {
      runtime_target_ref: 'dsh:web-1:default',
      prompt: 'Review the current task.',
      idempotency_key: 'task-1-review-1',
    };

    const created = repository.createDispatch('web-1', input);
    const replayed = repository.createDispatch('web-1', input);
    expect(replayed.id).toBe(created.id);

    const claimed = repository.claimDispatch('web-1', 'instance-1', 120);
    expect(claimed).toMatchObject({ id: created.id, status: 'claimed', claimed_by: 'instance-1' });
    expect(repository.claimDispatch('web-1', 'instance-2', 120)).toBeNull();

    expect(repository.completeDispatch('web-1', created.id, {
      instance_id: 'instance-2',
      status: 'completed',
      result: { answer: 'wrong owner' },
    })).toBeNull();

    const completed = repository.completeDispatch('web-1', created.id, {
      instance_id: 'instance-1',
      status: 'completed',
      session_id: 'session-1',
      result: { answer: 'done' },
    });
    expect(completed).toMatchObject({
      status: 'completed',
      session_id: 'session-1',
      result: { answer: 'done' },
    });
  });
});
