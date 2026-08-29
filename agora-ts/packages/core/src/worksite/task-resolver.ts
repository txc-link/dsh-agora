/**
 * TaskWorksiteResolver — the only concrete WorksiteResolver in Phase 1.
 *
 * §1 compliance: This resolver lives in Core. It depends ONLY on the
 * `ITaskRepository` abstraction from `@agora-ts/contracts`. No matrix,
 * no discord, no platform-specific imports. Composition root provides
 * the actual repository implementation.
 */

import type { ITaskRepository, TaskRecord } from '@agora-ts/contracts';

import type { WorksiteResolver } from './resolver.js';
import { deriveScopeAuthorization } from './scope-auth-policy.js';
import { formatWorksiteUri, type WorksiteType } from './uri.js';
import type {
  TaskWorksite,
  WorksiteResolutionContext,
} from './types.js';

export interface TaskWorksiteResolverOptions {
  readonly taskRepository: Pick<ITaskRepository, 'getTask'>;
}

export class TaskWorksiteResolver implements WorksiteResolver {
  public readonly type: WorksiteType = 'task';

  private readonly taskRepository: Pick<ITaskRepository, 'getTask'>;

  public constructor(options: TaskWorksiteResolverOptions) {
    this.taskRepository = options.taskRepository;
  }

  public async resolve(id: string, _ctx: WorksiteResolutionContext): Promise<TaskWorksite | null> {
    const task: TaskRecord | null = this.taskRepository.getTask(id);
    if (!task) {
      return null;
    }
    return toTaskWorksite(task);
  }
}

/**
 * Pure mapper — TaskRecord → TaskWorksite.
 *
 * Phase 1: refs are empty. Future phases can compute refs from task
 * relationships (e.g. parent task, project, linked commits) but those
 * are adapter-side joins and should NOT be implemented in Phase 1.
 *
 * Phase 3.5-3a (R-H / T-2): scopeAuthorization is populated from the
 * task record via deriveScopeAuthorization(). Phase 2 will replace the
 * policy with a real ACL lookup; signature stays the same.
 */
export function toTaskWorksite(task: TaskRecord): TaskWorksite {
  const scopeAuth = deriveScopeAuthorization(task);
  return Object.freeze({
    type: 'task',
    id: task.id,
    uri: formatWorksiteUri('task', task.id),
    refs: Object.freeze([]),
    scopeAuthorization: scopeAuth,
  });
}