import {
  createRelationshipProfileRequestSchema,
  reviseRelationshipProfileRequestSchema,
  setRelationshipProfileStatusRequestSchema,
  type CreateRelationshipProfileRequestDto,
  type IRelationshipProfileRepository,
  type RelationshipProfileRecord,
  type RelationshipProfileSnapshotDto,
  type RelationshipProfileStatusDto,
  type ReviseRelationshipProfileRequestDto,
  type SetRelationshipProfileStatusRequestDto,
} from '@agora-ts/contracts';
import { ConflictError, NotFoundError } from './errors.js';

export interface RelationshipProfileServiceOptions {
  repository: IRelationshipProfileRepository;
  now?: () => Date;
}

export interface ListRelationshipProfilesInput {
  owner_ref?: string;
  agent_ref?: string;
  status?: RelationshipProfileStatusDto;
}

const ALLOWED_STATUS_TRANSITIONS: Record<RelationshipProfileStatusDto, readonly RelationshipProfileStatusDto[]> = {
  active: ['paused', 'archived'],
  paused: ['active', 'archived'],
  archived: [],
};

export class RelationshipProfileService {
  private readonly repository: IRelationshipProfileRepository;
  private readonly now: () => Date;

  constructor(options: RelationshipProfileServiceOptions) {
    this.repository = options.repository;
    this.now = options.now ?? (() => new Date());
  }

  create(input: CreateRelationshipProfileRequestDto): RelationshipProfileSnapshotDto {
    const parsed = createRelationshipProfileRequestSchema.parse(input);
    if (this.repository.getById(parsed.profile_id)) {
      throw new ConflictError(`relationship profile already exists: ${parsed.profile_id}`);
    }
    const timestamp = this.now().toISOString();
    return this.repository.create({
      profile: {
        profile_id: parsed.profile_id,
        owner_ref: parsed.owner_ref,
        agent_ref: parsed.agent_ref,
        relationship_kind: parsed.relationship_kind,
        display_name: parsed.display_name,
        status: 'active',
        current_version: 1,
        created_at: timestamp,
        updated_at: timestamp,
      },
      version: {
        profile_id: parsed.profile_id,
        version: 1,
        payload: parsed.payload,
        created_by: parsed.created_by,
        change_note: parsed.change_note ?? null,
        created_at: timestamp,
      },
    });
  }

  require(profileId: string, version?: number): RelationshipProfileSnapshotDto {
    const current = this.repository.getById(profileId);
    if (!current) {
      throw new NotFoundError(`relationship profile not found: ${profileId}`);
    }
    if (version === undefined || version === current.profile.current_version) {
      return current;
    }
    const selected = this.repository.getVersion(profileId, version);
    if (!selected) {
      throw new NotFoundError(`relationship profile version not found: ${profileId}@${version}`);
    }
    return { profile: current.profile, version: selected };
  }

  list(input: ListRelationshipProfilesInput = {}): RelationshipProfileRecord[] {
    return this.repository.list(input);
  }

  listVersions(profileId: string) {
    this.require(profileId);
    return this.repository.listVersions(profileId);
  }

  revise(input: ReviseRelationshipProfileRequestDto): RelationshipProfileSnapshotDto {
    const parsed = reviseRelationshipProfileRequestSchema.parse(input);
    const current = this.require(parsed.profile_id);
    if (current.profile.status === 'archived') {
      throw new ConflictError(`archived relationship profile cannot be revised: ${parsed.profile_id}`);
    }
    if (current.profile.current_version !== parsed.expected_current_version) {
      throw new ConflictError(
        `relationship profile version conflict: expected ${parsed.expected_current_version}, current ${current.profile.current_version}`,
      );
    }
    const timestamp = this.now().toISOString();
    const appended = this.repository.appendVersion({
      profile_id: parsed.profile_id,
      expected_current_version: parsed.expected_current_version,
      version: {
        profile_id: parsed.profile_id,
        version: parsed.expected_current_version + 1,
        payload: parsed.payload,
        created_by: parsed.created_by,
        change_note: parsed.change_note ?? null,
        created_at: timestamp,
      },
      updated_at: timestamp,
    });
    if (!appended) {
      throw new ConflictError(`relationship profile version conflict: ${parsed.profile_id}`);
    }
    return appended;
  }

  setStatus(input: SetRelationshipProfileStatusRequestDto): RelationshipProfileRecord {
    const parsed = setRelationshipProfileStatusRequestSchema.parse(input);
    const current = this.require(parsed.profile_id).profile;
    if (current.current_version !== parsed.expected_current_version) {
      throw new ConflictError(
        `relationship profile version conflict: expected ${parsed.expected_current_version}, current ${current.current_version}`,
      );
    }
    if (parsed.status === current.status) return current;
    if (!ALLOWED_STATUS_TRANSITIONS[current.status].includes(parsed.status)) {
      throw new ConflictError(`relationship profile ${current.status} cannot transition to ${parsed.status}`);
    }
    const updated = this.repository.updateStatus(
      parsed.profile_id,
      parsed.expected_current_version,
      parsed.status,
      this.now().toISOString(),
    );
    if (!updated) {
      throw new ConflictError(`relationship profile version conflict: ${parsed.profile_id}`);
    }
    return updated;
  }
}

