import {
  relationshipProfileVersionPayloadSchema,
  type AppendRelationshipProfileVersionInput,
  type CreateRelationshipProfileInput,
  type IRelationshipProfileRepository,
  type RelationshipKindDto,
  type RelationshipProfileRecord,
  type RelationshipProfileSnapshotDto,
  type RelationshipProfileStatusDto,
  type RelationshipProfileVersionRecord,
} from '@agora-ts/contracts';
import type { AgoraDatabase } from '../database.js';
import { parseJsonValue, stringifyJsonValue } from './json.js';

export class RelationshipProfileRepository implements IRelationshipProfileRepository {
  constructor(private readonly db: AgoraDatabase) {}

  create(input: CreateRelationshipProfileInput): RelationshipProfileSnapshotDto {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare(`
        INSERT INTO relationship_profiles (
          profile_id, owner_ref, agent_ref, relationship_kind, display_name,
          status, current_version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        input.profile.profile_id,
        input.profile.owner_ref,
        input.profile.agent_ref,
        input.profile.relationship_kind,
        input.profile.display_name,
        input.profile.status,
        input.profile.current_version,
        input.profile.created_at,
        input.profile.updated_at,
      );
      this.insertVersion(input.version);
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
    const stored = this.getById(input.profile.profile_id);
    if (!stored) throw new Error('relationship profile insert failed: reload returned null');
    return stored;
  }

  getById(profileId: string): RelationshipProfileSnapshotDto | null {
    const row = this.db.prepare(
      'SELECT * FROM relationship_profiles WHERE profile_id = ?',
    ).get(profileId) as Record<string, unknown> | undefined;
    if (!row) return null;
    const profile = this.parseProfile(row);
    const version = this.getVersion(profileId, profile.current_version);
    if (!version) throw new Error(`relationship profile current version missing: ${profileId}@${profile.current_version}`);
    return { profile, version };
  }

  getVersion(profileId: string, version: number): RelationshipProfileVersionRecord | null {
    const row = this.db.prepare(`
      SELECT * FROM relationship_profile_versions WHERE profile_id = ? AND version = ?
    `).get(profileId, version) as Record<string, unknown> | undefined;
    return row ? this.parseVersion(row) : null;
  }

  listVersions(profileId: string): RelationshipProfileVersionRecord[] {
    const rows = this.db.prepare(`
      SELECT * FROM relationship_profile_versions WHERE profile_id = ? ORDER BY version ASC
    `).all(profileId) as Record<string, unknown>[];
    return rows.map((row) => this.parseVersion(row));
  }

  list(filters: {
    owner_ref?: string;
    agent_ref?: string;
    status?: RelationshipProfileStatusDto;
  } = {}): RelationshipProfileRecord[] {
    const clauses: string[] = [];
    const params: string[] = [];
    if (filters.owner_ref !== undefined) { clauses.push('owner_ref = ?'); params.push(filters.owner_ref); }
    if (filters.agent_ref !== undefined) { clauses.push('agent_ref = ?'); params.push(filters.agent_ref); }
    if (filters.status !== undefined) { clauses.push('status = ?'); params.push(filters.status); }
    const where = clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '';
    const rows = this.db.prepare(
      `SELECT * FROM relationship_profiles${where} ORDER BY created_at ASC, profile_id ASC`,
    ).all(...params) as Record<string, unknown>[];
    return rows.map((row) => this.parseProfile(row));
  }

  appendVersion(input: AppendRelationshipProfileVersionInput): RelationshipProfileSnapshotDto | null {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const updated = this.db.prepare(`
        UPDATE relationship_profiles
        SET current_version = ?, updated_at = ?
        WHERE profile_id = ? AND current_version = ?
      `).run(
        input.version.version,
        input.updated_at,
        input.profile_id,
        input.expected_current_version,
      );
      if (updated.changes === 0) {
        this.db.exec('ROLLBACK');
        return null;
      }
      this.insertVersion(input.version);
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
    return this.getById(input.profile_id);
  }

  updateStatus(
    profileId: string,
    expectedCurrentVersion: number,
    status: RelationshipProfileStatusDto,
    updatedAt: string,
  ): RelationshipProfileRecord | null {
    const result = this.db.prepare(`
      UPDATE relationship_profiles SET status = ?, updated_at = ?
      WHERE profile_id = ? AND current_version = ?
    `).run(status, updatedAt, profileId, expectedCurrentVersion);
    return result.changes === 0 ? null : this.getById(profileId)?.profile ?? null;
  }

  private insertVersion(version: RelationshipProfileVersionRecord): void {
    this.db.prepare(`
      INSERT INTO relationship_profile_versions (
        profile_id, version, payload, created_by, change_note, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      version.profile_id,
      version.version,
      stringifyJsonValue(version.payload),
      version.created_by,
      version.change_note,
      version.created_at,
    );
  }

  private parseProfile(row: Record<string, unknown>): RelationshipProfileRecord {
    return {
      profile_id: row.profile_id as string,
      owner_ref: row.owner_ref as string,
      agent_ref: row.agent_ref as string,
      relationship_kind: row.relationship_kind as RelationshipKindDto,
      display_name: row.display_name as string,
      status: row.status as RelationshipProfileStatusDto,
      current_version: Number(row.current_version),
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    };
  }

  private parseVersion(row: Record<string, unknown>): RelationshipProfileVersionRecord {
    return {
      profile_id: row.profile_id as string,
      version: Number(row.version),
      payload: relationshipProfileVersionPayloadSchema.parse(parseJsonValue(row.payload, {})),
      created_by: row.created_by as string,
      change_note: row.change_note as string | null,
      created_at: row.created_at as string,
    };
  }
}

