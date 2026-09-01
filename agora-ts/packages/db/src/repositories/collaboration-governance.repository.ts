import {
  collaborationPlanSchema,
  collaborationRequirementSchema,
  delegationAuthoritySchema,
  subTaskSpecSchema,
  type CollaborationPlanDto,
  type CollaborationRequirementDto,
  type DelegationAuthorityDto,
  type ICollaborationPlanRepository,
  type ICollaborationRequirementRepository,
  type IDelegationAuthorityRepository,
  type ISubTaskSpecRepository,
  type SubTaskSpecDto,
} from '@agora-ts/contracts';
import type { AgoraDatabase } from '../database.js';
import { parseJsonValue, stringifyJsonValue } from './json.js';

type Row = Record<string, unknown>;

export class CollaborationRequirementRepository implements ICollaborationRequirementRepository {
  constructor(private readonly db: AgoraDatabase) {}

  insert(record: CollaborationRequirementDto): CollaborationRequirementDto {
    this.db.prepare(`
      INSERT INTO collaboration_requirements (
        id, task_id, task_revision_id, task_revision_digest, mode, min_agents, max_agents,
        required_roles, required_capabilities, quorum, reviewer_required, information_domains,
        created_by, requirement_digest, status, idempotency_key, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      record.id,
      record.task_id,
      record.task_revision_id,
      record.task_revision_digest,
      record.mode,
      record.min_agents,
      record.max_agents,
      stringifyJsonValue(record.required_roles),
      stringifyJsonValue(record.required_capabilities),
      record.quorum,
      record.reviewer_required ? 1 : 0,
      stringifyJsonValue(record.information_domains),
      record.created_by,
      record.requirement_digest,
      record.status,
      record.idempotency_key,
      record.created_at,
    );
    return this.getById(record.id) as CollaborationRequirementDto;
  }

  getById(id: string): CollaborationRequirementDto | null {
    const row = this.db.prepare('SELECT * FROM collaboration_requirements WHERE id = ?').get(id) as Row | undefined;
    return row ? parseRequirement(row) : null;
  }

  getByIdempotencyKey(key: string): CollaborationRequirementDto | null {
    const row = this.db.prepare('SELECT * FROM collaboration_requirements WHERE idempotency_key = ?').get(key) as Row | undefined;
    return row ? parseRequirement(row) : null;
  }

  listByTask(taskId: string): CollaborationRequirementDto[] {
    const rows = this.db.prepare(`
      SELECT * FROM collaboration_requirements WHERE task_id = ? ORDER BY created_at DESC, id DESC
    `).all(taskId) as Row[];
    return rows.map(parseRequirement);
  }
}

export class SubTaskSpecRepository implements ISubTaskSpecRepository {
  constructor(private readonly db: AgoraDatabase) {}

  insert(record: SubTaskSpecDto): SubTaskSpecDto {
    this.db.prepare(`
      INSERT INTO subtask_specs (
        id, task_id, requirement_id, ordinal, parent_spec_id, title, objective,
        acceptance_criteria, dependency_spec_ids, required_capabilities, preferred_role,
        assignee_ref, information_domain, created_by, spec_digest, status, idempotency_key, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      record.id,
      record.task_id,
      record.requirement_id,
      record.ordinal,
      record.parent_spec_id,
      record.title,
      record.objective,
      stringifyJsonValue(record.acceptance_criteria),
      stringifyJsonValue(record.dependency_spec_ids),
      stringifyJsonValue(record.required_capabilities),
      record.preferred_role,
      record.assignee_ref,
      record.information_domain,
      record.created_by,
      record.spec_digest,
      record.status,
      record.idempotency_key,
      record.created_at,
    );
    return this.getById(record.id) as SubTaskSpecDto;
  }

  getById(id: string): SubTaskSpecDto | null {
    const row = this.db.prepare('SELECT * FROM subtask_specs WHERE id = ?').get(id) as Row | undefined;
    return row ? parseSpec(row) : null;
  }

  getByIdempotencyKey(key: string): SubTaskSpecDto | null {
    const row = this.db.prepare('SELECT * FROM subtask_specs WHERE idempotency_key = ?').get(key) as Row | undefined;
    return row ? parseSpec(row) : null;
  }

  listByTask(taskId: string): SubTaskSpecDto[] {
    const rows = this.db.prepare(`
      SELECT * FROM subtask_specs WHERE task_id = ? ORDER BY ordinal ASC, created_at ASC, id ASC
    `).all(taskId) as Row[];
    return rows.map(parseSpec);
  }

  listByRequirement(requirementId: string): SubTaskSpecDto[] {
    const rows = this.db.prepare(`
      SELECT * FROM subtask_specs WHERE requirement_id = ? ORDER BY ordinal ASC, created_at ASC, id ASC
    `).all(requirementId) as Row[];
    return rows.map(parseSpec);
  }
}

export class DelegationAuthorityRepository implements IDelegationAuthorityRepository {
  constructor(private readonly db: AgoraDatabase) {}

