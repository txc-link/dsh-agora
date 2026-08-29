/**
 * ThreadTaskBinding type — Phase 4 (R-C / T-1.5) projection binding.
 *
 * Binds an opaque threadKey (matrix room_id, opaque to agora central) to a
 * Task ID. The bridge lives in matrix-connector adapter; agora Core only
 * stores the mapping.
 *
 * §1 compliance: threadKey is opaque to agora Core. agora central never
 * sees matrix room_id. The matrix adapter is responsible for resolving
 * threadKey ↔ room_id on its own side.
 */

export interface ThreadTaskBinding {
  readonly threadKey: string;
  readonly taskId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * ThreadTaskBindingRepository contract.
 *
 * Phase 4 R-C-1: agora Core owns the binding storage. Matrix adapter reads
 * via getByTask / getByThreadKey to project thread state on incoming events.
 *
 * Uniqueness:
 *   - One threadKey maps to at most one task (bind replaces).
 *   - One task maps to at most one threadKey (re-bind replaces).
 *
 * Idempotency:
 *   - Re-binding the same (threadKey, taskId) is a no-op (returns existing).
 *   - Re-binding threadKey to a *different* taskId replaces and returns the
 *     new binding; the previous binding is dropped.
 */
export interface IThreadTaskBindingRepository {
  bind(input: { threadKey: string; taskId: string }): ThreadTaskBinding;
  unbindByThreadKey(threadKey: string): boolean;
  unbindByTask(taskId: string): boolean;
  getByTask(taskId: string): ThreadTaskBinding | undefined;
  getByThreadKey(threadKey: string): ThreadTaskBinding | undefined;
  list(): readonly ThreadTaskBinding[];
}