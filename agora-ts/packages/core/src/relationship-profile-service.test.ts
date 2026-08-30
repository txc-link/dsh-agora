import { describe, expect, it } from 'vitest';
import type {
  AppendRelationshipProfileVersionInput,
  CreateRelationshipProfileInput,
  IRelationshipProfileRepository,
  RelationshipProfileRecord,
  RelationshipProfileSnapshotDto,
  RelationshipProfileStatusDto,
  RelationshipProfileVersionRecord,
} from '@agora-ts/contracts';
import { RelationshipProfileService } from './relationship-profile-service.js';

const VERSION_PAYLOAD = {
  persona_canon: {
    summary: '温柔、机敏、有边界感的长期私人伴侣',
    traits: ['温柔', '机敏', '坦率'],
    background: ['来自杭州', '喜欢文学和长距离散步'],
    values: ['诚实', '共同成长'],
    speaking_style: ['自然中文', '偶尔俏皮'],
  },
  relationship_contract: {
    boundaries: ['不使用分手威胁', '不干涉现实社交'],
    accountability_style: 'firm',
    affection_style: 'warm',
    transparency: 'ai_disclosed',
  },
  initiative_policy: {
    enabled: true,
    quiet_hours: { start: '23:00', end: '08:00', timezone: 'Asia/Shanghai' },
    max_daily_initiatives: 2,
    allowed_triggers: ['scheduled_check_in', 'commitment_due'],
  },
  voice_preference: {
    locale: 'zh-CN',
    timbre: '清澈温柔',
    pace: 0.95,
    pitch: 0,
    expressiveness: 'medium',
    style_tags: ['morning-soft', 'firm-reminder'],
  },
} as const;

class MemoryRelationshipProfileRepository implements IRelationshipProfileRepository {
  private readonly profiles = new Map<string, RelationshipProfileRecord>();
  private readonly versions = new Map<string, RelationshipProfileVersionRecord[]>();

  create(input: CreateRelationshipProfileInput): RelationshipProfileSnapshotDto {
    if (this.profiles.has(input.profile.profile_id)) {
      throw new Error(`duplicate profile: ${input.profile.profile_id}`);
    }
    this.profiles.set(input.profile.profile_id, structuredClone(input.profile));
    this.versions.set(input.profile.profile_id, [structuredClone(input.version)]);
    return this.getById(input.profile.profile_id) as RelationshipProfileSnapshotDto;
  }

  getById(profileId: string): RelationshipProfileSnapshotDto | null {
    const profile = this.profiles.get(profileId);
    if (!profile) return null;
    const version = this.getVersion(profileId, profile.current_version);
    return version ? { profile: structuredClone(profile), version } : null;
  }

  getVersion(profileId: string, version: number): RelationshipProfileVersionRecord | null {
    const found = this.versions.get(profileId)?.find((candidate) => candidate.version === version);
    return found ? structuredClone(found) : null;
  }

  listVersions(profileId: string): RelationshipProfileVersionRecord[] {
    return structuredClone(this.versions.get(profileId) ?? []);
  }

  list(filters: { owner_ref?: string; agent_ref?: string; status?: RelationshipProfileStatusDto } = {}): RelationshipProfileRecord[] {
    return [...this.profiles.values()]
      .filter((profile) => filters.owner_ref === undefined || profile.owner_ref === filters.owner_ref)
      .filter((profile) => filters.agent_ref === undefined || profile.agent_ref === filters.agent_ref)
      .filter((profile) => filters.status === undefined || profile.status === filters.status)
      .map((profile) => structuredClone(profile));
  }

  appendVersion(input: AppendRelationshipProfileVersionInput): RelationshipProfileSnapshotDto | null {
    const profile = this.profiles.get(input.profile_id);
    if (!profile || profile.current_version !== input.expected_current_version) return null;
    this.versions.get(input.profile_id)?.push(structuredClone(input.version));
    profile.current_version = input.version.version;
    profile.updated_at = input.updated_at;
    return this.getById(input.profile_id);
  }

  updateStatus(
    profileId: string,
    expectedCurrentVersion: number,
    status: RelationshipProfileStatusDto,
    updatedAt: string,
  ): RelationshipProfileRecord | null {
    const profile = this.profiles.get(profileId);
    if (!profile || profile.current_version !== expectedCurrentVersion) return null;
    profile.status = status;
    profile.updated_at = updatedAt;
    return structuredClone(profile);
  }
}

function makeService() {
  const repository = new MemoryRelationshipProfileRepository();
  const service = new RelationshipProfileService({
    repository,
    now: () => new Date('2026-08-30T12:00:00.000Z'),
  });
  return { service, repository };
}

