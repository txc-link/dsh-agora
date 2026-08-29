/**
 * team.repository.ts — org-aware-work-os S1 team 聚合存储 (2026-08-30).
 *
 * Persists org teams (每项目一个组织): lead + members + responsibilities + parent 层级。
 * Pattern follows agent-question.repository.ts.
 */

import { randomUUID } from 'node:crypto';
import type {
  ITeamRepository,
  TeamInsertInput,
  TeamRecord,
  TeamUpdateInput,
} from '@agora-ts/contracts';
import type { AgoraDatabase } from '../database.js';
import { parseJsonValue, stringifyJsonValue } from './json.js';

function parseStringArray(raw: unknown): string[] {
  const parsed = parseJsonValue<unknown>(raw, []);
  return Array.isArray(parsed) ? parsed.map((v) => String(v)) : [];
}

export class TeamRepository implements ITeamRepository {
  constructor(private readonly db: AgoraDatabase) {}

  insert(input: TeamInsertInput): TeamRecord {
    const id = input.id ?? randomUUID();
    const createdAt = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO org_teams (
        id, project_id, name, lead, members, responsibilities, parent_id, created_at, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.project_id,
      input.name,
      input.lead,
      stringifyJsonValue(input.members ?? []),
      stringifyJsonValue(input.responsibilities ?? []),
      input.parent_id ?? null,
      createdAt,
      stringifyJsonValue(input.metadata ?? null),
    );
    const stored = this.getById(id);
    if (stored === null) {
      throw new Error('team insert failed: reload returned null');
    }
    return stored;
  }

  getById(id: string): TeamRecord | null {
    const row = this.db.prepare('SELECT * FROM org_teams WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? this.parseRow(row) : null;
  }

  getByName(projectId: string, name: string): TeamRecord | null {
    const row = this.db.prepare(
      'SELECT * FROM org_teams WHERE project_id = ? AND name = ?',
    ).get(projectId, name) as Record<string, unknown> | undefined;
    return row ? this.parseRow(row) : null;
  }

  listByProject(projectId: string): TeamRecord[] {
    const rows = this.db.prepare(
      'SELECT * FROM org_teams WHERE project_id = ? ORDER BY created_at ASC, id ASC',
    ).all(projectId) as Record<string, unknown>[];
    return rows.map((row) => this.parseRow(row));
  }

  listByMember(agentRef: string): TeamRecord[] {
    const rows = this.db.prepare(
      'SELECT * FROM org_teams ORDER BY created_at ASC, id ASC',
    ).all() as Record<string, unknown>[];
    return rows
      .map((row) => this.parseRow(row))
      .filter((team) => team.members.includes(agentRef));
  }

  update(id: string, patch: TeamUpdateInput): TeamRecord | null {
    const current = this.getById(id);
    if (current === null) return null;
    const lead = patch.lead ?? current.lead;
    const members = patch.members ?? current.members;
    const responsibilities = patch.responsibilities ?? current.responsibilities;
    const parentId = patch.parent_id !== undefined ? patch.parent_id : current.parent_id;
    let info: { changes: number | bigint };
    if (patch.parent_id !== undefined) {
      info = this.db.prepare(
        'UPDATE org_teams SET lead = ?, members = ?, responsibilities = ?, parent_id = ? WHERE id = ?',
      ).run(lead, stringifyJsonValue(members), stringifyJsonValue(responsibilities), parentId, id);
    } else {
      info = this.db.prepare(
        'UPDATE org_teams SET lead = ?, members = ?, responsibilities = ? WHERE id = ?',
      ).run(lead, stringifyJsonValue(members), stringifyJsonValue(responsibilities), id);
    }
    if (info.changes === 0) return null;
    return this.getById(id);
  }

  delete(id: string): boolean {
    const info = this.db.prepare('DELETE FROM org_teams WHERE id = ?').run(id);
    return info.changes > 0;
  }

  private parseRow(row: Record<string, unknown>): TeamRecord {
    return {
      id: row.id as string,
      project_id: row.project_id as string,
      name: row.name as string,
      lead: row.lead as string,
      members: parseStringArray(row.members),
      responsibilities: parseStringArray(row.responsibilities),
      parent_id: row.parent_id as string | null,
      created_at: row.created_at as string,
      metadata: parseJsonValue<Record<string, unknown> | null>(row.metadata, null),
    };
  }
}
