import { createHash, randomUUID } from 'node:crypto';
import {
  collaborationPlanSchema,
  collaborationRequirementSchema,
  createCollaborationPlanRequestSchema,
  createCollaborationRequirementRequestSchema,
  createDelegationAuthorityRequestSchema,
  createSubTaskSpecRequestSchema,
  delegationAuthoritySchema,
  subTaskSpecSchema,
  type CollaborationPlanRecord,
  type CollaborationRequirementRecord,
  type CreateCollaborationPlanRequestDto,
  type CreateCollaborationRequirementRequestDto,
  type CreateDelegationAuthorityRequestDto,
  type CreateSubTaskSpecRequestDto,
  type DelegationAuthorityRecord,
  type ICollaborationPlanRepository,
  type ICollaborationRequirementRepository,
  type IDelegationAuthorityRepository,
  type ISubTaskSpecRepository,
  type SubTaskSpecRecord,
} from '@agora-ts/contracts';
import { ConflictError, NotFoundError } from './errors.js';

export interface CollaborationGovernanceServiceOptions {
  requirements: ICollaborationRequirementRepository;
  specs: ISubTaskSpecRepository;
  authorities: IDelegationAuthorityRepository;
  plans: ICollaborationPlanRepository;
  now?: () => Date;
  idGenerator?: () => string;
}

/**
 * Persists the provider-neutral collaboration contract consumed by runtime
 * coordinators. It never dispatches an agent or imports a provider adapter.
 */
export class CollaborationGovernanceService {
  private readonly requirements: ICollaborationRequirementRepository;
  private readonly specs: ISubTaskSpecRepository;
  private readonly authorities: IDelegationAuthorityRepository;
  private readonly plans: ICollaborationPlanRepository;
  private readonly now: () => Date;
  private readonly idGenerator: () => string;

  constructor(options: CollaborationGovernanceServiceOptions) {
    this.requirements = options.requirements;
    this.specs = options.specs;
    this.authorities = options.authorities;
    this.plans = options.plans;
    this.now = options.now ?? (() => new Date());
    this.idGenerator = options.idGenerator ?? randomUUID;
  }

  createRequirement(input: CreateCollaborationRequirementRequestDto): CollaborationRequirementRecord {
    const parsed = createCollaborationRequirementRequestSchema.parse(input);
    const requirementDigest = digest(parsed);
    const existing = this.requirements.getByIdempotencyKey(parsed.idempotency_key);
    if (existing) {
      if (existing.requirement_digest !== requirementDigest) {
        throw new ConflictError(`CollaborationRequirement idempotency key ${parsed.idempotency_key} was already used with a different request`);
      }
      return existing;
    }
    const record: CollaborationRequirementRecord = collaborationRequirementSchema.parse({
      ...parsed,
      id: this.idGenerator(),
      requirement_digest: requirementDigest,
      status: 'draft',
      created_at: this.now().toISOString(),
    });
    return this.requirements.insert(record);
  }

  getRequirement(id: string): CollaborationRequirementRecord {
    const record = this.requirements.getById(id);
    if (!record) throw new NotFoundError(`CollaborationRequirement ${id} not found`);
    return record;
  }

  listRequirements(taskId: string): CollaborationRequirementRecord[] {
    return this.requirements.listByTask(taskId);
  }

  createSubTaskSpec(input: CreateSubTaskSpecRequestDto): SubTaskSpecRecord {
    const parsed = createSubTaskSpecRequestSchema.parse(input);
    const requirement = this.getRequirement(parsed.requirement_id);
    if (requirement.task_id !== parsed.task_id) {
      throw new ConflictError(`SubTaskSpec requirement ${parsed.requirement_id} does not belong to task ${parsed.task_id}`);
    }
    if (parsed.parent_spec_id) this.requireSpecBelongsToTask(parsed.parent_spec_id, parsed.task_id, parsed.requirement_id);
    for (const dependencyId of parsed.dependency_spec_ids) {
      if (dependencyId === parsed.parent_spec_id) continue;
      this.requireSpecBelongsToTask(dependencyId, parsed.task_id, parsed.requirement_id);
    }
    const specDigest = digest(parsed);
    const existing = this.specs.getByIdempotencyKey(parsed.idempotency_key);
    if (existing) {
      if (existing.spec_digest !== specDigest) {
        throw new ConflictError(`SubTaskSpec idempotency key ${parsed.idempotency_key} was already used with a different request`);
      }
      return existing;
    }
    const record: SubTaskSpecRecord = subTaskSpecSchema.parse({
      ...parsed,
      id: this.idGenerator(),
      parent_spec_id: parsed.parent_spec_id ?? null,
      preferred_role: parsed.preferred_role ?? null,
      assignee_ref: parsed.assignee_ref ?? null,
      spec_digest: specDigest,
      status: 'draft',
      created_at: this.now().toISOString(),
    });
    return this.specs.insert(record);
  }

  getSubTaskSpec(id: string): SubTaskSpecRecord {
    const record = this.specs.getById(id);
    if (!record) throw new NotFoundError(`SubTaskSpec ${id} not found`);
    return record;
  }

  listSubTaskSpecs(taskId: string): SubTaskSpecRecord[] {
    return this.specs.listByTask(taskId);
  }

  listSubTaskSpecsByRequirement(requirementId: string): SubTaskSpecRecord[] {
    return this.specs.listByRequirement(requirementId);
  }

