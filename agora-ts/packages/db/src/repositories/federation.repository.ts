import { randomUUID } from 'node:crypto';
import {
  artifactSchema,
  memoryEntrySchema,
  mergeProposalSchema,
  runtimeNodeCredentialSchema,
  type ArtifactDto,
  type CreateArtifactRequestDto,
  type CreateMemoryEntryRequestDto,
  type CreateMergeProposalRequestDto,
  type MemoryEntryDto,
  type MemoryQueryDto,
  type MergeProposalDto,
  type RuntimeNodeCredentialDto,
  type RuntimeNodeCredentialScopeDto,
} from '@agora-ts/contracts';
import type { AgoraDatabase } from '../database.js';
import { parseJsonValue, stringifyJsonValue } from './json.js';

export class FederationRepository {
  constructor(private readonly db: AgoraDatabase) {}

  createArtifact(input: Omit<CreateArtifactRequestDto, 'content_base64'> & {
    sha256: string;
    size_bytes: number;
    content_uri: string;
  }, now = new Date()): ArtifactDto {
    const id = randomUUID();
    this.db.prepare(`
      INSERT INTO artifacts (id, name, kind, media_type, sha256, size_bytes, content_uri, owner_kind, owner_ref, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, input.name, input.kind, input.media_type, input.sha256, input.size_bytes, input.content_uri,
      input.owner_kind, input.owner_ref, input.metadata ? stringifyJsonValue(input.metadata) : null, now.toISOString());
    return this.getArtifact(id)!;
  }

  getArtifact(id: string): ArtifactDto | null {
    const row = this.db.prepare('SELECT * FROM artifacts WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? parseArtifact(row) : null;
  }

  listArtifacts(ownerKind?: string, ownerRef?: string, limit = 100): ArtifactDto[] {
    const rows = ownerKind && ownerRef
      ? this.db.prepare('SELECT * FROM artifacts WHERE owner_kind = ? AND owner_ref = ? ORDER BY created_at DESC LIMIT ?').all(ownerKind, ownerRef, limit)
      : this.db.prepare('SELECT * FROM artifacts ORDER BY created_at DESC LIMIT ?').all(limit);
    return (rows as Record<string, unknown>[]).map(parseArtifact);
  }

  updateArtifactMetadata(id: string, metadata: Record<string, unknown> | null): ArtifactDto | null {
    const result = this.db.prepare('UPDATE artifacts SET metadata = ? WHERE id = ?').run(
      metadata ? stringifyJsonValue(metadata) : null, id,
    );
    return Number(result.changes ?? 0) === 1 ? this.getArtifact(id) : null;
  }

  createMemory(input: CreateMemoryEntryRequestDto, now = new Date()): MemoryEntryDto {
    const id = randomUUID();
    const expiresAt = input.ttl_seconds ? new Date(now.getTime() + input.ttl_seconds * 1_000).toISOString() : null;
    this.db.prepare(`
      INSERT INTO memory_entries (
        id, scope, content, owner_ref, project_id, task_id, agent_ref, visibility,
        source, artifact_ids, evidence_ids, metadata, expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, input.scope, input.content, input.owner_ref, input.project_id ?? null, input.task_id ?? null,
      input.agent_ref ?? null, input.visibility, stringifyJsonValue(input.source), stringifyJsonValue(input.artifact_ids),
      stringifyJsonValue(input.evidence_ids), input.metadata ? stringifyJsonValue(input.metadata) : null,
      expiresAt, now.toISOString());
    return this.getMemory(id, now)!;
  }

  getMemory(id: string, now = new Date()): MemoryEntryDto | null {
    const row = this.db.prepare(`
      SELECT * FROM memory_entries WHERE id = ? AND (expires_at IS NULL OR expires_at > ?)
    `).get(id, now.toISOString()) as Record<string, unknown> | undefined;
    return row ? parseMemory(row) : null;
  }

  queryMemory(input: MemoryQueryDto, now = new Date()): MemoryEntryDto[] {
    const scopeClauses: string[] = [];
    const values: Array<string | number> = [];
    for (const scope of input.scopes) {
      if (scope === 'task') {
        if (input.task_id) { scopeClauses.push('(scope = ? AND task_id = ?)'); values.push(scope, input.task_id); }
        continue;
      }
      if (scope === 'agent_private') {
        if (input.agent_ref) { scopeClauses.push('(scope = ? AND agent_ref = ?)'); values.push(scope, input.agent_ref); }
        continue;
      }
      if (scope === 'project_shared') {
        if (input.project_id) { scopeClauses.push('(scope = ? AND project_id = ?)'); values.push(scope, input.project_id); }
        continue;
      }
      const access: string[] = ["visibility = 'shared'"];
      const accessValues: string[] = [];
      if (input.task_id) { access.push("(visibility = 'task' AND task_id = ?)"); accessValues.push(input.task_id); }
      if (input.project_id) { access.push("(visibility = 'project' AND project_id = ?)"); accessValues.push(input.project_id); }
      if (input.owner_ref) { access.push("(visibility = 'private' AND owner_ref = ?)"); accessValues.push(input.owner_ref); }
      scopeClauses.push(`(scope = ? AND (${access.join(' OR ')}))`);
      values.push(scope, ...accessValues);
    }
    if (scopeClauses.length === 0) return [];
    const clauses = [`(${scopeClauses.join(' OR ')})`, '(expires_at IS NULL OR expires_at > ?)'];
    values.push(now.toISOString());
    values.push(input.limit);
    const rows = this.db.prepare(`
      SELECT * FROM memory_entries WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC LIMIT ?
    `).all(...values) as Record<string, unknown>[];
    return rows.map(parseMemory);
  }

  createNodeCredential(input: {
    node_id: string;
    token_hash: string;
    scopes: RuntimeNodeCredentialScopeDto[];
    label: string | null;
    expires_at: string | null;
  }, now = new Date()): RuntimeNodeCredentialDto {
    const id = randomUUID();
    this.db.prepare(`
      INSERT INTO runtime_node_credentials (
        id, node_id, token_hash, scopes, label, status, created_at, expires_at,
        last_used_at, rotated_at, revoked_at
      ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, NULL, NULL, NULL)
    `).run(id, input.node_id, input.token_hash, stringifyJsonValue(input.scopes), input.label, now.toISOString(), input.expires_at);
    return this.getNodeCredential(id)!;
  }

  getNodeCredential(id: string): RuntimeNodeCredentialDto | null {
    const row = this.db.prepare('SELECT * FROM runtime_node_credentials WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? parseNodeCredential(row) : null;
  }

  findNodeCredentialByHash(tokenHash: string): (RuntimeNodeCredentialDto & { token_hash: string }) | null {
    const row = this.db.prepare('SELECT * FROM runtime_node_credentials WHERE token_hash = ?').get(tokenHash) as Record<string, unknown> | undefined;
    return row ? { ...parseNodeCredential(row), token_hash: String(row.token_hash) } : null;
  }

  listNodeCredentials(nodeId: string): RuntimeNodeCredentialDto[] {
    return (this.db.prepare('SELECT * FROM runtime_node_credentials WHERE node_id = ? ORDER BY created_at DESC').all(nodeId) as Record<string, unknown>[])
      .map(parseNodeCredential);
  }

  touchNodeCredential(id: string, now = new Date()): void {
    this.db.prepare('UPDATE runtime_node_credentials SET last_used_at = ? WHERE id = ?').run(now.toISOString(), id);
  }

  transitionNodeCredential(id: string, status: 'revoked' | 'rotated', now = new Date()): RuntimeNodeCredentialDto | null {
    const column = status === 'revoked' ? 'revoked_at' : 'rotated_at';
    this.db.prepare(`UPDATE runtime_node_credentials SET status = ?, ${column} = ? WHERE id = ? AND status = 'active'`)
      .run(status, now.toISOString(), id);
    return this.getNodeCredential(id);
  }

  createMergeProposal(input: CreateMergeProposalRequestDto, now = new Date()): MergeProposalDto {
    const id = randomUUID();
    const timestamp = now.toISOString();
    this.db.prepare(`
      INSERT INTO merge_proposals (
        id, task_id, project_id, base_revision, head_revision, worktree_path, diff_summary,
        validation_artifact_ids, requested_by, metadata, status, approved_by, decision_reason,
        merge_commit, error, created_at, updated_at, decided_at, merged_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'proposed', NULL, NULL, NULL, NULL, ?, ?, NULL, NULL)
    `).run(id, input.task_id, input.project_id, input.base_revision, input.head_revision, input.worktree_path,
      input.diff_summary, stringifyJsonValue(input.validation_artifact_ids), input.requested_by,
      input.metadata ? stringifyJsonValue(input.metadata) : null, timestamp, timestamp);
    return this.getMergeProposal(id)!;
  }

  getMergeProposal(id: string): MergeProposalDto | null {
    const row = this.db.prepare('SELECT * FROM merge_proposals WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? parseMergeProposal(row) : null;
  }

  listMergeProposals(projectId?: string, limit = 100): MergeProposalDto[] {
    const rows = projectId
      ? this.db.prepare('SELECT * FROM merge_proposals WHERE project_id = ? ORDER BY created_at DESC LIMIT ?').all(projectId, limit)
      : this.db.prepare('SELECT * FROM merge_proposals ORDER BY created_at DESC LIMIT ?').all(limit);
    return (rows as Record<string, unknown>[]).map(parseMergeProposal);
  }

  updateMergeProposal(id: string, patch: {
    status: MergeProposalDto['status'];
    approved_by?: string | null;
    decision_reason?: string | null;
    merge_commit?: string | null;
    error?: string | null;
    decided_at?: string | null;
    merged_at?: string | null;
  }, now = new Date()): MergeProposalDto {
    const current = this.getMergeProposal(id);
    if (!current) throw new Error(`Merge proposal ${id} not found`);
    this.db.prepare(`
      UPDATE merge_proposals
      SET status = ?, approved_by = ?, decision_reason = ?, merge_commit = ?, error = ?,
          decided_at = ?, merged_at = ?, updated_at = ?
      WHERE id = ?
    `).run(patch.status, patch.approved_by === undefined ? current.approved_by : patch.approved_by,
      patch.decision_reason === undefined ? current.decision_reason : patch.decision_reason,
      patch.merge_commit === undefined ? current.merge_commit : patch.merge_commit,
      patch.error === undefined ? current.error : patch.error,
      patch.decided_at === undefined ? current.decided_at : patch.decided_at,
      patch.merged_at === undefined ? current.merged_at : patch.merged_at, now.toISOString(), id);
    return this.getMergeProposal(id)!;
  }
}

function parseArtifact(row: Record<string, unknown>): ArtifactDto {
  return artifactSchema.parse({
    id: String(row.id), name: String(row.name), kind: String(row.kind), media_type: String(row.media_type),
    sha256: String(row.sha256), size_bytes: Number(row.size_bytes), content_uri: String(row.content_uri),
    owner_kind: String(row.owner_kind), owner_ref: String(row.owner_ref),
    metadata: row.metadata ? parseJsonValue(row.metadata, null) : null, created_at: String(row.created_at),
  });
}

function parseMemory(row: Record<string, unknown>): MemoryEntryDto {
  return memoryEntrySchema.parse({
    id: String(row.id), scope: String(row.scope), content: String(row.content), owner_ref: String(row.owner_ref),
    project_id: row.project_id === null ? null : String(row.project_id), task_id: row.task_id === null ? null : String(row.task_id),
    agent_ref: row.agent_ref === null ? null : String(row.agent_ref), visibility: String(row.visibility),
    source: parseJsonValue(row.source, {}), artifact_ids: parseJsonValue(row.artifact_ids, []), evidence_ids: parseJsonValue(row.evidence_ids, []),
    metadata: row.metadata ? parseJsonValue(row.metadata, null) : null,
    expires_at: row.expires_at === null ? null : String(row.expires_at), created_at: String(row.created_at),
  });
}

function parseNodeCredential(row: Record<string, unknown>): RuntimeNodeCredentialDto {
  return runtimeNodeCredentialSchema.parse({
    id: String(row.id), node_id: String(row.node_id), scopes: parseJsonValue(row.scopes, []),
    label: row.label === null ? null : String(row.label), status: String(row.status), created_at: String(row.created_at),
    expires_at: row.expires_at === null ? null : String(row.expires_at), last_used_at: row.last_used_at === null ? null : String(row.last_used_at),
    rotated_at: row.rotated_at === null ? null : String(row.rotated_at), revoked_at: row.revoked_at === null ? null : String(row.revoked_at),
  });
}

function parseMergeProposal(row: Record<string, unknown>): MergeProposalDto {
  return mergeProposalSchema.parse({
    id: String(row.id), task_id: String(row.task_id), project_id: String(row.project_id),
    base_revision: String(row.base_revision), head_revision: String(row.head_revision), worktree_path: String(row.worktree_path),
    diff_summary: String(row.diff_summary), validation_artifact_ids: parseJsonValue(row.validation_artifact_ids, []),
    requested_by: String(row.requested_by), metadata: row.metadata ? parseJsonValue(row.metadata, null) : null,
    status: String(row.status), approved_by: row.approved_by === null ? null : String(row.approved_by),
    decision_reason: row.decision_reason === null ? null : String(row.decision_reason),
    merge_commit: row.merge_commit === null ? null : String(row.merge_commit), error: row.error === null ? null : String(row.error),
    created_at: String(row.created_at), updated_at: String(row.updated_at),
    decided_at: row.decided_at === null ? null : String(row.decided_at), merged_at: row.merged_at === null ? null : String(row.merged_at),
  });
}
