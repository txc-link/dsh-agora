/**
 * thread-bind-command.test.ts — R-C / T-1.5 CLI command tests.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAgoraDatabase, runMigrations } from '@agora-ts/db';
import { TaskRepository } from '@agora-ts/db';
import { ThreadTaskBindingRepository } from '@agora-ts/db';
import { ThreadTaskBindingService } from './thread-task-binding-service.js';
import { runThreadBindCommand } from './thread-bind-command.js';

const tempPaths: string[] = [];

function freshDb() {
  const dir = mkdtempSync(join(tmpdir(), 'agora-ts-thread-cmd-'));
  tempPaths.push(dir);
  const db = createAgoraDatabase({ dbPath: join(dir, 'cmd.db') });
  runMigrations(db);
  return db;
}

afterEach(() => {
  while (tempPaths.length > 0) {
    const dir = tempPaths.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function makeDeps(preinsert: string[] = []) {
  const db = freshDb();
  const bindingRepo = new ThreadTaskBindingRepository(db);
  const taskRepo = new TaskRepository(db);
  for (const id of preinsert) {
    taskRepo.insertTask({
      id,
      title: 'preinserted',
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
  }
  const service = new ThreadTaskBindingService({ repo: bindingRepo, taskRepo });
  return { bindingRepo, service };
}

describe('runThreadBindCommand', () => {
  it('bind succeeds when task exists', async () => {
    const { service, bindingRepo } = makeDeps(['T-1']);
    const out = await runThreadBindCommand(
      { bindingService: service, bindingRepo },
      { subcommand: 'bind', threadKey: 'mx_a0000000000000001', taskId: 'T-1' },
    );
    expect(out.ok).toBe(true);
    expect((out.data as { threadKey: string }).threadKey).toBe('mx_a0000000000000001');
  });

  it('bind fails clearly when task missing', async () => {
    const { service, bindingRepo } = makeDeps([]);
    const out = await runThreadBindCommand(
      { bindingService: service, bindingRepo },
      { subcommand: 'bind', threadKey: 'mx_a0000000000000001', taskId: 'T-missing' },
    );
    expect(out.ok).toBe(false);
    expect(out.error).toMatch(/task not found/i);
  });

  it('bind requires both --thread-key and --task-id', async () => {
    const { service, bindingRepo } = makeDeps(['T-1']);
    const out = await runThreadBindCommand(
      { bindingService: service, bindingRepo },
      { subcommand: 'bind', threadKey: 'mx_a0000000000000001' },
    );
    expect(out.ok).toBe(false);
    expect(out.error).toMatch(/taskId is required/i);
  });

  it('unbind by threadKey', async () => {
    const { service, bindingRepo } = makeDeps(['T-1']);
    runThreadBindCommand(
      { bindingService: service, bindingRepo },
      { subcommand: 'bind', threadKey: 'mx_a0000000000000001', taskId: 'T-1' },
    );
    const out = await runThreadBindCommand(
      { bindingService: service, bindingRepo },
      { subcommand: 'unbind', unbindThreadKey: 'mx_a0000000000000001' },
    );
    expect(out.ok).toBe(true);
    expect((out.data as { removed: boolean }).removed).toBe(true);
  });

  it('unbind by taskId', async () => {
    const { service, bindingRepo } = makeDeps(['T-1']);
    runThreadBindCommand(
      { bindingService: service, bindingRepo },
      { subcommand: 'bind', threadKey: 'mx_a0000000000000001', taskId: 'T-1' },
    );
    const out = await runThreadBindCommand(
      { bindingService: service, bindingRepo },
      { subcommand: 'unbind', unbindTaskId: 'T-1' },
    );
    expect(out.ok).toBe(true);
    expect((out.data as { removed: boolean; by: string }).removed).toBe(true);
    expect((out.data as { by: string }).by).toBe('taskId');
  });

  it('lookup by task returns the binding or null', async () => {
    const { service, bindingRepo } = makeDeps(['T-1']);
    runThreadBindCommand(
      { bindingService: service, bindingRepo },
      { subcommand: 'bind', threadKey: 'mx_a0000000000000001', taskId: 'T-1' },
    );
    const out = await runThreadBindCommand(
      { bindingService: service, bindingRepo },
      { subcommand: 'lookup', lookupTaskId: 'T-1' },
    );
    expect(out.ok).toBe(true);
    expect((out.data as { threadKey: string } | null)?.threadKey).toBe('mx_a0000000000000001');
  });

  it('list returns all bindings', async () => {
    const { service, bindingRepo } = makeDeps(['T-1', 'T-2']);
    runThreadBindCommand(
      { bindingService: service, bindingRepo },
      { subcommand: 'bind', threadKey: 'mx_a0000000000000001', taskId: 'T-1' },
    );
    runThreadBindCommand(
      { bindingService: service, bindingRepo },
      { subcommand: 'bind', threadKey: 'mx_b0000000000000001', taskId: 'T-2' },
    );
    const out = await runThreadBindCommand(
      { bindingService: service, bindingRepo },
      { subcommand: 'list' },
    );
    expect(out.ok).toBe(true);
    expect((out.data as readonly unknown[]).length).toBe(2);
  });

  it('rejects unknown subcommand', async () => {
    const { service, bindingRepo } = makeDeps([]);
    const out = await runThreadBindCommand(
      { bindingService: service, bindingRepo },
      { subcommand: 'unknown' as 'bind' },
    );
    expect(out.ok).toBe(false);
    expect(out.error).toMatch(/unknown subcommand/i);
  });
});