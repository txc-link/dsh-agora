import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type {
  ActionRiskAssessmentRecord,
  ConsentGrantRecord,
  InformationPolicyRecord,
  RelationshipProfileRecord,
  RelationshipProfileVersionRecord,
} from '@agora-ts/contracts';
import { createAgoraDatabase, runMigrations, type AgoraDatabase } from './database.js';
import { ActionRiskAssessmentRepository } from './repositories/action-risk-assessment.repository.js';
import { ConsentGrantRepository } from './repositories/consent-grant.repository.js';
import { InformationPolicyRepository } from './repositories/information-policy.repository.js';
import { RelationshipProfileRepository } from './repositories/relationship-profile.repository.js';

const PAYLOAD = {
  persona_canon: {
    summary: '长期私人伴侣', traits: ['温柔'], background: ['喜欢文学'], values: ['诚实'], speaking_style: ['自然中文'],
  },
  relationship_contract: {
    boundaries: ['不操控'], accountability_style: 'balanced', affection_style: 'warm', transparency: 'ai_disclosed',
  },
  initiative_policy: {
    enabled: true, quiet_hours: { start: '23:00', end: '08:00', timezone: 'Asia/Shanghai' },
    max_daily_initiatives: 2, allowed_triggers: ['scheduled_check_in'],
  },
  voice_preference: {
    locale: 'zh-CN', timbre: '温柔', pace: 1, pitch: 0, expressiveness: 'medium', style_tags: [],
  },
} as const;

function makeDb(): { db: AgoraDatabase; path: string } {
  const path = join(mkdtempSync(join(tmpdir(), 'agora-personal-governance-')), 'test.db');
  const db = createAgoraDatabase({ dbPath: path });
  runMigrations(db);
  return { db, path };
}

describe('RelationshipProfileRepository', () => {
  it('persists immutable versions and current status across a database restart', () => {
    const { db, path } = makeDb();
    const repo = new RelationshipProfileRepository(db);
    const profile: RelationshipProfileRecord = {
      profile_id: 'rel-luna', owner_ref: 'human:ceo', agent_ref: 'agent:luna', relationship_kind: 'companion',
      display_name: '露娜', status: 'active', current_version: 1,
      created_at: '2026-08-30T12:00:00.000Z', updated_at: '2026-08-30T12:00:00.000Z',
    };
    const version1: RelationshipProfileVersionRecord = {
      profile_id: 'rel-luna', version: 1, payload: PAYLOAD, created_by: 'human:ceo',
      change_note: 'initial', created_at: '2026-08-30T12:00:00.000Z',
    };
    repo.create({ profile, version: version1 });
    const version2: RelationshipProfileVersionRecord = {
      ...version1, version: 2, payload: { ...PAYLOAD, persona_canon: { ...PAYLOAD.persona_canon, traits: ['温柔', '直接'] } },
      change_note: 'more direct', created_at: '2026-08-30T12:10:00.000Z',
    };
    expect(repo.appendVersion({
      profile_id: 'rel-luna', expected_current_version: 1, version: version2,
      updated_at: '2026-08-30T12:10:00.000Z',
    })?.profile.current_version).toBe(2);
    expect(repo.appendVersion({
      profile_id: 'rel-luna', expected_current_version: 1, version: { ...version2, version: 3 },
      updated_at: '2026-08-30T12:20:00.000Z',
    })).toBeNull();
    expect(repo.updateStatus('rel-luna', 2, 'paused', '2026-08-30T12:20:00.000Z')?.status).toBe('paused');
    db.close();

    const reopened = createAgoraDatabase({ dbPath: path });
    runMigrations(reopened);
    const restored = new RelationshipProfileRepository(reopened);
    expect(restored.getById('rel-luna')).toMatchObject({
      profile: { current_version: 2, status: 'paused' },
      version: { version: 2 },
    });
    expect(restored.listVersions('rel-luna').map((version) => version.version)).toEqual([1, 2]);
    reopened.close();
  });
});

describe('governance repositories', () => {
  it('keeps information policy history with compare-and-swap append', () => {
    const { db } = makeDb();
    const repo = new InformationPolicyRepository(db);
    const v1: InformationPolicyRecord = {
      resource_ref: 'vault:health/report', version: 1, owner_ref: 'human:ceo', domain: 'health',
      sensitivity: 'sensitive_personal', sharing_mode: 'explicit_consent_only',
      allowed_purposes: ['health_management'], retention_until: '2027-01-01T00:00:00.000Z',
      created_by: 'human:ceo', change_note: null, created_at: '2026-08-30T12:00:00.000Z',
    };
    repo.insert(v1);
    expect(repo.append({ ...v1, version: 2, change_note: 'reviewed' }, 1)?.version).toBe(2);
    expect(repo.append({ ...v1, version: 3 }, 1)).toBeNull();
    expect(repo.getVersion(v1.resource_ref, 1)?.change_note).toBeNull();
    expect(repo.getCurrent(v1.resource_ref)?.version).toBe(2);
    db.close();
  });

  it('persists and revokes consent grants without erasing evidence', () => {
    const { db } = makeDb();
    const repo = new ConsentGrantRepository(db);
    const record: ConsentGrantRecord = {
      id: 'grant-1', grantor_ref: 'human:ceo', grantee_ref: 'agent:health', resource_pattern: 'vault:health/*',
      source_domain: 'health', target_domain: 'personal-office', purpose: 'health_management', permissions: ['read'],
      allowed_fields: ['summary'], max_sensitivity: 'sensitive_personal', basis: 'explicit',
      expires_at: '2026-09-30T00:00:00.000Z', evidence_ref: 'decision:1', status: 'active',
      created_at: '2026-08-30T12:00:00.000Z', revoked_at: null, revoked_by: null,
    };
    repo.insert(record);
    expect(repo.revoke('grant-1', '2026-08-31T00:00:00.000Z', 'human:ceo')).toMatchObject({
      status: 'revoked', revoked_by: 'human:ceo',
    });
    expect(repo.getById('grant-1')?.evidence_ref).toBe('decision:1');
    expect(repo.list({ status: 'active' })).toHaveLength(0);
    db.close();
  });

  it('stores immutable action-risk assessments for audit', () => {
    const { db } = makeDb();
    const repo = new ActionRiskAssessmentRepository(db);
    const record: ActionRiskAssessmentRecord = {
      id: 'risk-1', intent: {
        actor_ref: 'agent:life', subject_ref: 'human:ceo', action_kind: 'purchase', reversibility: 'compensatable',
        recurrence: 'one_off', amount: 10, currency: 'CNY', sensitive_disclosure: false,
        health_impact: false, third_party_effect: true, new_counterparty: false,
      },
      risk_level: 'high', decision: 'require_human_gate', reasons: ['payment action'],
      policy_version: 'strict-personal-v1', created_at: '2026-08-30T12:00:00.000Z',
    };
    repo.insert(record);
    expect(repo.getById('risk-1')).toEqual(record);
    expect(repo.listBySubject('human:ceo')).toEqual([record]);
    db.close();
  });
});
