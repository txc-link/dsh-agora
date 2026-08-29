/**
 * scope-auth-policy.test.ts — Phase 3.5-3a (R-H / T-2) derive policy.
 *
 * Pure function: given a TaskRecord, derive a default ScopeAuthorization
 * for Phase 1 sandbox use. Phase 2 will fold in matrix ACL / dashboard
 * approval; for now we only populate a safe read+execute+auto default.
 */

import { describe, expect, it } from 'vitest';
import { deriveScopeAuthorization } from './scope-auth-policy.js';
import type { TaskRecord } from '@agora-ts/contracts';

function makeTask(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: 'T-1',
    version: 1,
    title: 'demo',
    description: null,
    type: 'oneoff',
    priority: 'normal',
    creator: 'user:txc-link',
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
    ...overrides,
  };
}

describe('deriveScopeAuthorization', () => {
  it('returns scope = agora://task/<id>', () => {
    const auth = deriveScopeAuthorization(makeTask({ id: 'T-42' }));
    expect(auth.scope).toBe('agora://task/T-42');
  });

  it('default posture is Auto', () => {
    const auth = deriveScopeAuthorization(makeTask());
    expect(auth.posture).toBe('Auto');
  });

  it('default permissions are read + execute (no write/delete in Phase 1)', () => {
    const auth = deriveScopeAuthorization(makeTask());
    expect([...auth.permissions].sort()).toEqual(['execute', 'read']);
  });

  it('returns a frozen object', () => {
    const auth = deriveScopeAuthorization(makeTask());
    expect(Object.isFrozen(auth)).toBe(true);
    expect(Object.isFrozen(auth.permissions)).toBe(true);
  });
});