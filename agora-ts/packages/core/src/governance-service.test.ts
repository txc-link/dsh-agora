import { describe, expect, it } from 'vitest';
import type {
  ActionRiskAssessmentRecord,
  ConsentGrantRecord,
  ConsentGrantStatusDto,
  IActionRiskAssessmentRepository,
  IConsentGrantRepository,
  IInformationPolicyRepository,
  InformationPolicyRecord,
} from '@agora-ts/contracts';
import {
  ActionRiskService,
  ConsentService,
  InformationGovernanceService,
} from './governance-service.js';

class MemoryInformationPolicyRepository implements IInformationPolicyRepository {
  readonly records: InformationPolicyRecord[] = [];

  insert(record: InformationPolicyRecord): InformationPolicyRecord {
    this.records.push(structuredClone(record));
    return structuredClone(record);
  }

  getCurrent(resourceRef: string): InformationPolicyRecord | null {
    const records = this.records.filter((record) => record.resource_ref === resourceRef);
    const found = records.sort((a, b) => b.version - a.version)[0];
    return found ? structuredClone(found) : null;
  }

  getVersion(resourceRef: string, version: number): InformationPolicyRecord | null {
    const found = this.records.find((record) => record.resource_ref === resourceRef && record.version === version);
    return found ? structuredClone(found) : null;
  }

  append(record: InformationPolicyRecord, expectedCurrentVersion: number): InformationPolicyRecord | null {
    const current = this.getCurrent(record.resource_ref);
    if (!current || current.version !== expectedCurrentVersion) return null;
    return this.insert(record);
  }

  list(domain?: string): InformationPolicyRecord[] {
    return this.records
      .filter((record) => domain === undefined || record.domain === domain)
      .map((record) => structuredClone(record));
  }
}

class MemoryConsentGrantRepository implements IConsentGrantRepository {
  readonly records: ConsentGrantRecord[] = [];

  insert(record: ConsentGrantRecord): ConsentGrantRecord {
    this.records.push(structuredClone(record));
    return structuredClone(record);
  }

  getById(id: string): ConsentGrantRecord | null {
    const found = this.records.find((record) => record.id === id);
    return found ? structuredClone(found) : null;
  }

  list(filters: { grantor_ref?: string; grantee_ref?: string; status?: ConsentGrantStatusDto } = {}): ConsentGrantRecord[] {
    return this.records
      .filter((record) => filters.grantor_ref === undefined || record.grantor_ref === filters.grantor_ref)
      .filter((record) => filters.grantee_ref === undefined || record.grantee_ref === filters.grantee_ref)
      .filter((record) => filters.status === undefined || record.status === filters.status)
      .map((record) => structuredClone(record));
  }

  revoke(id: string, revokedAt: string, revokedBy: string): ConsentGrantRecord | null {
    const found = this.records.find((record) => record.id === id);
    if (!found || found.status !== 'active') return null;
    found.status = 'revoked';
    found.revoked_at = revokedAt;
    found.revoked_by = revokedBy;
    return structuredClone(found);
  }
}

class MemoryActionRiskAssessmentRepository implements IActionRiskAssessmentRepository {
  readonly records: ActionRiskAssessmentRecord[] = [];

  insert(record: ActionRiskAssessmentRecord): ActionRiskAssessmentRecord {
    this.records.push(structuredClone(record));
    return structuredClone(record);
  }

  getById(id: string): ActionRiskAssessmentRecord | null {
    const found = this.records.find((record) => record.id === id);
    return found ? structuredClone(found) : null;
  }

  listBySubject(subjectRef: string): ActionRiskAssessmentRecord[] {
    return this.records.filter((record) => record.intent.subject_ref === subjectRef).map((record) => structuredClone(record));
  }
}

