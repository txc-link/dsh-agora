import type {
  ConsentGrantRecord,
  ConsentGrantStatusDto,
  IConsentGrantRepository,
} from '@agora-ts/contracts';
import type { AgoraDatabase } from '../database.js';
import { parseJsonValue, stringifyJsonValue } from './json.js';

export class ConsentGrantRepository implements IConsentGrantRepository {
  constructor(private readonly db: AgoraDatabase) {}

  insert(record: ConsentGrantRecord): ConsentGrantRecord {
    this.db.prepare(`
      INSERT INTO consent_grants (
        id, grantor_ref, grantee_ref, resource_pattern, source_domain, target_domain,
        purpose, permissions, allowed_fields, max_sensitivity, basis, expires_at,
        evidence_ref, status, created_at, revoked_at, revoked_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      record.id, record.grantor_ref, record.grantee_ref, record.resource_pattern,
      record.source_domain, record.target_domain, record.purpose,
      stringifyJsonValue(record.permissions), stringifyJsonValue(record.allowed_fields),
      record.max_sensitivity, record.basis, record.expires_at, record.evidence_ref,
      record.status, record.created_at, record.revoked_at, record.revoked_by,
    );
    return this.getById(record.id) as ConsentGrantRecord;
  }

  getById(id: string): ConsentGrantRecord | null {
    const row = this.db.prepare('SELECT * FROM consent_grants WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? this.parseRow(row) : null;
  }

  list(filters: { grantor_ref?: string; grantee_ref?: string; status?: ConsentGrantStatusDto } = {}): ConsentGrantRecord[] {
    const clauses: string[] = [];
    const params: string[] = [];
    if (filters.grantor_ref !== undefined) { clauses.push('grantor_ref = ?'); params.push(filters.grantor_ref); }
    if (filters.grantee_ref !== undefined) { clauses.push('grantee_ref = ?'); params.push(filters.grantee_ref); }
    if (filters.status !== undefined) { clauses.push('status = ?'); params.push(filters.status); }
    const where = clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '';
    const rows = this.db.prepare(`SELECT * FROM consent_grants${where} ORDER BY created_at ASC, id ASC`).all(...params);
    return (rows as Record<string, unknown>[]).map((row) => this.parseRow(row));
  }

  revoke(id: string, revokedAt: string, revokedBy: string): ConsentGrantRecord | null {
    const result = this.db.prepare(`
      UPDATE consent_grants SET status = 'revoked', revoked_at = ?, revoked_by = ?
      WHERE id = ? AND status = 'active'
    `).run(revokedAt, revokedBy, id);
    return result.changes === 0 ? null : this.getById(id);
  }

  private parseRow(row: Record<string, unknown>): ConsentGrantRecord {
    return {
      id: row.id as string,
      grantor_ref: row.grantor_ref as string,
      grantee_ref: row.grantee_ref as string,
      resource_pattern: row.resource_pattern as string,
      source_domain: row.source_domain as string,
      target_domain: row.target_domain as string,
      purpose: row.purpose as string,
      permissions: parseJsonValue(row.permissions, []),
      allowed_fields: parseJsonValue(row.allowed_fields, []),
      max_sensitivity: row.max_sensitivity as ConsentGrantRecord['max_sensitivity'],
      basis: row.basis as ConsentGrantRecord['basis'],
      expires_at: row.expires_at as string | null,
      evidence_ref: row.evidence_ref as string,
      status: row.status as ConsentGrantStatusDto,
      created_at: row.created_at as string,
      revoked_at: row.revoked_at as string | null,
      revoked_by: row.revoked_by as string | null,
    };
  }
}

