import { randomUUID } from 'node:crypto';
import type {
  EmploymentRecord,
  EmploymentStatus,
  IOrganizationRepository,
  InsertEmploymentInput,
  InsertOrganizationInput,
  InsertOrganizationUnitInput,
  InsertPositionInput,
  OrganizationRecord,
  OrganizationUnitRecord,
  PositionRecord,
} from '@agora-ts/contracts';
import type { AgoraDatabase } from '../database.js';
import { parseJsonValue, stringifyJsonValue } from './json.js';

function stringArray(raw: unknown): string[] {
  const parsed = parseJsonValue<unknown>(raw, []);
  return Array.isArray(parsed) ? parsed.map(String) : [];
}

function metadata(raw: unknown): Record<string, unknown> | null {
  return parseJsonValue<Record<string, unknown> | null>(raw, null);
}

export class OrganizationRepository implements IOrganizationRepository {
  constructor(private readonly db: AgoraDatabase) {}

  insertOrganization(input: InsertOrganizationInput): OrganizationRecord {
    const id = input.id ?? randomUUID();
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO organizations (
        id, slug, name, owner_ref, information_domain, purpose, status, version, created_at, updated_at, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, 'active', 1, ?, ?, ?)
    `).run(
      id, input.slug, input.name, input.ownerRef, input.informationDomain, input.purpose ?? null,
      now, now, stringifyJsonValue(input.metadata ?? null),
    );
    return this.requireOrganization(id);
  }

  getOrganization(organizationId: string): OrganizationRecord | null {
    const row = this.db.prepare('SELECT * FROM organizations WHERE id = ?').get(organizationId) as Record<string, unknown> | undefined;
    return row ? this.parseOrganization(row) : null;
  }

  getOrganizationBySlug(slug: string): OrganizationRecord | null {
    const row = this.db.prepare('SELECT * FROM organizations WHERE slug = ?').get(slug) as Record<string, unknown> | undefined;
    return row ? this.parseOrganization(row) : null;
  }

  listOrganizations(): OrganizationRecord[] {
    const rows = this.db.prepare('SELECT * FROM organizations ORDER BY created_at ASC, id ASC').all() as Record<string, unknown>[];
    return rows.map((row) => this.parseOrganization(row));
  }

  insertUnit(input: InsertOrganizationUnitInput): OrganizationUnitRecord {
    const id = input.id ?? randomUUID();
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO organization_units (
        id, organization_id, name, kind, parent_unit_id, responsibilities, status, version, created_at, updated_at, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, 'active', 1, ?, ?, ?)
    `).run(
      id, input.organizationId, input.name, input.kind, input.parentUnitId ?? null,
      stringifyJsonValue(input.responsibilities ?? []), now, now, stringifyJsonValue(input.metadata ?? null),
    );
    return this.requireUnit(id);
  }

  getUnit(unitId: string): OrganizationUnitRecord | null {
    const row = this.db.prepare('SELECT * FROM organization_units WHERE id = ?').get(unitId) as Record<string, unknown> | undefined;
    return row ? this.parseUnit(row) : null;
  }

  listUnits(organizationId: string): OrganizationUnitRecord[] {
    const rows = this.db.prepare(
      'SELECT * FROM organization_units WHERE organization_id = ? ORDER BY created_at ASC, id ASC',
    ).all(organizationId) as Record<string, unknown>[];
    return rows.map((row) => this.parseUnit(row));
  }

  updateUnitParent(unitId: string, parentUnitId: string | null, expectedVersion: number): OrganizationUnitRecord | null {
    const now = new Date().toISOString();
    const info = this.db.prepare(`
      UPDATE organization_units
      SET parent_unit_id = ?, version = version + 1, updated_at = ?
      WHERE id = ? AND version = ?
    `).run(parentUnitId, now, unitId, expectedVersion);
    return info.changes > 0 ? this.getUnit(unitId) : null;
  }

  insertPosition(input: InsertPositionInput): PositionRecord {
    const id = input.id ?? randomUUID();
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO organization_positions (
        id, organization_id, unit_id, title, kind, reports_to_position_id, responsibilities, skills,
        status, version, created_at, updated_at, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', 1, ?, ?, ?)
    `).run(
      id, input.organizationId, input.unitId, input.title, input.kind, input.reportsToPositionId ?? null,
      stringifyJsonValue(input.responsibilities ?? []), stringifyJsonValue(input.skills ?? []),
      now, now, stringifyJsonValue(input.metadata ?? null),
    );
    return this.requirePosition(id);
  }

  getPosition(positionId: string): PositionRecord | null {
    const row = this.db.prepare('SELECT * FROM organization_positions WHERE id = ?').get(positionId) as Record<string, unknown> | undefined;
    return row ? this.parsePosition(row) : null;
  }

  listPositions(organizationId: string): PositionRecord[] {
    const rows = this.db.prepare(
      'SELECT * FROM organization_positions WHERE organization_id = ? ORDER BY created_at ASC, id ASC',
    ).all(organizationId) as Record<string, unknown>[];
    return rows.map((row) => this.parsePosition(row));
  }

  updatePositionManager(
    positionId: string,
    reportsToPositionId: string | null,
    expectedVersion: number,
  ): PositionRecord | null {
    const now = new Date().toISOString();
    const info = this.db.prepare(`
      UPDATE organization_positions
      SET reports_to_position_id = ?, version = version + 1, updated_at = ?
      WHERE id = ? AND version = ?
    `).run(reportsToPositionId, now, positionId, expectedVersion);
    return info.changes > 0 ? this.getPosition(positionId) : null;
  }

  insertEmployment(input: InsertEmploymentInput): EmploymentRecord {
    const id = input.id ?? randomUUID();
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO organization_employments (
        id, organization_id, position_id, subject_kind, subject_ref, employment_kind, status,
        started_at, ended_at, ended_reason, version, created_at, updated_at, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, NULL, NULL, 1, ?, ?, ?)
    `).run(
      id, input.organizationId, input.positionId, input.subjectKind, input.subjectRef, input.employmentKind,
      input.startedAt, now, now, stringifyJsonValue(input.metadata ?? null),
    );
    return this.requireEmployment(id);
  }

  getEmployment(employmentId: string): EmploymentRecord | null {
    const row = this.db.prepare('SELECT * FROM organization_employments WHERE id = ?').get(employmentId) as Record<string, unknown> | undefined;
    return row ? this.parseEmployment(row) : null;
  }

  getCurrentEmploymentByPosition(positionId: string): EmploymentRecord | null {
    const row = this.db.prepare(`
      SELECT * FROM organization_employments
      WHERE position_id = ? AND status IN ('active', 'suspended')
      ORDER BY started_at DESC, id DESC LIMIT 1
    `).get(positionId) as Record<string, unknown> | undefined;
    return row ? this.parseEmployment(row) : null;
  }

  listEmployments(organizationId: string, includeEnded = true): EmploymentRecord[] {
    const rows = (includeEnded
      ? this.db.prepare('SELECT * FROM organization_employments WHERE organization_id = ? ORDER BY started_at ASC, id ASC').all(organizationId)
      : this.db.prepare("SELECT * FROM organization_employments WHERE organization_id = ? AND status != 'ended' ORDER BY started_at ASC, id ASC").all(organizationId)
    ) as Record<string, unknown>[];
    return rows.map((row) => this.parseEmployment(row));
  }

  updateEmploymentStatus(
    employmentId: string,
    status: EmploymentStatus,
    expectedVersion: number,
    endedAt: string | null = null,
    endedReason: string | null = null,
  ): EmploymentRecord | null {
    const now = new Date().toISOString();
    const info = this.db.prepare(`
      UPDATE organization_employments
      SET status = ?, ended_at = ?, ended_reason = ?, version = version + 1, updated_at = ?
      WHERE id = ? AND version = ?
    `).run(status, status === 'ended' ? endedAt : null, status === 'ended' ? endedReason : null, now, employmentId, expectedVersion);
    return info.changes > 0 ? this.getEmployment(employmentId) : null;
  }

  private requireOrganization(id: string): OrganizationRecord {
    const record = this.getOrganization(id);
    if (!record) throw new Error(`organization '${id}' disappeared after write`);
    return record;
  }

  private requireUnit(id: string): OrganizationUnitRecord {
    const record = this.getUnit(id);
    if (!record) throw new Error(`organization unit '${id}' disappeared after write`);
    return record;
  }

  private requirePosition(id: string): PositionRecord {
    const record = this.getPosition(id);
    if (!record) throw new Error(`organization position '${id}' disappeared after write`);
    return record;
  }

  private requireEmployment(id: string): EmploymentRecord {
    const record = this.getEmployment(id);
    if (!record) throw new Error(`employment '${id}' disappeared after write`);
    return record;
  }

  private parseOrganization(row: Record<string, unknown>): OrganizationRecord {
    return {
      id: String(row.id), slug: String(row.slug), name: String(row.name), ownerRef: String(row.owner_ref),
      informationDomain: String(row.information_domain), purpose: row.purpose === null ? null : String(row.purpose),
      status: String(row.status) as OrganizationRecord['status'], version: Number(row.version),
      createdAt: String(row.created_at), updatedAt: String(row.updated_at), metadata: metadata(row.metadata),
    };
  }

  private parseUnit(row: Record<string, unknown>): OrganizationUnitRecord {
    return {
      id: String(row.id), organizationId: String(row.organization_id), name: String(row.name),
      kind: String(row.kind) as OrganizationUnitRecord['kind'],
      parentUnitId: row.parent_unit_id === null ? null : String(row.parent_unit_id),
      responsibilities: stringArray(row.responsibilities), status: String(row.status) as OrganizationUnitRecord['status'],
      version: Number(row.version), createdAt: String(row.created_at), updatedAt: String(row.updated_at), metadata: metadata(row.metadata),
    };
  }

  private parsePosition(row: Record<string, unknown>): PositionRecord {
    return {
      id: String(row.id), organizationId: String(row.organization_id), unitId: String(row.unit_id), title: String(row.title),
      kind: String(row.kind) as PositionRecord['kind'],
      reportsToPositionId: row.reports_to_position_id === null ? null : String(row.reports_to_position_id),
      responsibilities: stringArray(row.responsibilities), skills: stringArray(row.skills),
      status: String(row.status) as PositionRecord['status'], version: Number(row.version),
      createdAt: String(row.created_at), updatedAt: String(row.updated_at), metadata: metadata(row.metadata),
    };
  }

  private parseEmployment(row: Record<string, unknown>): EmploymentRecord {
    return {
      id: String(row.id), organizationId: String(row.organization_id), positionId: String(row.position_id),
      subjectKind: String(row.subject_kind) as EmploymentRecord['subjectKind'], subjectRef: String(row.subject_ref),
      employmentKind: String(row.employment_kind) as EmploymentRecord['employmentKind'],
      status: String(row.status) as EmploymentRecord['status'], startedAt: String(row.started_at),
      endedAt: row.ended_at === null ? null : String(row.ended_at),
      endedReason: row.ended_reason === null ? null : String(row.ended_reason), version: Number(row.version),
      createdAt: String(row.created_at), updatedAt: String(row.updated_at), metadata: metadata(row.metadata),
    };
  }
}
