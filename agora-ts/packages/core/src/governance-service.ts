import { randomUUID } from 'node:crypto';
import {
  actionIntentSchema,
  authorizeInformationProjectionRequestSchema,
  checkConsentRequestSchema,
  classifyInformationRequestSchema,
  createConsentGrantRequestSchema,
  reclassifyInformationRequestSchema,
  type ActionIntentDto,
  type ActionRiskAssessmentRecord,
  type ActionRiskLevelDto,
  type AuthorizationDecisionDto,
  type AuthorizeInformationProjectionRequestDto,
  type CheckConsentRequestDto,
  type ClassifyInformationRequestDto,
  type ConsentGrantRecord,
  type ConsentGrantStatusDto,
  type CreateConsentGrantRequestDto,
  type IActionRiskAssessmentRepository,
  type IConsentGrantRepository,
  type IInformationPolicyRepository,
  type InformationPolicyRecord,
  type ReclassifyInformationRequestDto,
  type SensitivityLevelDto,
} from '@agora-ts/contracts';
import { ConflictError, NotFoundError } from './errors.js';

const SENSITIVITY_RANK: Record<SensitivityLevelDto, number> = {
  public: 0,
  internal: 1,
  personal: 2,
  sensitive_personal: 3,
};

export interface ConsentServiceOptions {
  repository: IConsentGrantRepository;
  now?: () => Date;
  idGenerator?: () => string;
}

export class ConsentService {
  private readonly repository: IConsentGrantRepository;
  private readonly now: () => Date;
  private readonly idGenerator: () => string;

  constructor(options: ConsentServiceOptions) {
    this.repository = options.repository;
    this.now = options.now ?? (() => new Date());
    this.idGenerator = options.idGenerator ?? randomUUID;
  }

  grant(input: CreateConsentGrantRequestDto): ConsentGrantRecord {
    const parsed = createConsentGrantRequestSchema.parse(input);
    if (parsed.max_sensitivity === 'sensitive_personal') {
      if (parsed.basis !== 'explicit') {
        throw new ConflictError('sensitive-personal access requires explicit consent');
      }
      if (!parsed.expires_at) {
        throw new ConflictError('sensitive-personal consent requires an expiry');
      }
    }
    if (parsed.expires_at && Date.parse(parsed.expires_at) <= this.now().getTime()) {
      throw new ConflictError('consent expiry must be in the future');
    }
    return this.repository.insert({
      ...parsed,
      id: this.idGenerator(),
      status: 'active',
      created_at: this.now().toISOString(),
      revoked_at: null,
      revoked_by: null,
    });
  }

  revoke(input: { grant_id: string; revoked_by: string }): ConsentGrantRecord {
    const current = this.repository.getById(input.grant_id);
    if (!current) throw new NotFoundError(`consent grant not found: ${input.grant_id}`);
    if (current.status !== 'active') throw new ConflictError(`consent grant is already ${current.status}: ${input.grant_id}`);
    const revoked = this.repository.revoke(input.grant_id, this.now().toISOString(), input.revoked_by);
    if (!revoked) throw new ConflictError(`consent grant could not be revoked: ${input.grant_id}`);
    return revoked;
  }

  list(filters: { grantor_ref?: string; grantee_ref?: string; status?: ConsentGrantStatusDto } = {}) {
    return this.repository.list(filters);
  }

  check(input: CheckConsentRequestDto): AuthorizationDecisionDto {
    const parsed = checkConsentRequestSchema.parse(input);
    const now = this.now().getTime();
    const grant = this.repository.list({
      grantor_ref: parsed.grantor_ref,
      grantee_ref: parsed.grantee_ref,
      status: 'active',
    }).find((candidate) => {
      if (candidate.expires_at && Date.parse(candidate.expires_at) <= now) return false;
      if (!resourcePatternMatches(candidate.resource_pattern, parsed.resource_ref)) return false;
      if (candidate.source_domain !== parsed.source_domain || candidate.target_domain !== parsed.target_domain) return false;
      if (candidate.purpose !== parsed.purpose || !candidate.permissions.includes(parsed.permission)) return false;
      if (SENSITIVITY_RANK[parsed.sensitivity] > SENSITIVITY_RANK[candidate.max_sensitivity]) return false;
      return parsed.requested_fields.every((field) => candidate.allowed_fields.includes(field));
    });
    return grant
      ? { allowed: true, reason: 'explicit consent grant matched', grant_id: grant.id }
      : { allowed: false, reason: 'no matching active consent grant', grant_id: null };
  }
}

function resourcePatternMatches(pattern: string, resourceRef: string): boolean {
  if (pattern === resourceRef) return true;
  if (!pattern.endsWith('/*')) return false;
  return resourceRef.startsWith(pattern.slice(0, -1));
}

export interface InformationGovernanceServiceOptions {
  repository: IInformationPolicyRepository;
  consent: ConsentService;
  now?: () => Date;
}

export class InformationGovernanceService {
  private readonly repository: IInformationPolicyRepository;
  private readonly consent: ConsentService;
  private readonly now: () => Date;

  constructor(options: InformationGovernanceServiceOptions) {
    this.repository = options.repository;
    this.consent = options.consent;
    this.now = options.now ?? (() => new Date());
  }

  classify(input: ClassifyInformationRequestDto): InformationPolicyRecord {
    const parsed = classifyInformationRequestSchema.parse(input);
    if (this.repository.getCurrent(parsed.resource_ref)) {
      throw new ConflictError(`information policy already exists: ${parsed.resource_ref}`);
    }
    return this.repository.insert({
      ...parsed,
      version: 1,
      change_note: parsed.change_note ?? null,
      created_at: this.now().toISOString(),
    });
  }

