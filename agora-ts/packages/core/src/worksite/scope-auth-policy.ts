/**
 * scope-auth-policy.ts — Phase 3.5-3a (R-H / T-2) derive policy.
 *
 * Pure function. Given a TaskRecord, derive a default ScopeAuthorization
 * for Phase 1 sandbox use. Phase 2 will fold in matrix ACL / dashboard
 * approval hooks via composition root injection.
 *
 * §1 compliance: this module knows nothing about matrix, discord, or any
 * platform. It only consumes the Core TaskRecord shape.
 */

import type { TaskRecord } from '@agora-ts/contracts';
import type { Permission, ScopeAuthorization } from './types.js';
import { formatWorksiteUri } from './uri.js';

const DEFAULT_PERMISSIONS: readonly Permission[] = Object.freeze(['read', 'execute']);
const DEFAULT_POSTURE = 'Auto';

/**
 * Derive the default Phase 1 scope authorization for a Task work site.
 *
 * Phase 1 policy (sandbox-only, deliberately conservative):
 *   - scope = agora://task/<id> — worksite URI
 *   - posture = Auto — borrow decides without human confirmation by default
 *   - permissions = [read, execute] — no write/delete until Phase 2 ACL lands
 *
 * Phase 2 will replace this with a real ACL lookup (matrix ACL, dashboard
 * approval, etc.) via composition root injection. The signature stays the same.
 */
export function deriveScopeAuthorization(task: TaskRecord): ScopeAuthorization {
  return Object.freeze({
    scope: formatWorksiteUri('task', task.id),
    posture: DEFAULT_POSTURE,
    permissions: DEFAULT_PERMISSIONS,
  });
}