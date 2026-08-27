import { randomUUID } from 'node:crypto';
import {
  type CompleteRuntimeNodeDispatchRequestDto,
  type CreateRuntimeNodeDispatchRequestDto,
  type RuntimeNodeDispatchDto,
  type RuntimeNodeDto,
  type RuntimeNodeHeartbeatRequestDto,
  runtimeNodeDispatchSchema,
  runtimeNodeSchema,
} from '@agora-ts/contracts';
import type { AgoraDatabase } from '../database.js';
import { parseJsonValue, stringifyJsonValue } from './json.js';

export class RuntimeNodeRepository {
  constructor(private readonly db: AgoraDatabase) {}

  upsertNode(nodeId: string, input: RuntimeNodeHeartbeatRequestDto, now = new Date()): RuntimeNodeDto {
    const seenAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + input.lease_seconds * 1_000).toISOString();
    this.db.prepare(`
      INSERT INTO runtime_nodes (
        node_id, protocol, instance_id, plugin_version, host_framework,
        runtime_provider, agents, bots, capacity, lease_seconds, metadata,
        registered_at, last_seen_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(node_id) DO UPDATE SET
        protocol = excluded.protocol,
        instance_id = excluded.instance_id,
        plugin_version = excluded.plugin_version,
        host_framework = excluded.host_framework,
        runtime_provider = excluded.runtime_provider,
        agents = excluded.agents,
        bots = excluded.bots,
        capacity = excluded.capacity,
        lease_seconds = excluded.lease_seconds,
        metadata = excluded.metadata,
        last_seen_at = excluded.last_seen_at,
        expires_at = excluded.expires_at
    `).run(
      nodeId,
      input.protocol,
      input.instance_id,
      input.plugin_version,
      input.host_framework,
      input.runtime_provider,
      stringifyJsonValue(input.agents),
      stringifyJsonValue(input.bots),
      stringifyJsonValue(input.capacity),
      input.lease_seconds,
      stringifyJsonValue(input.metadata ?? null),
      seenAt,
      seenAt,
      expiresAt,
    );
    return this.getNode(nodeId, now)!;
  }

  getNode(nodeId: string, now = new Date()): RuntimeNodeDto | null {
    const row = this.db.prepare('SELECT * FROM runtime_nodes WHERE node_id = ?').get(nodeId) as Record<string, unknown> | undefined;
    return row ? this.parseNode(row, now) : null;
  }

  listNodes(now = new Date()): RuntimeNodeDto[] {
    const rows = this.db.prepare('SELECT * FROM runtime_nodes ORDER BY node_id ASC').all() as Record<string, unknown>[];
    return rows.map((row) => this.parseNode(row, now));
  }

  deleteNode(nodeId: string): boolean {
    const result = this.db.prepare('DELETE FROM runtime_nodes WHERE node_id = ?').run(nodeId);
    return Number(result.changes ?? 0) > 0;
  }

  createDispatch(nodeId: string, input: CreateRuntimeNodeDispatchRequestDto, now = new Date()): RuntimeNodeDispatchDto {
    const existing = this.db.prepare(
      'SELECT * FROM runtime_node_dispatches WHERE idempotency_key = ?',
    ).get(input.idempotency_key) as Record<string, unknown> | undefined;
    if (existing) return this.parseDispatch(existing);

    const id = `dispatch-${randomUUID()}`;
    const timestamp = now.toISOString();
    this.db.prepare(`
      INSERT INTO runtime_node_dispatches (
        id, node_id, task_id, participant_binding_id, runtime_target_ref,
        session_id, workspace_alias, agent_preset, prompt, idempotency_key,
        metadata, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `).run(
      id,
      nodeId,
      input.task_id ?? null,
      input.participant_binding_id ?? null,
      input.runtime_target_ref,
      input.session_id ?? null,
      input.workspace_alias ?? null,
      input.agent_preset ?? null,
      input.prompt,
      input.idempotency_key,
      stringifyJsonValue(input.metadata ?? null),
      timestamp,
      timestamp,
    );
    return this.getDispatch(id)!;
  }

  getDispatch(dispatchId: string): RuntimeNodeDispatchDto | null {
    const row = this.db.prepare(
      'SELECT * FROM runtime_node_dispatches WHERE id = ?',
    ).get(dispatchId) as Record<string, unknown> | undefined;
    return row ? this.parseDispatch(row) : null;
  }

  listDispatches(nodeId: string, limit = 100): RuntimeNodeDispatchDto[] {
    const rows = this.db.prepare(`
      SELECT * FROM runtime_node_dispatches
      WHERE node_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(nodeId, limit) as Record<string, unknown>[];
    return rows.map((row) => this.parseDispatch(row));
  }

  claimDispatch(nodeId: string, instanceId: string, leaseSeconds: number, now = new Date()): RuntimeNodeDispatchDto | null {
    const timestamp = now.toISOString();
    const expiresAt = new Date(now.getTime() + leaseSeconds * 1_000).toISOString();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare(`
        UPDATE runtime_node_dispatches
        SET status = 'pending', claimed_by = NULL, claim_expires_at = NULL, updated_at = ?
        WHERE node_id = ? AND status = 'claimed' AND claim_expires_at <= ?
      `).run(timestamp, nodeId, timestamp);
      const row = this.db.prepare(`
        SELECT id FROM runtime_node_dispatches
        WHERE node_id = ? AND status = 'pending'
        ORDER BY created_at ASC
        LIMIT 1
      `).get(nodeId) as { id: string } | undefined;
      if (!row) {
        this.db.exec('COMMIT');
        return null;
      }
      this.db.prepare(`
        UPDATE runtime_node_dispatches
        SET status = 'claimed', claimed_by = ?, claim_expires_at = ?, updated_at = ?
        WHERE id = ? AND status = 'pending'
      `).run(instanceId, expiresAt, timestamp, row.id);
      this.db.exec('COMMIT');
      return this.getDispatch(row.id);
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  completeDispatch(
    nodeId: string,
    dispatchId: string,
    input: CompleteRuntimeNodeDispatchRequestDto,
    now = new Date(),
  ): RuntimeNodeDispatchDto | null {
    const existing = this.getDispatch(dispatchId);
    if (!existing || existing.node_id !== nodeId) return null;
    if (existing.status === 'completed' || existing.status === 'failed') return existing;
    if (existing.status !== 'claimed' || existing.claimed_by !== input.instance_id) return null;
    const timestamp = now.toISOString();
    this.db.prepare(`
      UPDATE runtime_node_dispatches
      SET status = ?, session_id = COALESCE(?, session_id), result = ?, error = ?,
          completed_at = ?, updated_at = ?, claim_expires_at = NULL
      WHERE id = ? AND node_id = ? AND claimed_by = ? AND status = 'claimed'
    `).run(
      input.status,
      input.session_id ?? null,
      stringifyJsonValue(input.result ?? null),
      input.error ?? null,
      timestamp,
      timestamp,
      dispatchId,
      nodeId,
      input.instance_id,
    );
    return this.getDispatch(dispatchId);
  }

  private parseNode(row: Record<string, unknown>, now: Date): RuntimeNodeDto {
    return runtimeNodeSchema.parse({
      node_id: String(row.node_id),
      protocol: String(row.protocol),
      instance_id: String(row.instance_id),
      plugin_version: String(row.plugin_version),
      host_framework: String(row.host_framework),
      runtime_provider: String(row.runtime_provider),
      agents: parseJsonValue(row.agents, []),
      bots: parseJsonValue(row.bots, []),
      capacity: parseJsonValue(row.capacity, { max_concurrent: 1, active: 0 }),
      lease_seconds: Number(row.lease_seconds),
      metadata: row.metadata ? parseJsonValue(row.metadata, null) : null,
      presence: new Date(String(row.expires_at)).getTime() > now.getTime() ? 'online' : 'stale',
      registered_at: String(row.registered_at),
      last_seen_at: String(row.last_seen_at),
      expires_at: String(row.expires_at),
    });
  }

  private parseDispatch(row: Record<string, unknown>): RuntimeNodeDispatchDto {
    return runtimeNodeDispatchSchema.parse({
      id: String(row.id),
      node_id: String(row.node_id),
      task_id: row.task_id === null ? null : String(row.task_id),
      participant_binding_id: row.participant_binding_id === null ? null : String(row.participant_binding_id),
      runtime_target_ref: String(row.runtime_target_ref),
      session_id: row.session_id === null ? null : String(row.session_id),
      workspace_alias: row.workspace_alias === null ? null : String(row.workspace_alias),
      agent_preset: row.agent_preset === null ? null : String(row.agent_preset),
      prompt: String(row.prompt),
      idempotency_key: String(row.idempotency_key),
      metadata: row.metadata ? parseJsonValue(row.metadata, null) : null,
      status: String(row.status),
      claimed_by: row.claimed_by === null ? null : String(row.claimed_by),
      claim_expires_at: row.claim_expires_at === null ? null : String(row.claim_expires_at),
      result: row.result ? parseJsonValue(row.result, null) : null,
      error: row.error === null ? null : String(row.error),
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
      completed_at: row.completed_at === null ? null : String(row.completed_at),
    });
  }
}
