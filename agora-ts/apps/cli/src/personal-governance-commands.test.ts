import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import { afterAll, describe, expect, it } from 'vitest';
import {
  ActionRiskService,
  ConsentService,
  InformationGovernanceService,
  RelationshipProfileService,
} from '@agora-ts/core';
import {
  ActionRiskAssessmentRepository,
  ConsentGrantRepository,
  InformationPolicyRepository,
  RelationshipProfileRepository,
  createAgoraDatabase,
  runMigrations,
} from '@agora-ts/db';
import { createCliProgram } from './index.js';

const dir = mkdtempSync(join(tmpdir(), 'agora-personal-cli-'));
const db = createAgoraDatabase({ dbPath: join(dir, 'agora.db') });
runMigrations(db);

afterAll(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

function buffer() {
  let value = '';
  return {
    stream: new Writable({ write(chunk, _encoding, callback) { value += String(chunk); callback(); } }),
    read: () => value,
  };
}

const relationshipProfileService = new RelationshipProfileService({
  repository: new RelationshipProfileRepository(db),
});
const consentService = new ConsentService({ repository: new ConsentGrantRepository(db) });
const informationGovernanceService = new InformationGovernanceService({
  repository: new InformationPolicyRepository(db),
  consent: consentService,
});
const actionRiskService = new ActionRiskService({ repository: new ActionRiskAssessmentRepository(db) });

async function run(args: string[]) {
  const stdout = buffer();
  const stderr = buffer();
  const program = createCliProgram({
    stdout: stdout.stream,
    stderr: stderr.stream,
    relationshipProfileService,
    consentService,
    informationGovernanceService,
    actionRiskService,
  }).exitOverride();
  await program.parseAsync(args, { from: 'user' });
  expect(stderr.read()).toBe('');
  return JSON.parse(stdout.read()) as { ok: boolean; data: Record<string, unknown> };
}

describe('personal governance CLI', () => {
  it('creates and revises a versioned companion relationship profile', async () => {
    const payloadPath = join(dir, 'companion.json');
    const payload = {
      persona_canon: {
        summary: '温柔而坚定的长期私人伴侣', traits: ['温柔', '坚定'], background: ['喜欢文学'],
        values: ['诚实'], speaking_style: ['自然中文'],
      },
      relationship_contract: {
        boundaries: ['不操控现实关系'], accountability_style: 'firm', affection_style: 'warm', transparency: 'ai_disclosed',
      },
      initiative_policy: {
        enabled: true, quiet_hours: { start: '23:00', end: '08:00', timezone: 'Asia/Shanghai' },
        max_daily_initiatives: 2, allowed_triggers: ['scheduled_check_in', 'commitment_due'],
      },
      voice_preference: {
        locale: 'zh-CN', timbre: '清澈温柔', pace: 0.95, pitch: 0, expressiveness: 'medium', style_tags: ['soft'],
      },
    };
    writeFileSync(payloadPath, JSON.stringify(payload), 'utf8');
    const created = await run([
      'relationship', 'create', '--profile', 'rel-luna', '--owner', 'human:ceo', '--agent', 'agent:luna',
      '--kind', 'companion', '--name', '露娜', '--payload-file', payloadPath, '--by', 'human:ceo',
    ]);
    expect((created.data.profile as { current_version: number }).current_version).toBe(1);

    payload.persona_canon.traits.push('直接');
    writeFileSync(payloadPath, JSON.stringify(payload), 'utf8');
    const revised = await run([
      'relationship', 'revise', '--profile', 'rel-luna', '--expected-version', '1',
      '--payload-file', payloadPath, '--by', 'human:ceo', '--note', '更直接一些',
    ]);
    expect((revised.data.version as { version: number }).version).toBe(2);
  });

  it('classifies, grants narrow consent, authorizes, and risk-assesses through CLI', async () => {
    await run([
      'information', 'classify', '--resource', 'vault:life/trip', '--owner', 'human:ceo', '--domain', 'life',
      '--sensitivity', 'personal', '--sharing', 'explicit_consent_only', '--purposes', 'trip_planning',
      '--retention-until', '2027-01-01T00:00:00.000Z', '--by', 'human:ceo',
    ]);
    await run([
      'consent', 'grant', '--grantor', 'human:ceo', '--grantee', 'agent:travel',
      '--resource-pattern', 'vault:life/*', '--source-domain', 'life', '--target-domain', 'personal-office',
      '--purpose', 'trip_planning', '--permissions', 'read,derive', '--fields', 'budget_band',
      '--max-sensitivity', 'personal', '--basis', 'explicit', '--evidence', 'decision:trip',
      '--expires-at', '2027-01-01T00:00:00.000Z',
    ]);
    const authorization = await run([
      'information', 'authorize', '--resource', 'vault:life/trip', '--actor', 'agent:travel',
      '--target-domain', 'personal-office', '--purpose', 'trip_planning', '--permission', 'read',
      '--fields', 'budget_band',
    ]);
    expect(authorization.data).toMatchObject({ allowed: true });

    const intentPath = join(dir, 'intent.json');
    writeFileSync(intentPath, JSON.stringify({
      actor_ref: 'agent:life', subject_ref: 'human:ceo', action_kind: 'purchase',
      reversibility: 'compensatable', recurrence: 'one_off', amount: 10, currency: 'CNY',
      sensitive_disclosure: false, health_impact: false, third_party_effect: true, new_counterparty: false,
    }), 'utf8');
    const assessed = await run(['risk', 'assess', '--intent-file', intentPath]);
    expect(assessed.data).toMatchObject({ decision: 'require_human_gate' });
  });
});
