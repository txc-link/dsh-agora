import type { IInformationPolicyRepository, InformationPolicyRecord } from '@agora-ts/contracts';
import type { AgoraDatabase } from '../database.js';
import { parseJsonValue, stringifyJsonValue } from './json.js';

export class InformationPolicyRepository implements IInformationPolicyRepository {
  constructor(private readonly db: AgoraDatabase) {}

  insert(record: InformationPolicyRecord): InformationPolicyRecord {
    this.insertRow(record);
    return this.getVersion(record.resource_ref, record.version) as InformationPolicyRecord;
  }

  getCurrent(resourceRef: string): InformationPolicyRecord | null {
    const row = this.db.prepare(`
      SELECT * FROM information_policies WHERE resource_ref = ? ORDER BY version DESC LIMIT 1
    `).get(resourceRef) as Record<string, unknown> | undefined;
    return row ? this.parseRow(row) : null;
  }

  getVersion(resourceRef: string, version: number): InformationPolicyRecord | null {
    const row = this.db.prepare(`
      SELECT * FROM information_policies WHERE resource_ref = ? AND version = ?
    `).get(resourceRef, version) as Record<string, unknown> | undefined;
    return row ? this.parseRow(row) : null;
  }

  append(record: InformationPolicyRecord, expectedCurrentVersion: number): InformationPolicyRecord | null {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const current = this.getCurrent(record.resource_ref);
      if (!current || current.version !== expectedCurrentVersion || record.version !== expectedCurrentVersion + 1) {
        this.db.exec('ROLLBACK');
        return null;
      }
      this.insertRow(record);
      this.db.exec('COMMIT');
      return this.getVersion(record.resource_ref, record.version);
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  list(domain?: string): InformationPolicyRecord[] {
    const rows = domain === undefined
      ? this.db.prepare(`
          SELECT p.* FROM information_policies p
          JOIN (SELECT resource_ref, MAX(version) version FROM information_policies GROUP BY resource_ref) current
          ON current.resource_ref = p.resource_ref AND current.version = p.version
          ORDER BY p.resource_ref
        `).all()
      : this.db.prepare(`
          SELECT p.* FROM information_policies p
          JOIN (SELECT resource_ref, MAX(version) version FROM information_policies GROUP BY resource_ref) current
          ON current.resource_ref = p.resource_ref AND current.version = p.version
          WHERE p.domain = ? ORDER BY p.resource_ref
        `).all(domain);
    return (rows as Record<string, unknown>[]).map((row) => this.parseRow(row));
  }

  private insertRow(record: InformationPolicyRecord): void {
    this.db.prepare(`
      INSERT INTO information_policies (
        resource_ref, version, owner_ref, domain, sensitivity, sharing_mode,
        allowed_purposes, retention_until, created_by, change_note, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      record.resource_ref, record.version, record.owner_ref, record.domain, record.sensitivity,
      record.sharing_mode, stringifyJsonValue(record.allowed_purposes), record.retention_until,
      record.created_by, record.change_note, record.created_at,
    );
  }

  private parseRow(row: Record<string, unknown>): InformationPolicyRecord {
    return {
      resource_ref: row.resource_ref as string,
      version: Number(row.version),
      owner_ref: row.owner_ref as string,
      domain: row.domain as string,
      sensitivity: row.sensitivity as InformationPolicyRecord['sensitivity'],
      sharing_mode: row.sharing_mode as InformationPolicyRecord['sharing_mode'],
      allowed_purposes: parseJsonValue<string[]>(row.allowed_purposes, []),
      retention_until: row.retention_until as string | null,
      created_by: row.created_by as string,
      change_note: row.change_note as string | null,
      created_at: row.created_at as string,
    };
  }
}

