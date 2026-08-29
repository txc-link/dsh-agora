/**
 * ThreadTaskBindingService — Phase 4 (R-C / T-1.5) projection binding service.
 *
 * §1 compliance: pure Core service, no platform names. The threadKey
 * format is opaque to agora central; composition root provides the
 * pattern (default: mx_<16hex> from matrix adapter). The service only
 * stores and queries the binding.
 *
 * §1.5 shortest path: the binding is just (threadKey, taskId). Projecting
 * Task state onto the thread (e.g. updating room name/topic) belongs to
 * the matrix adapter (R-C-2), not Core.
 */

import type {
  IThreadTaskBindingRepository,
  ThreadTaskBinding,
} from '@agora-ts/contracts';
import type { ITaskRepository } from '@agora-ts/contracts';

export interface ThreadTaskBindingServiceOptions {
  readonly repo: IThreadTaskBindingRepository;
  readonly taskRepo: Pick<ITaskRepository, 'getTask'>;
  /**
   * Pattern the threadKey must match. Default accepts any non-empty string
   * (matrix adapter enforces mx_<16hex>). Composition root can override.
   */
  readonly threadKeyPattern?: RegExp;
}

const DEFAULT_PATTERN = /^.+$/u;

export class ThreadTaskBindingNotFoundError extends Error {
  public readonly kind: 'threadKey' | 'task';
  public readonly key: string;
  public constructor(kind: 'threadKey' | 'task', key: string) {
    super(`ThreadTaskBinding not found by ${kind}: ${key}`);
    this.name = 'ThreadTaskBindingNotFoundError';
    this.kind = kind;
    this.key = key;
  }
}

export class ThreadTaskBindingService {
  private readonly repo: IThreadTaskBindingRepository;
  private readonly taskRepo: Pick<ITaskRepository, 'getTask'>;
  private readonly threadKeyPattern: RegExp;

  public constructor(options: ThreadTaskBindingServiceOptions) {
    this.repo = options.repo;
    this.taskRepo = options.taskRepo;
    this.threadKeyPattern = options.threadKeyPattern ?? DEFAULT_PATTERN;
  }

  public bind(input: { threadKey: string; taskId: string }): ThreadTaskBinding {
    if (typeof input.threadKey !== 'string' || input.threadKey.length === 0) {
      throw new Error('threadKey must be a non-empty string');
    }
    if (!this.threadKeyPattern.test(input.threadKey)) {
      throw new Error(`threadKey does not match required pattern: ${input.threadKey}`);
    }
    if (typeof input.taskId !== 'string' || input.taskId.length === 0) {
      throw new Error('taskId must be a non-empty string');
    }
    const task = this.taskRepo.getTask(input.taskId);
    if (!task) {
      throw new Error(`task not found: ${input.taskId}`);
    }
    return this.repo.bind(input);
  }

  public unbindByThreadKey(threadKey: string): boolean {
    return this.repo.unbindByThreadKey(threadKey);
  }

  public unbindByTask(taskId: string): boolean {
    return this.repo.unbindByTask(taskId);
  }

  public getByTask(taskId: string): ThreadTaskBinding | undefined {
    return this.repo.getByTask(taskId);
  }

  public getByThreadKey(threadKey: string): ThreadTaskBinding | undefined {
    return this.repo.getByThreadKey(threadKey);
  }

  public list(): readonly ThreadTaskBinding[] {
    return this.repo.list();
  }
}