  insert(record: DelegationAuthorityDto): DelegationAuthorityDto {
    this.db.prepare(`
      INSERT INTO delegation_authorities (
        id, task_id, requirement_id, scope, subtask_spec_id, delegator_ref, delegate_ref,
        allowed_actions, max_delegation_depth, expires_at, created_by, authority_digest,
        status, idempotency_key, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      record.id,
      record.task_id,
      record.requirement_id,
      record.scope,
      record.subtask_spec_id,
      record.delegator_ref,
      record.delegate_ref,
      stringifyJsonValue(record.allowed_actions),
      record.max_delegation_depth,
      record.expires_at,
      record.created_by,
      record.authority_digest,
      record.status,
      record.idempotency_key,
      record.created_at,
    );
    return this.getById(record.id) as DelegationAuthorityDto;
  }

  getById(id: string): DelegationAuthorityDto | null {
    const row = this.db.prepare('SELECT * FROM delegation_authorities WHERE id = ?').get(id) as Row | undefined;
    return row ? parseAuthority(row) : null;
  }

  getByIdempotencyKey(key: string): DelegationAuthorityDto | null {
    const row = this.db.prepare('SELECT * FROM delegation_authorities WHERE idempotency_key = ?').get(key) as Row | undefined;
    return row ? parseAuthority(row) : null;
  }

  listByTask(taskId: string): DelegationAuthorityDto[] {
    const rows = this.db.prepare(`
      SELECT * FROM delegation_authorities WHERE task_id = ? ORDER BY created_at DESC, id DESC
    `).all(taskId) as Row[];
    return rows.map(parseAuthority);
  }

  listByRequirement(requirementId: string): DelegationAuthorityDto[] {
    const rows = this.db.prepare(`
      SELECT * FROM delegation_authorities WHERE requirement_id = ? ORDER BY created_at DESC, id DESC
    `).all(requirementId) as Row[];
    return rows.map(parseAuthority);
  }
}

export class CollaborationPlanRepository implements ICollaborationPlanRepository {
  constructor(private readonly db: AgoraDatabase) {}

  insert(record: CollaborationPlanDto): CollaborationPlanDto {
    this.db.prepare(`
      INSERT INTO collaboration_plans (
        id, task_id, requirement_id, task_revision_id, task_revision_digest,
        subtask_spec_ids, delegation_authority_ids, coordination_run_ref, plan_digest,
        status, created_by, idempotency_key, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      record.id,
      record.task_id,
      record.requirement_id,
      record.task_revision_id,
      record.task_revision_digest,
      stringifyJsonValue(record.subtask_spec_ids),
      stringifyJsonValue(record.delegation_authority_ids),
      record.coordination_run_ref,
      record.plan_digest,
      record.status,
      record.created_by,
      record.idempotency_key,
      record.created_at,
    );
    return this.getById(record.id) as CollaborationPlanDto;
  }

  getById(id: string): CollaborationPlanDto | null {
    const row = this.db.prepare('SELECT * FROM collaboration_plans WHERE id = ?').get(id) as Row | undefined;
    return row ? parsePlan(row) : null;
  }

  getByIdempotencyKey(key: string): CollaborationPlanDto | null {
    const row = this.db.prepare('SELECT * FROM collaboration_plans WHERE idempotency_key = ?').get(key) as Row | undefined;
    return row ? parsePlan(row) : null;
  }

  listByTask(taskId: string): CollaborationPlanDto[] {
    const rows = this.db.prepare(`
      SELECT * FROM collaboration_plans WHERE task_id = ? ORDER BY created_at DESC, id DESC
    `).all(taskId) as Row[];
    return rows.map(parsePlan);
  }

  listByRequirement(requirementId: string): CollaborationPlanDto[] {
    const rows = this.db.prepare(`
      SELECT * FROM collaboration_plans WHERE requirement_id = ? ORDER BY created_at DESC, id DESC
    `).all(requirementId) as Row[];
    return rows.map(parsePlan);
  }
}

function parseRequirement(row: Row): CollaborationRequirementDto {
  return collaborationRequirementSchema.parse({
    id: String(row.id),
    task_id: String(row.task_id),
    task_revision_id: String(row.task_revision_id),
    task_revision_digest: String(row.task_revision_digest),
    mode: String(row.mode),
    min_agents: Number(row.min_agents),
    max_agents: Number(row.max_agents),
    required_roles: parseJsonValue(row.required_roles, []),
    required_capabilities: parseJsonValue(row.required_capabilities, []),
    quorum: Number(row.quorum),
    reviewer_required: Number(row.reviewer_required) === 1,
    information_domains: parseJsonValue(row.information_domains, []),
    created_by: String(row.created_by),
    requirement_digest: String(row.requirement_digest),
    status: String(row.status),
    idempotency_key: String(row.idempotency_key),
    created_at: String(row.created_at),
  });
}

function parseSpec(row: Row): SubTaskSpecDto {
  return subTaskSpecSchema.parse({
    id: String(row.id),
    task_id: String(row.task_id),
    requirement_id: String(row.requirement_id),
    ordinal: Number(row.ordinal),
    parent_spec_id: row.parent_spec_id === null ? null : String(row.parent_spec_id),
    title: String(row.title),
    objective: String(row.objective),
    acceptance_criteria: parseJsonValue(row.acceptance_criteria, []),
    dependency_spec_ids: parseJsonValue(row.dependency_spec_ids, []),
    required_capabilities: parseJsonValue(row.required_capabilities, []),
    preferred_role: row.preferred_role === null ? null : String(row.preferred_role),
    assignee_ref: row.assignee_ref === null ? null : String(row.assignee_ref),
    information_domain: String(row.information_domain),
    created_by: String(row.created_by),
    spec_digest: String(row.spec_digest),
    status: String(row.status),
    idempotency_key: String(row.idempotency_key),
    created_at: String(row.created_at),
  });
}

function parseAuthority(row: Row): DelegationAuthorityDto {
  return delegationAuthoritySchema.parse({
    id: String(row.id),
    task_id: String(row.task_id),
    requirement_id: String(row.requirement_id),
    scope: String(row.scope),
    subtask_spec_id: row.subtask_spec_id === null ? null : String(row.subtask_spec_id),
    delegator_ref: String(row.delegator_ref),
    delegate_ref: String(row.delegate_ref),
    allowed_actions: parseJsonValue(row.allowed_actions, []),
    max_delegation_depth: Number(row.max_delegation_depth),
    expires_at: row.expires_at === null ? null : String(row.expires_at),
    created_by: String(row.created_by),
    authority_digest: String(row.authority_digest),
    status: String(row.status),
    idempotency_key: String(row.idempotency_key),
    created_at: String(row.created_at),
  });
}

function parsePlan(row: Row): CollaborationPlanDto {
  return collaborationPlanSchema.parse({
    id: String(row.id),
    task_id: String(row.task_id),
    requirement_id: String(row.requirement_id),
    task_revision_id: String(row.task_revision_id),
    task_revision_digest: String(row.task_revision_digest),
    subtask_spec_ids: parseJsonValue(row.subtask_spec_ids, []),
    delegation_authority_ids: parseJsonValue(row.delegation_authority_ids, []),
    coordination_run_ref: row.coordination_run_ref === null ? null : String(row.coordination_run_ref),
    plan_digest: String(row.plan_digest),
    status: String(row.status),
    created_by: String(row.created_by),
    idempotency_key: String(row.idempotency_key),
    created_at: String(row.created_at),
  });
}