  grantDelegationAuthority(input: CreateDelegationAuthorityRequestDto): DelegationAuthorityRecord {
    const parsed = createDelegationAuthorityRequestSchema.parse(input);
    const requirement = this.getRequirement(parsed.requirement_id);
    if (requirement.task_id !== parsed.task_id) {
      throw new ConflictError(`DelegationAuthority requirement ${parsed.requirement_id} does not belong to task ${parsed.task_id}`);
    }
    if (parsed.scope === 'subtask') {
      if (!parsed.subtask_spec_id) throw new ConflictError('subtask delegation authority requires subtask_spec_id');
      this.requireSpecBelongsToTask(parsed.subtask_spec_id, parsed.task_id, parsed.requirement_id);
    } else if (parsed.subtask_spec_id) {
      throw new ConflictError('task delegation authority cannot target a subtask spec');
    }
    if (parsed.expires_at && Date.parse(parsed.expires_at) <= this.now().getTime()) {
      throw new ConflictError('DelegationAuthority expires_at must be in the future');
    }
    const authorityDigest = digest(parsed);
    const existing = this.authorities.getByIdempotencyKey(parsed.idempotency_key);
    if (existing) {
      if (existing.authority_digest !== authorityDigest) {
        throw new ConflictError(`DelegationAuthority idempotency key ${parsed.idempotency_key} was already used with a different request`);
      }
      return existing;
    }
    const record: DelegationAuthorityRecord = delegationAuthoritySchema.parse({
      ...parsed,
      id: this.idGenerator(),
      subtask_spec_id: parsed.subtask_spec_id ?? null,
      authority_digest: authorityDigest,
      status: 'active',
      created_at: this.now().toISOString(),
    });
    return this.authorities.insert(record);
  }

  getDelegationAuthority(id: string): DelegationAuthorityRecord {
    const record = this.authorities.getById(id);
    if (!record) throw new NotFoundError(`DelegationAuthority ${id} not found`);
    return record;
  }

  listDelegationAuthorities(taskId: string): DelegationAuthorityRecord[] {
    return this.authorities.listByTask(taskId);
  }

  listDelegationAuthoritiesByRequirement(requirementId: string): DelegationAuthorityRecord[] {
    return this.authorities.listByRequirement(requirementId);
  }

  createPlan(input: CreateCollaborationPlanRequestDto): CollaborationPlanRecord {
    const parsed = createCollaborationPlanRequestSchema.parse(input);
    const requirement = this.getRequirement(parsed.requirement_id);
    if (requirement.task_id !== parsed.task_id) {
      throw new ConflictError(`CollaborationPlan requirement ${parsed.requirement_id} does not belong to task ${parsed.task_id}`);
    }
    if (requirement.task_revision_id !== parsed.task_revision_id || requirement.task_revision_digest !== parsed.task_revision_digest) {
      throw new ConflictError('CollaborationPlan task revision does not match the collaboration requirement');
    }
    if (requirement.status === 'superseded') {
      throw new ConflictError(`CollaborationRequirement ${requirement.id} is superseded`);
    }
    const specIds = new Set<string>();
    for (const specId of parsed.subtask_spec_ids) {
      if (specIds.has(specId)) throw new ConflictError(`CollaborationPlan contains duplicate SubTaskSpec ${specId}`);
      specIds.add(specId);
      this.requireSpecBelongsToTask(specId, parsed.task_id, parsed.requirement_id);
    }
    const authorityIds = new Set<string>();
    for (const authorityId of parsed.delegation_authority_ids) {
      if (authorityIds.has(authorityId)) throw new ConflictError(`CollaborationPlan contains duplicate DelegationAuthority ${authorityId}`);
      authorityIds.add(authorityId);
      const authority = this.getDelegationAuthority(authorityId);
      if (authority.task_id !== parsed.task_id || authority.requirement_id !== parsed.requirement_id) {
        throw new ConflictError(`DelegationAuthority ${authorityId} does not belong to the collaboration requirement`);
      }
      if (authority.status !== 'active') throw new ConflictError(`DelegationAuthority ${authorityId} is ${authority.status}`);
      if (authority.expires_at && Date.parse(authority.expires_at) <= this.now().getTime()) {
        throw new ConflictError(`DelegationAuthority ${authorityId} has expired`);
      }
    }
    const planDigest = digest(parsed);
    const existing = this.plans.getByIdempotencyKey(parsed.idempotency_key);
    if (existing) {
      if (existing.plan_digest !== planDigest) {
        throw new ConflictError(`CollaborationPlan idempotency key ${parsed.idempotency_key} was already used with a different request`);
      }
      return existing;
    }
    const record: CollaborationPlanRecord = collaborationPlanSchema.parse({
      ...parsed,
      id: this.idGenerator(),
      coordination_run_ref: parsed.coordination_run_ref ?? null,
      plan_digest: planDigest,
      status: 'proposed',
      created_at: this.now().toISOString(),
    });
    return this.plans.insert(record);
  }

  getPlan(id: string): CollaborationPlanRecord {
    const record = this.plans.getById(id);
    if (!record) throw new NotFoundError(`CollaborationPlan ${id} not found`);
    return record;
  }

  listPlans(taskId: string): CollaborationPlanRecord[] {
    return this.plans.listByTask(taskId);
  }

  listPlansByRequirement(requirementId: string): CollaborationPlanRecord[] {
    return this.plans.listByRequirement(requirementId);
  }

  private requireSpecBelongsToTask(specId: string, taskId: string, requirementId: string): SubTaskSpecRecord {
    const spec = this.getSubTaskSpec(specId);
    if (spec.task_id !== taskId || spec.requirement_id !== requirementId) {
      throw new ConflictError(`SubTaskSpec ${specId} does not belong to task ${taskId} and requirement ${requirementId}`);
    }
    return spec;
  }
}

function digest(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}
