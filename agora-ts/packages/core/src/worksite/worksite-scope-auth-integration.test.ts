/**
 * worksite-scope-auth-integration.test.ts — Phase 3.5-3a (R-H / T-2)
 *
 * Integration test for the composition wiring. Validates that the
 * worksite scopeAuthResolver (replacing the env stub) correctly
 * derives ScopeAuthorization from a TaskRecord, and that registry
 * registration throws on duplicate / accepts unknown types → undefined.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAgoraDatabase, runMigrations, TaskRepository } from '@agora-ts/db';
import {
  WorksiteResolverRegistry,
  TaskWorksiteResolver,
  parseWorksiteUri,
  deriveScopeAuthorization,
  ThreadWorksiteResolver,
} from '@agora-ts/core';

const tempPaths: string[] = [];

function freshDb() {
  const dir = mkdtempSync(join(tmpdir(), 'agora-ts-worksite-int-'));
  tempPaths.push(dir);
  const db = createAgoraDatabase({ dbPath: join(dir, 'ws.db') });
  runMigrations(db);
  return db;
}

afterEach(() => {
  while (tempPaths.length > 0) {
    const dir = tempPaths.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('worksite scopeAuthResolver integration', () => {
  it('registry.register accepts TaskWorksiteResolver and rejects duplicate', () => {
    const reg = new WorksiteResolverRegistry();
    const db = freshDb();
    const repo = new TaskRepository(db);
    const r1 = new TaskWorksiteResolver({ taskRepository: repo });
    reg.register(r1);
    expect(reg.has('task')).toBe(true);
    expect(() => reg.register(r1)).toThrow(/already registered/i);
  });

  it('ThreadWorksiteResolver can register thread type without throwing', () => {
    const reg = new WorksiteResolverRegistry();
    const r = new ThreadWorksiteResolver({
      threadSource: { getThreadMetadata: async () => undefined, listRooms: async () => [] },
    });
    expect(() => reg.register(r)).not.toThrow();
    expect(reg.has('thread')).toBe(true);
  });

  it('parseWorksiteUri recognizes task and thread types', () => {
    expect(parseWorksiteUri('agora://task/T-1').type).toBe('task');
    expect(parseWorksiteUri('agora://task/T-1').id).toBe('T-1');
    expect(parseWorksiteUri('agora://thread/mx_a0000000000000001').type).toBe('thread');
    expect(parseWorksiteUri('agora://thread/mx_a0000000000000001').id).toBe('mx_a0000000000000001');
  });

  it('scopeAuthResolver composition pattern: task URI → derived auth, thread URI → undefined', () => {
    const db = freshDb();
    const taskRepo = new TaskRepository(db);
    taskRepo.insertTask({
      id: 'T-99',
      title: 'demo',
      description: null,
      type: 'oneoff',
      priority: 'normal',
      creator: 'user:1',
      locale: 'zh-CN',
      project_id: null,
      skill_policy: null,
      team: { members: [] },
      workflow: { stages: [], graph: { nodes: [], edges: [] } },
      control: null,
    });

    const resolve = (target: string) => {
      try {
        const parsed = parseWorksiteUri(target);
        if (parsed.type !== 'task') return undefined;
        const task = taskRepo.getTask(parsed.id);
        if (!task) return undefined;
        return deriveScopeAuthorization(task);
      } catch {
        return undefined;
      }
    };

    const taskAuth = resolve('agora://task/T-99');
    expect(taskAuth?.scope).toBe('agora://task/T-99');
    expect(taskAuth?.posture).toBe('Auto');
    expect([...taskAuth!.permissions].sort()).toEqual(['execute', 'read']);

    expect(resolve('agora://thread/mx_a0000000000000001')).toBeUndefined();
    expect(resolve('agora://task/T-missing')).toBeUndefined();
    expect(resolve('not-a-uri')).toBeUndefined();
  });
});