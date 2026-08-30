import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createAgoraDatabase, runMigrations } from '@agora-ts/db';
import { buildApp } from './app.js';

const openApps: Array<ReturnType<typeof buildApp>> = [];
afterEach(async () => {
  await Promise.all(openApps.splice(0).map((app) => app.close()));
});

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
};

function makeApp() {
  const db = createAgoraDatabase({ dbPath: join(mkdtempSync(join(tmpdir(), 'agora-governance-api-')), 'test.db') });
  runMigrations(db);
  const app = buildApp({ db, apiAuth: { enabled: true, token: 'server-token' } });
  app.addHook('onClose', async () => db.close());
  openApps.push(app);
  return app;
}

const auth = { authorization: 'Bearer server-token' };

describe('personal governance REST', () => {
  it('protects and persists versioned relationship profiles', async () => {
    const app = makeApp();
    const body = {
      profile_id: 'rel-luna', owner_ref: 'human:ceo', agent_ref: 'agent:luna', relationship_kind: 'companion',
      display_name: '露娜', payload: PAYLOAD, created_by: 'human:ceo',
    };
    expect((await app.inject({ method: 'POST', url: '/api/relationships', payload: body })).statusCode).toBe(401);

    const created = await app.inject({ method: 'POST', url: '/api/relationships', headers: auth, payload: body });
    expect(created.statusCode).toBe(201);
    expect(created.json().profile.current_version).toBe(1);

    const revised = await app.inject({
      method: 'POST', url: '/api/relationships/rel-luna/revisions', headers: auth,
      payload: { expected_current_version: 1, payload: PAYLOAD, created_by: 'human:ceo', change_note: 'reviewed' },
    });
    expect(revised.statusCode).toBe(200);
    expect(revised.json().version.version).toBe(2);

    const historical = await app.inject({
      method: 'GET', url: '/api/relationships/rel-luna?version=1', headers: auth,
    });
    expect(historical.json().version.version).toBe(1);
  });

  it('denies personal-to-work projection until narrow explicit consent exists', async () => {
    const app = makeApp();
    const classified = await app.inject({
      method: 'POST', url: '/api/governance/information/classify', headers: auth,
      payload: {
        resource_ref: 'vault:life/trip', owner_ref: 'human:ceo', domain: 'life', sensitivity: 'personal',
        sharing_mode: 'explicit_consent_only', allowed_purposes: ['trip_planning'],
        retention_until: '2027-01-01T00:00:00.000Z', created_by: 'human:ceo',
      },
    });
    expect(classified.statusCode).toBe(201);
    const request = {
      resource_ref: 'vault:life/trip', actor_ref: 'agent:travel', target_domain: 'personal-office',
      purpose: 'trip_planning', permission: 'read', requested_fields: ['budget_band'],
    };
    expect((await app.inject({
      method: 'POST', url: '/api/governance/information/authorize', headers: auth, payload: request,
    })).json()).toMatchObject({ allowed: false });

    const grant = await app.inject({
      method: 'POST', url: '/api/governance/consents', headers: auth,
      payload: {
        grantor_ref: 'human:ceo', grantee_ref: 'agent:travel', resource_pattern: 'vault:life/*',
        source_domain: 'life', target_domain: 'personal-office', purpose: 'trip_planning',
        permissions: ['read'], allowed_fields: ['budget_band'], max_sensitivity: 'personal', basis: 'explicit',
        expires_at: '2027-01-01T00:00:00.000Z', evidence_ref: 'decision:trip',
      },
    });
    expect(grant.statusCode).toBe(201);
    expect((await app.inject({
      method: 'POST', url: '/api/governance/information/authorize', headers: auth, payload: request,
    })).json()).toMatchObject({ allowed: true, grant_id: grant.json().id });

    const workProjection = await app.inject({
      method: 'POST', url: '/api/governance/information/authorize', headers: auth,
      payload: { ...request, target_domain: 'work' },
    });
    expect(workProjection.json()).toMatchObject({ allowed: false });
  });

  it('records action risk and returns a mandatory human gate decision', async () => {
    const app = makeApp();
    const response = await app.inject({
      method: 'POST', url: '/api/governance/action-risk/assess', headers: auth,
      payload: {
        actor_ref: 'agent:life', subject_ref: 'human:ceo', action_kind: 'purchase',
        reversibility: 'compensatable', recurrence: 'one_off', amount: 10, currency: 'CNY',
        sensitive_disclosure: false, health_impact: false, third_party_effect: true, new_counterparty: false,
      },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ decision: 'require_human_gate', policy_version: 'strict-personal-v1' });
  });

  it('persists, leases and acknowledges a proactive voice initiative without provider ids in Core', async () => {
    const app = makeApp();
    await app.inject({
      method: 'POST', url: '/api/relationships', headers: auth,
      payload: {
        profile_id: 'rel-luna', owner_ref: 'human:ceo', agent_ref: 'agent:luna', relationship_kind: 'companion',
        display_name: '露娜', payload: PAYLOAD, created_by: 'human:ceo',
      },
    });
    await app.inject({
      method: 'POST', url: '/api/governance/information/classify', headers: auth,
      payload: {
        resource_ref: 'memory:companion/check-in-1', owner_ref: 'human:ceo', domain: 'domain:companion',
        sensitivity: 'personal', sharing_mode: 'same_domain', allowed_purposes: ['proactive-care'],
        retention_until: '2027-01-01T00:00:00.000Z', created_by: 'human:ceo',
      },
    });
    const scheduled = await app.inject({
      method: 'POST', url: '/api/relationship-initiatives', headers: auth,
      payload: {
        profile_id: 'rel-luna', trigger: 'scheduled_check_in', modality: 'voice', text: '记得早点休息。',
        resource_ref: 'memory:companion/check-in-1', source_domain: 'domain:companion',
        target_domain: 'domain:companion', delivery_binding_ref: 'binding:companion-primary',
        purpose: 'proactive-care', scheduled_for: '2026-08-29T12:00:00.000Z', requested_fields: ['text'],
      },
    });
    expect(scheduled.statusCode).toBe(201);
    expect(scheduled.json()).not.toHaveProperty('room_id');

    const claimed = await app.inject({
      method: 'POST', url: '/api/relationship-initiatives/claim', headers: auth,
      payload: { consumer_ref: 'connector:companion-node-b', target_domain: 'domain:companion', limit: 1 },
    });
    expect(claimed.statusCode).toBe(200);
    expect(claimed.json().initiatives).toHaveLength(1);
    const initiative = claimed.json().initiatives[0];
    expect(initiative).toMatchObject({ status: 'claimed', delivery_binding_ref: 'binding:companion-primary' });

    const delivered = await app.inject({
      method: 'POST', url: `/api/relationship-initiatives/${initiative.id}/delivered`, headers: auth,
      payload: { lease_token: initiative.lease_token },
    });
    expect(delivered.json()).toMatchObject({ status: 'delivered' });
  });
});
