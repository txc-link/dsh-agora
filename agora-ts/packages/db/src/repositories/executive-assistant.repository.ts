import { randomUUID } from 'node:crypto';
import type {
  CommitmentRecord,
  CommitmentStatus,
  ExecutiveRequestRecord,
  ExecutiveRequestStatus,
  IExecutiveAssistantRepository,
  InsertCommitmentInput,
  InsertExecutiveRequestInput,
} from '@agora-ts/contracts';
import type { AgoraDatabase } from '../database.js';
import { parseJsonValue, stringifyJsonValue } from './json.js';

function array(raw: unknown): string[] {
  const parsed = parseJsonValue<unknown>(raw, []);
  return Array.isArray(parsed) ? parsed.map(String) : [];
}

function metadata(raw: unknown): Record<string, unknown> | null {
  return parseJsonValue<Record<string, unknown> | null>(raw, null);
}

export class ExecutiveAssistantRepository implements IExecutiveAssistantRepository {
  constructor(private readonly db: AgoraDatabase) {}

  insertRequest(input: InsertExecutiveRequestInput): ExecutiveRequestRecord {
    const id = input.id ?? randomUUID();
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO executive_requests (
        id, organization_id, requested_by, title, body, priority, requested_capabilities, task_type,
        project_id, due_at, status, version, created_at, updated_at, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'received', 1, ?, ?, ?)
    `).run(
      id, input.organizationId, input.requestedBy, input.title, input.body, input.priority,
      stringifyJsonValue(input.requestedCapabilities), input.taskType, input.projectId ?? null, input.dueAt ?? null,
      now, now, stringifyJsonValue(input.metadata ?? null),
    );
    return this.requireRequest(id);
  }

  getRequest(requestId: string): ExecutiveRequestRecord | null {
    const row = this.db.prepare('SELECT * FROM executive_requests WHERE id = ?').get(requestId) as Record<string, unknown> | undefined;
    return row ? this.parseRequest(row) : null;
  }

  listRequests(organizationId: string, status?: ExecutiveRequestStatus): ExecutiveRequestRecord[] {
    const rows = (status
      ? this.db.prepare('SELECT * FROM executive_requests WHERE organization_id = ? AND status = ? ORDER BY created_at DESC, id DESC').all(organizationId, status)
      : this.db.prepare('SELECT * FROM executive_requests WHERE organization_id = ? ORDER BY created_at DESC, id DESC').all(organizationId)
    ) as Record<string, unknown>[];
    return rows.map((row) => this.parseRequest(row));
  }

  updateRequestRouting(
    requestId: string,
    input: { status: 'triage' | 'delegated'; assignedPositionId: string; assignedEmploymentId: string; taskId: string },
    expectedVersion: number,
  ): ExecutiveRequestRecord | null {
    const now = new Date().toISOString();
    const info = this.db.prepare(`
      UPDATE executive_requests
      SET status = ?, assigned_position_id = ?, assigned_employment_id = ?, task_id = ?, blocked_reason = NULL,
          version = version + 1, updated_at = ?
      WHERE id = ? AND version = ?
    `).run(input.status, input.assignedPositionId, input.assignedEmploymentId, input.taskId, now, requestId, expectedVersion);
    return info.changes > 0 ? this.getRequest(requestId) : null;
  }

  updateRequestStatus(
    requestId: string,
    status: ExecutiveRequestStatus,
    expectedVersion: number,
    blockedReason: string | null = null,
    completedAt: string | null = null,
  ): ExecutiveRequestRecord | null {
    const now = new Date().toISOString();
    const info = this.db.prepare(`
      UPDATE executive_requests
      SET status = ?, blocked_reason = ?, completed_at = ?, version = version + 1, updated_at = ?
      WHERE id = ? AND version = ?
    `).run(status, status === 'blocked' ? blockedReason : null, completedAt, now, requestId, expectedVersion);
    return info.changes > 0 ? this.getRequest(requestId) : null;
  }

  insertCommitment(input: InsertCommitmentInput): CommitmentRecord {
    const id = input.id ?? randomUUID();
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO commitments (
        id, organization_id, request_id, owner_position_id, owner_employment_id, task_id, summary, due_at,
        status, evidence_refs, version, created_at, updated_at, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', '[]', 1, ?, ?, ?)
    `).run(
      id, input.organizationId, input.requestId, input.ownerPositionId, input.ownerEmploymentId, input.taskId,
      input.summary, input.dueAt ?? null, now, now, stringifyJsonValue(input.metadata ?? null),
    );
    const record = this.getCommitmentByRequest(input.requestId);
    if (!record) throw new Error(`commitment '${id}' disappeared after write`);
    return record;
  }

  getCommitmentByRequest(requestId: string): CommitmentRecord | null {
    const row = this.db.prepare('SELECT * FROM commitments WHERE request_id = ?').get(requestId) as Record<string, unknown> | undefined;
    return row ? this.parseCommitment(row) : null;
  }

  listCommitments(organizationId: string, status?: CommitmentStatus): CommitmentRecord[] {
    const rows = (status
      ? this.db.prepare('SELECT * FROM commitments WHERE organization_id = ? AND status = ? ORDER BY created_at DESC, id DESC').all(organizationId, status)
      : this.db.prepare('SELECT * FROM commitments WHERE organization_id = ? ORDER BY created_at DESC, id DESC').all(organizationId)
    ) as Record<string, unknown>[];
    return rows.map((row) => this.parseCommitment(row));
  }

  updateCommitmentStatus(
    commitmentId: string,
    status: CommitmentStatus,
    expectedVersion: number,
    evidenceRefs: string[],
    fulfilledAt: string | null = null,
  ): CommitmentRecord | null {
    const now = new Date().toISOString();
    const info = this.db.prepare(`
      UPDATE commitments
      SET status = ?, evidence_refs = ?, fulfilled_at = ?, version = version + 1, updated_at = ?
      WHERE id = ? AND version = ?
    `).run(status, stringifyJsonValue(evidenceRefs), fulfilledAt, now, commitmentId, expectedVersion);
    if (info.changes === 0) return null;
    const row = this.db.prepare('SELECT * FROM commitments WHERE id = ?').get(commitmentId) as Record<string, unknown> | undefined;
    return row ? this.parseCommitment(row) : null;
  }

  private requireRequest(id: string): ExecutiveRequestRecord {
    const record = this.getRequest(id);
    if (!record) throw new Error(`executive request '${id}' disappeared after write`);
    return record;
  }

  private parseRequest(row: Record<string, unknown>): ExecutiveRequestRecord {
    return {
      id: String(row.id), organizationId: String(row.organization_id), requestedBy: String(row.requested_by),
      title: String(row.title), body: String(row.body), priority: String(row.priority) as ExecutiveRequestRecord['priority'],
      requestedCapabilities: array(row.requested_capabilities), taskType: String(row.task_type),
      projectId: row.project_id === null ? null : String(row.project_id), dueAt: row.due_at === null ? null : String(row.due_at),
      status: String(row.status) as ExecutiveRequestRecord['status'],
      assignedPositionId: row.assigned_position_id === null ? null : String(row.assigned_position_id),
      assignedEmploymentId: row.assigned_employment_id === null ? null : String(row.assigned_employment_id),
      taskId: row.task_id === null ? null : String(row.task_id), blockedReason: row.blocked_reason === null ? null : String(row.blocked_reason),
      version: Number(row.version), createdAt: String(row.created_at), updatedAt: String(row.updated_at),
      completedAt: row.completed_at === null ? null : String(row.completed_at), metadata: metadata(row.metadata),
    };
  }

  private parseCommitment(row: Record<string, unknown>): CommitmentRecord {
    return {
      id: String(row.id), organizationId: String(row.organization_id), requestId: String(row.request_id),
      ownerPositionId: String(row.owner_position_id), ownerEmploymentId: String(row.owner_employment_id), taskId: String(row.task_id),
      summary: String(row.summary), dueAt: row.due_at === null ? null : String(row.due_at),
      status: String(row.status) as CommitmentRecord['status'], evidenceRefs: array(row.evidence_refs), version: Number(row.version),
      createdAt: String(row.created_at), updatedAt: String(row.updated_at),
      fulfilledAt: row.fulfilled_at === null ? null : String(row.fulfilled_at), metadata: metadata(row.metadata),
    };
  }
}