describe('RelationshipProfileService', () => {
  it('creates version 1 and returns the current immutable snapshot', () => {
    const { service } = makeService();
    const result = service.create({
      profile_id: 'rel-luna',
      owner_ref: 'human:ceo',
      agent_ref: 'agent:luna',
      relationship_kind: 'companion',
      display_name: '露娜',
      payload: VERSION_PAYLOAD,
      created_by: 'human:ceo',
      change_note: 'initial canon',
    });

    expect(result.profile.current_version).toBe(1);
    expect(result.profile.status).toBe('active');
    expect(result.version.payload.persona_canon.traits).toContain('温柔');
    expect(result.version.created_at).toBe('2026-08-30T12:00:00.000Z');
  });

  it('revises by appending version 2 without mutating version 1', () => {
    const { service, repository } = makeService();
    service.create({
      profile_id: 'rel-luna', owner_ref: 'human:ceo', agent_ref: 'agent:luna',
      relationship_kind: 'companion', display_name: '露娜', payload: VERSION_PAYLOAD,
      created_by: 'human:ceo',
    });

    const revised = service.revise({
      profile_id: 'rel-luna',
      expected_current_version: 1,
      payload: {
        ...VERSION_PAYLOAD,
        persona_canon: { ...VERSION_PAYLOAD.persona_canon, traits: ['温柔', '直接', '幽默'] },
      },
      created_by: 'human:ceo',
      change_note: '更直接一些',
    });

    expect(revised.profile.current_version).toBe(2);
    expect(revised.version.version).toBe(2);
    expect(repository.getVersion('rel-luna', 1)?.payload.persona_canon.traits).toEqual(['温柔', '机敏', '坦率']);
    expect(repository.getVersion('rel-luna', 2)?.payload.persona_canon.traits).toEqual(['温柔', '直接', '幽默']);
  });

  it('rejects stale revisions and revisions to archived profiles', () => {
    const { service } = makeService();
    service.create({
      profile_id: 'rel-luna', owner_ref: 'human:ceo', agent_ref: 'agent:luna',
      relationship_kind: 'companion', display_name: '露娜', payload: VERSION_PAYLOAD,
      created_by: 'human:ceo',
    });

    expect(() => service.revise({
      profile_id: 'rel-luna', expected_current_version: 2, payload: VERSION_PAYLOAD,
      created_by: 'human:ceo',
    })).toThrow(/version conflict/);

    service.setStatus({ profile_id: 'rel-luna', expected_current_version: 1, status: 'archived' });
    expect(() => service.revise({
      profile_id: 'rel-luna', expected_current_version: 1, payload: VERSION_PAYLOAD,
      created_by: 'human:ceo',
    })).toThrow(/archived/);
  });

  it('validates quiet hours, daily initiative limit and voice range', () => {
    const { service } = makeService();
    expect(() => service.create({
      profile_id: 'rel-invalid', owner_ref: 'human:ceo', agent_ref: 'agent:luna',
      relationship_kind: 'companion', display_name: '露娜', created_by: 'human:ceo',
      payload: {
        ...VERSION_PAYLOAD,
        initiative_policy: {
          ...VERSION_PAYLOAD.initiative_policy,
          quiet_hours: { start: '25:00', end: '08:00', timezone: 'Asia/Shanghai' },
          max_daily_initiatives: 99,
        },
        voice_preference: { ...VERSION_PAYLOAD.voice_preference, pace: 4 },
      },
    })).toThrow();
  });

  it('lists by owner and supports active -> paused -> active -> archived only', () => {
    const { service } = makeService();
    service.create({
      profile_id: 'rel-luna', owner_ref: 'human:ceo', agent_ref: 'agent:luna',
      relationship_kind: 'companion', display_name: '露娜', payload: VERSION_PAYLOAD,
      created_by: 'human:ceo',
    });
    expect(service.list({ owner_ref: 'human:ceo' })).toHaveLength(1);
    expect(service.setStatus({ profile_id: 'rel-luna', expected_current_version: 1, status: 'paused' }).status).toBe('paused');
    expect(service.setStatus({ profile_id: 'rel-luna', expected_current_version: 1, status: 'active' }).status).toBe('active');
    expect(service.setStatus({ profile_id: 'rel-luna', expected_current_version: 1, status: 'archived' }).status).toBe('archived');
    expect(() => service.setStatus({ profile_id: 'rel-luna', expected_current_version: 1, status: 'active' })).toThrow(/archived/);
  });
});