function makeGovernance() {
  const informationRepository = new MemoryInformationPolicyRepository();
  const consentRepository = new MemoryConsentGrantRepository();
  const riskRepository = new MemoryActionRiskAssessmentRepository();
  let id = 0;
  const now = () => new Date('2026-08-30T12:00:00.000Z');
  const consent = new ConsentService({
    repository: consentRepository,
    now,
    idGenerator: () => `grant-${++id}`,
  });
  const information = new InformationGovernanceService({
    repository: informationRepository,
    consent,
    now,
  });
  const risk = new ActionRiskService({
    repository: riskRepository,
    now,
    idGenerator: () => `risk-${++id}`,
  });
  return { information, consent, risk, informationRepository, consentRepository, riskRepository };
}

describe('information governance and consent', () => {
  it('keeps sensitive personal data out of the work domain without explicit consent', () => {
    const { information } = makeGovernance();
    information.classify({
      resource_ref: 'vault:health/report-2026',
      owner_ref: 'human:ceo',
      domain: 'health',
      sensitivity: 'sensitive_personal',
      sharing_mode: 'explicit_consent_only',
      allowed_purposes: ['health_management'],
      retention_until: '2027-08-30T00:00:00.000Z',
      created_by: 'human:ceo',
    });

    const decision = information.authorizeProjection({
      resource_ref: 'vault:health/report-2026',
      actor_ref: 'agent:work-researcher',
      target_domain: 'work',
      purpose: 'health_management',
      permission: 'read',
      requested_fields: ['summary'],
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/consent/i);
  });

  it('allows only the explicitly granted purpose, target domain, permission and fields', () => {
    const { information, consent } = makeGovernance();
    information.classify({
      resource_ref: 'vault:life/trip-hangzhou', owner_ref: 'human:ceo', domain: 'life',
      sensitivity: 'personal', sharing_mode: 'explicit_consent_only',
      allowed_purposes: ['trip_planning'], retention_until: '2026-10-01T00:00:00.000Z',
      created_by: 'human:ceo',
    });
    const grant = consent.grant({
      grantor_ref: 'human:ceo', grantee_ref: 'agent:travel-worker',
      resource_pattern: 'vault:life/*', source_domain: 'life', target_domain: 'personal-office',
      purpose: 'trip_planning', permissions: ['read', 'derive'],
      allowed_fields: ['budget_band', 'dietary_constraints'], max_sensitivity: 'personal',
      basis: 'explicit', expires_at: '2026-09-10T00:00:00.000Z', evidence_ref: 'decision:trip-42',
    });

    const allowed = information.authorizeProjection({
      resource_ref: 'vault:life/trip-hangzhou', actor_ref: 'agent:travel-worker',
      target_domain: 'personal-office', purpose: 'trip_planning', permission: 'read',
      requested_fields: ['budget_band'],
    });
    expect(allowed).toMatchObject({ allowed: true, grant_id: grant.id });

    const deniedField = information.authorizeProjection({
      resource_ref: 'vault:life/trip-hangzhou', actor_ref: 'agent:travel-worker',
      target_domain: 'personal-office', purpose: 'trip_planning', permission: 'read',
      requested_fields: ['exact_home_address'],
    });
    expect(deniedField.allowed).toBe(false);

    const deniedDomain = information.authorizeProjection({
      resource_ref: 'vault:life/trip-hangzhou', actor_ref: 'agent:travel-worker',
      target_domain: 'work', purpose: 'trip_planning', permission: 'read',
      requested_fields: ['budget_band'],
    });
    expect(deniedDomain.allowed).toBe(false);
  });

  it('requires explicit, expiring consent for sensitive-personal access and honors revocation', () => {
    const { consent } = makeGovernance();
    expect(() => consent.grant({
      grantor_ref: 'human:ceo', grantee_ref: 'agent:health-steward', resource_pattern: 'vault:health/*',
      source_domain: 'health', target_domain: 'personal-office', purpose: 'health_management',
      permissions: ['read'], allowed_fields: ['summary'], max_sensitivity: 'sensitive_personal',
      basis: 'contract', expires_at: null, evidence_ref: 'contract:x',
    })).toThrow(/explicit/i);

    const grant = consent.grant({
      grantor_ref: 'human:ceo', grantee_ref: 'agent:health-steward', resource_pattern: 'vault:health/*',
      source_domain: 'health', target_domain: 'personal-office', purpose: 'health_management',
      permissions: ['read'], allowed_fields: ['summary'], max_sensitivity: 'sensitive_personal',
      basis: 'explicit', expires_at: '2026-09-30T00:00:00.000Z', evidence_ref: 'decision:health-1',
    });
    expect(consent.revoke({ grant_id: grant.id, revoked_by: 'human:ceo' }).status).toBe('revoked');
    expect(consent.check({
      grantor_ref: 'human:ceo', grantee_ref: 'agent:health-steward', resource_ref: 'vault:health/a',
      source_domain: 'health', target_domain: 'personal-office', purpose: 'health_management',
      permission: 'read', requested_fields: ['summary'], sensitivity: 'sensitive_personal',
    }).allowed).toBe(false);
  });

  it('reclassifies with immutable policy history and optimistic version checks', () => {
    const { information, informationRepository } = makeGovernance();
    information.classify({
      resource_ref: 'artifact:salary', owner_ref: 'org:acme', domain: 'work', sensitivity: 'internal',
      sharing_mode: 'same_domain', allowed_purposes: ['payroll'], retention_until: null,
      created_by: 'human:ceo',
    });
    information.reclassify({
      resource_ref: 'artifact:salary', expected_current_version: 1, sensitivity: 'sensitive_personal',
      sharing_mode: 'explicit_consent_only', allowed_purposes: ['payroll'], retention_until: '2027-08-30T00:00:00.000Z',
      created_by: 'human:ceo', change_note: 'contains bank account details',
    });
    expect(informationRepository.getVersion('artifact:salary', 1)?.sensitivity).toBe('internal');
    expect(informationRepository.getCurrent('artifact:salary')?.version).toBe(2);
    expect(() => information.reclassify({
      resource_ref: 'artifact:salary', expected_current_version: 1, sensitivity: 'personal',
      sharing_mode: 'explicit_consent_only', allowed_purposes: ['payroll'], retention_until: null,
      created_by: 'human:ceo',
    })).toThrow(/version conflict/);
  });
});

describe('action risk', () => {
  it('allows a reversible non-sensitive message but records the assessment', () => {
    const { risk, riskRepository } = makeGovernance();
    const result = risk.assess({
      actor_ref: 'agent:companion', subject_ref: 'human:ceo', action_kind: 'communicate',
      reversibility: 'reversible', recurrence: 'one_off', sensitive_disclosure: false,
      health_impact: false, third_party_effect: false, new_counterparty: false,
    });
    expect(result).toMatchObject({ risk_level: 'low', decision: 'allow' });
    expect(riskRepository.records).toHaveLength(1);
  });

  it.each([
    ['purchase', { amount: 10, currency: 'CNY' }],
    ['subscribe', {}],
    ['disclose', { sensitive_disclosure: true }],
    ['medical', { health_impact: true }],
  ] as const)('requires a human gate for %s', (actionKind, extra) => {
    const { risk } = makeGovernance();
    const result = risk.assess({
      actor_ref: 'agent:life-steward', subject_ref: 'human:ceo', action_kind: actionKind,
      reversibility: actionKind === 'purchase' ? 'compensatable' : 'reversible',
      recurrence: actionKind === 'subscribe' ? 'recurring' : 'one_off',
      sensitive_disclosure: false, health_impact: false, third_party_effect: true,
      new_counterparty: false, ...extra,
    });
    expect(result.decision).toBe('require_human_gate');
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.policy_version).toBe('strict-personal-v1');
  });
});