  reclassify(input: ReclassifyInformationRequestDto): InformationPolicyRecord {
    const parsed = reclassifyInformationRequestSchema.parse(input);
    const current = this.require(parsed.resource_ref);
    if (current.version !== parsed.expected_current_version) {
      throw new ConflictError(
        `information policy version conflict: expected ${parsed.expected_current_version}, current ${current.version}`,
      );
    }
    const appended = this.repository.append({
      resource_ref: current.resource_ref,
      version: current.version + 1,
      owner_ref: current.owner_ref,
      domain: parsed.domain ?? current.domain,
      sensitivity: parsed.sensitivity,
      sharing_mode: parsed.sharing_mode,
      allowed_purposes: parsed.allowed_purposes,
      retention_until: parsed.retention_until,
      created_by: parsed.created_by,
      change_note: parsed.change_note ?? null,
      created_at: this.now().toISOString(),
    }, parsed.expected_current_version);
    if (!appended) throw new ConflictError(`information policy version conflict: ${parsed.resource_ref}`);
    return appended;
  }

  require(resourceRef: string, version?: number): InformationPolicyRecord {
    const record = version === undefined
      ? this.repository.getCurrent(resourceRef)
      : this.repository.getVersion(resourceRef, version);
    if (!record) throw new NotFoundError(`information policy not found: ${resourceRef}${version ? `@${version}` : ''}`);
    return record;
  }

  list(domain?: string) {
    return this.repository.list(domain);
  }

  authorizeProjection(input: AuthorizeInformationProjectionRequestDto): AuthorizationDecisionDto {
    const parsed = authorizeInformationProjectionRequestSchema.parse(input);
    const policy = this.require(parsed.resource_ref);
    if (policy.retention_until && Date.parse(policy.retention_until) <= this.now().getTime()) {
      return { allowed: false, reason: 'information retention period has expired', grant_id: null };
    }
    if (!policy.allowed_purposes.includes(parsed.purpose)) {
      return { allowed: false, reason: 'purpose is not allowed by information policy', grant_id: null };
    }
    if (policy.sharing_mode === 'public') {
      return { allowed: true, reason: 'public information policy', grant_id: null };
    }
    if (policy.sharing_mode === 'same_domain' && parsed.target_domain === policy.domain) {
      return { allowed: true, reason: 'same-domain information policy', grant_id: null };
    }
    if (parsed.actor_ref === policy.owner_ref && parsed.target_domain === policy.domain) {
      return { allowed: true, reason: 'owner access inside source domain', grant_id: null };
    }
    return this.consent.check({
      grantor_ref: policy.owner_ref,
      grantee_ref: parsed.actor_ref,
      resource_ref: parsed.resource_ref,
      source_domain: policy.domain,
      target_domain: parsed.target_domain,
      purpose: parsed.purpose,
      permission: parsed.permission,
      requested_fields: parsed.requested_fields,
      sensitivity: policy.sensitivity,
    });
  }
}

export interface ActionRiskServiceOptions {
  repository: IActionRiskAssessmentRepository;
  now?: () => Date;
  idGenerator?: () => string;
  policyVersion?: string;
}

export class ActionRiskService {
  private readonly repository: IActionRiskAssessmentRepository;
  private readonly now: () => Date;
  private readonly idGenerator: () => string;
  private readonly policyVersion: string;

  constructor(options: ActionRiskServiceOptions) {
    this.repository = options.repository;
    this.now = options.now ?? (() => new Date());
    this.idGenerator = options.idGenerator ?? randomUUID;
    this.policyVersion = options.policyVersion ?? 'strict-personal-v1';
  }

  assess(input: ActionIntentDto): ActionRiskAssessmentRecord {
    const intent = actionIntentSchema.parse(input);
    const reasons: string[] = [];
    let score = 0;
    if (intent.action_kind === 'purchase') { score += 3; reasons.push('payment action'); }
    if (intent.action_kind === 'subscribe') { score += 4; reasons.push('subscription action'); }
    if (intent.action_kind === 'medical') { score += 3; reasons.push('medical action'); }
    if (intent.amount !== undefined) { score += 2; reasons.push('monetary value'); }
    if (intent.recurrence === 'recurring') { score += 3; reasons.push('recurring effect'); }
    if (intent.sensitive_disclosure) { score += 4; reasons.push('sensitive information disclosure'); }
    if (intent.health_impact) { score += 5; reasons.push('health impact'); }
    if (intent.reversibility === 'irreversible') { score += 4; reasons.push('irreversible action'); }
    if (intent.third_party_effect) { score += 1; reasons.push('third-party effect'); }
    if (intent.new_counterparty) { score += 1; reasons.push('new counterparty'); }

    const riskLevel: ActionRiskLevelDto = score >= 8
      ? 'critical'
      : score >= 4
        ? 'high'
        : score >= 2
          ? 'medium'
          : 'low';
    const requiresGate = intent.action_kind === 'purchase'
      || intent.action_kind === 'subscribe'
      || intent.action_kind === 'medical'
      || intent.amount !== undefined
      || intent.recurrence === 'recurring'
      || intent.sensitive_disclosure
      || intent.health_impact
      || intent.reversibility === 'irreversible'
      || intent.third_party_effect;

    return this.repository.insert({
      id: this.idGenerator(),
      intent,
      risk_level: riskLevel,
      decision: requiresGate ? 'require_human_gate' : 'allow',
      reasons,
      policy_version: this.policyVersion,
      created_at: this.now().toISOString(),
    });
  }
}

