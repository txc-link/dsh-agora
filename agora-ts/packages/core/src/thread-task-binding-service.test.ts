/**
 * thread-task-binding-service.test.ts — TDD for ThreadTaskBindingService.
 *
 * Pure Core service: validates input, delegates to IThreadTaskBindingRepository.
 * No platform names (§1).
 */

import { describe, expect, it } from 'vitest';
import {
  ThreadTaskBindingService,
  type ThreadTaskBindingServiceOptions,
} from './thread-task-binding-service.js';
import type {
  IThreadTaskBindingRepository,
  ThreadTaskBinding,
} from '@agora-ts/contracts';
import type { ITaskRepository, TaskRecord } from '@agora-ts/contracts';

class InMemoryBindingRepo implements IThreadTaskBindingRepository {
  private readonly map = new Map<string, ThreadTaskBinding>(); // key = threadKey
  private next = 0;

  bind(input: { threadKey: string; taskId: string }): ThreadTaskBinding {
    const now = new Date().toISOString();
    const existing = this.map.get(input.threadKey);
    // taskId uniqueness: remove previous binding for this task
    for (const [k, v] of this.map) {
      if (v.taskId === input.taskId && k !== input.threadKey) this.map.delete(k);
    }
    const next: ThreadTaskBinding = Object.freeze({
      threadKey: input.threadKey,
      taskId: input.taskId,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
    this.map.set(input.threadKey, next);
    return next;
  }

  unbindByThreadKey(threadKey: string): boolean {
    return this.map.delete(threadKey);
  }

  unbindByTask(taskId: string): boolean {
    for (const [k, v] of this.map) {
      if (v.taskId === taskId) {
        this.map.delete(k);
        return true;
      }
    }
    return false;
  }

  getByTask(taskId: string): ThreadTaskBinding | undefined {
    for (const v of this.map.values()) if (v.taskId === taskId) return v;
    return undefined;
  }

  getByThreadKey(threadKey: string): ThreadTaskBinding | undefined {
    return this.map.get(threadKey);
  }

  list(): readonly ThreadTaskBinding[] {
    return [...this.map.values()];
  }
}

class StubTaskRepo implements Pick<ITaskRepository, 'getTask'> {
  private readonly tasks = new Map<string, TaskRecord>();
  set(t: TaskRecord): void { this.tasks.set(t.id, t); }
  getTask(id: string): TaskRecord | null {
    return this.tasks.get(id) ?? null;
  }
}

function makeService(opts?: { tasks?: TaskRecord[]; threadSource?: 'any' | 'mx' | 'sha' }) {
  const repo = new InMemoryBindingRepo();
  const taskRepo = new StubTaskRepo();
  for (const t of opts?.tasks ?? []) taskRepo.set(t);
  const service = new ThreadTaskBindingService({
    repo,
    taskRepo,
    ...(opts?.threadSource !== undefined ? { threadKeyPattern: sourcePattern(opts.threadSource) } : {}),
  });
  return { service, repo, taskRepo };
}

function sourcePattern(kind: 'any' | 'mx' | 'sha'): ThreadTaskBindingServiceOptions['threadKeyPattern'] {
  if (kind === 'any') return /^.+$/;
  if (kind === 'mx') return /^mx_[0-9a-f]{16}$/;
  return /^[0-9a-f]{64}$/; // sha256 hex
}

const SAMPLE_TASK: TaskRecord = {
  id: 'T-1',
  version: 1,
  title: 'demo',
  description: null,
  type: 'oneoff',
  priority: 'normal',
  creator: 'user:1',
  locale: 'zh-CN',
  project_id: null,
  state: 'pending',
  archive_status: null,
  current_stage: null,
  skill_policy: null,
  team: { members: [] },
  workflow: { stages: [], graph: { nodes: [], edges: [] } },
  control: null,
  scheduler: null,
  scheduler_snapshot: null,
  discord: null,
  metrics: null,
  error_detail: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('ThreadTaskBindingService', () => {
  it('binds a threadKey to an existing task', () => {
    const { service } = makeService({ tasks: [SAMPLE_TASK] });
    const binding = service.bind({ threadKey: 'mx_abc123def4567890', taskId: 'T-1' });
    expect(binding.threadKey).toBe('mx_abc123def4567890');
    expect(binding.taskId).toBe('T-1');
    expect(binding.createdAt).toBe(binding.updatedAt);
  });

  it('throws on unknown task', () => {
    const { service } = makeService({ tasks: [] });
    expect(() => service.bind({ threadKey: 'mx_abc123def4567890', taskId: 'T-missing' })).toThrow(/task not found/i);
  });

  it('rejects malformed threadKey (no match against pattern)', () => {
    const { service } = makeService({ tasks: [SAMPLE_TASK], threadSource: 'mx' });
    expect(() => service.bind({ threadKey: 'not_mx_format', taskId: 'T-1' })).toThrow(/threadKey/i);
  });

  it('rebind replaces previous task binding (one-to-one)', () => {
    const T2: TaskRecord = { ...SAMPLE_TASK, id: 'T-2' };
    const { service, repo } = makeService({ tasks: [SAMPLE_TASK, T2] });
    service.bind({ threadKey: 'mx_a0000000000000001', taskId: 'T-1' });
    const rebound = service.bind({ threadKey: 'mx_a0000000000000001', taskId: 'T-2' });
    expect(rebound.taskId).toBe('T-2');
    expect(service.getByTask('T-1')).toBeUndefined();
    expect(repo.list().length).toBe(1);
  });

  it('unbindByThreadKey removes binding', () => {
    const { service } = makeService({ tasks: [SAMPLE_TASK] });
    service.bind({ threadKey: 'mx_b0000000000000001', taskId: 'T-1' });
    expect(service.unbindByThreadKey('mx_b0000000000000001')).toBe(true);
    expect(service.getByThreadKey('mx_b0000000000000001')).toBeUndefined();
  });

  it('unbindByTask removes binding', () => {
    const { service } = makeService({ tasks: [SAMPLE_TASK] });
    service.bind({ threadKey: 'mx_c0000000000000001', taskId: 'T-1' });
    expect(service.unbindByTask('T-1')).toBe(true);
    expect(service.getByTask('T-1')).toBeUndefined();
  });

  it('getByTask returns the binding for the given task', () => {
    const { service } = makeService({ tasks: [SAMPLE_TASK] });
    service.bind({ threadKey: 'mx_d0000000000000001', taskId: 'T-1' });
    const got = service.getByTask('T-1');
    expect(got?.threadKey).toBe('mx_d0000000000000001');
  });

  it('list returns all bindings', () => {
    const T2: TaskRecord = { ...SAMPLE_TASK, id: 'T-2' };
    const { service } = makeService({ tasks: [SAMPLE_TASK, T2] });
    service.bind({ threadKey: 'mx_e0000000000000001', taskId: 'T-1' });
    service.bind({ threadKey: 'mx_e0000000000000002', taskId: 'T-2' });
    expect(service.list().length).toBe(2);
  });

  it('rebinding same (threadKey, taskId) is idempotent', () => {
    const { service, repo } = makeService({ tasks: [SAMPLE_TASK] });
    const first = service.bind({ threadKey: 'mx_f0000000000000001', taskId: 'T-1' });
    const second = service.bind({ threadKey: 'mx_f0000000000000001', taskId: 'T-1' });
    expect(second.taskId).toBe(first.taskId);
    expect(repo.list().length).toBe(1);
  });
});