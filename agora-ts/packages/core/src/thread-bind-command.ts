/**
 * thread-bind-command.ts — Phase 4 (R-C / T-1.5) CLI 入口.
 *
 * Subcommands: bind | unbind | lookup | list. Plain JSON output. No
 * interactive prompts (the CLI is for agents, not humans; humans use
 * Dashboard or the matrix-connector slash command surface).
 */

import type { IThreadTaskBindingRepository } from '@agora-ts/contracts';
import type { ThreadTaskBindingService } from './thread-task-binding-service.js';

export interface ThreadBindCommandDeps {
  bindingService: ThreadTaskBindingService;
  bindingRepo: IThreadTaskBindingRepository;
}

export type ThreadBindSubcommand = 'bind' | 'unbind' | 'lookup' | 'list';

export interface RunThreadBindCommandOptions {
  subcommand: ThreadBindSubcommand;
  // bind
  threadKey?: string;
  taskId?: string;
  // unbind
  unbindThreadKey?: string;
  unbindTaskId?: string;
  // lookup
  lookupTaskId?: string;
  lookupThreadKey?: string;
}

export interface ThreadBindCommandResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

export async function runThreadBindCommand(
  deps: ThreadBindCommandDeps,
  options: RunThreadBindCommandOptions,
): Promise<ThreadBindCommandResult> {
  switch (options.subcommand) {
    case 'bind':
      return runBind(deps, options);
    case 'unbind':
      return runUnbind(deps, options);
    case 'lookup':
      return runLookup(deps, options);
    case 'list':
      return runList(deps);
    default:
      return { ok: false, error: `unknown subcommand: ${options.subcommand}` };
  }
}

function requireString(value: string | undefined, field: string): string | null {
  if (value === undefined || value === '') {
    return `${field} is required`;
  }
  return null;
}

function runBind(deps: ThreadBindCommandDeps, options: RunThreadBindCommandOptions): ThreadBindCommandResult {
  const threadKeyErr = requireString(options.threadKey, 'threadKey');
  if (threadKeyErr) return { ok: false, error: threadKeyErr };
  const taskIdErr = requireString(options.taskId, 'taskId');
  if (taskIdErr) return { ok: false, error: taskIdErr };
  try {
    const binding = deps.bindingService.bind({ threadKey: options.threadKey!, taskId: options.taskId! });
    return { ok: true, data: binding };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

function runUnbind(deps: ThreadBindCommandDeps, options: RunThreadBindCommandOptions): ThreadBindCommandResult {
  if (options.unbindThreadKey !== undefined && options.unbindThreadKey !== '') {
    const removed = deps.bindingService.unbindByThreadKey(options.unbindThreadKey);
    return { ok: true, data: { removed, by: 'threadKey', key: options.unbindThreadKey } };
  }
  if (options.unbindTaskId !== undefined && options.unbindTaskId !== '') {
    const removed = deps.bindingService.unbindByTask(options.unbindTaskId);
    return { ok: true, data: { removed, by: 'taskId', key: options.unbindTaskId } };
  }
  return { ok: false, error: 'either --thread-key or --task-id is required' };
}

function runLookup(deps: ThreadBindCommandDeps, options: RunThreadBindCommandOptions): ThreadBindCommandResult {
  if (options.lookupTaskId !== undefined && options.lookupTaskId !== '') {
    const binding = deps.bindingService.getByTask(options.lookupTaskId);
    return { ok: true, data: binding ?? null };
  }
  if (options.lookupThreadKey !== undefined && options.lookupThreadKey !== '') {
    const binding = deps.bindingService.getByThreadKey(options.lookupThreadKey);
    return { ok: true, data: binding ?? null };
  }
  return { ok: false, error: 'either --task or --thread is required' };
}

function runList(deps: ThreadBindCommandDeps): ThreadBindCommandResult {
  return { ok: true, data: deps.bindingRepo.list() };
}