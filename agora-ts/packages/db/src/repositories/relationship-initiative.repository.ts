import {
  type ClaimRelationshipInitiativesInput,
  type IRelationshipInitiativeRepository,
  type RelationshipInitiativeRecord,
  type RelationshipInitiativeStatusDto,
  relationshipInitiativeModalitySchema,
  relationshipInitiativeStatusSchema,
  relationshipInitiativeTriggerSchema,
} from '@agora-ts/contracts';
import type { AgoraDatabase } from '../database.js';
import { parseJsonValue, stringifyJsonValue } from './json.js';

export class RelationshipInitiativeRepository implements IRelationshipInitiativeRepository {
  public constructor(private readonly db: AgoraDatabase) {}

  public insert(record: RelationshipInitiativeRecord): RelationshipInitiativeRecord {
    this.db.prepare(`
      INSERT INTO relationship_initiatives (
        id, profile_id, profile_version, owner_ref, agent_ref, trigger, modality, text,
        resource_ref, source_domain, target_domain, delivery_binding_ref, purpose,
        requested_fields, scheduled_for, schedule_local_date, status, consumer_ref,
        lease_token, lease_expires_at, attempt_count, last_error, delivered_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      record.id, record.profile_id, record.profile_version, record.owner_ref, record.agent_ref,
      record.trigger, record.modality, record.text, record.resource_ref, record.source_domain,
      record.target_domain, record.delivery_binding_ref, record.purpose,
      stringifyJsonValue(record.requested_fields), record.scheduled_for, record.schedule_local_date,
      record.status, record.consumer_ref, record.lease_token, record.lease_expires_at,
      record.attempt_count, record.last_error, record.delivered_at, record.created_at, record.updated_at,
    );
    return this.getById(record.id)!;
  }

  public getById(id: string): RelationshipInitiativeRecord | null {
    const row = this.db.prepare('SELECT * FROM relationship_initiatives WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? this.parse(row) : null;
  }

  public list(filters: { profile_id?: string; target_domain?: string; status?: RelationshipInitiativeStatusDto } = {}) {
    const clauses: string[] = [];
    const params: string[] = [];
    if (filters.profile_id) { clauses.push('profile_id = ?'); params.push(filters.profile_id); }
    if (filters.target_domain) { clauses.push('target_domain = ?'); params.push(filters.target_domain); }
    if (filters.status) { clauses.push('status = ?'); params.push(filters.status); }
    const where = clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '';
    const rows = this.db.prepare(`SELECT * FROM relationship_initiatives${where} ORDER BY scheduled_for, id`).all(...params) as Record<string, unknown>[];
    return rows.map((row) => this.parse(row));
  }

  public countForLocalDate(profileId: string, localDate: string): number {
    const row = this.db.prepare(`
      SELECT COUNT(*) AS count FROM relationship_initiatives
      WHERE profile_id = ? AND schedule_local_date = ? AND status != 'cancelled'
    `).get(profileId, localDate) as { count: number };
    return Number(row.count);
  }

  public claimDue(input: ClaimRelationshipInitiativesInput): RelationshipInitiativeRecord[] {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const rows = this.db.prepare(`
        SELECT id FROM relationship_initiatives
        WHERE target_domain = ? AND scheduled_for <= ?
          AND (status = 'scheduled' OR (status = 'claimed' AND lease_expires_at <= ?))
        ORDER BY scheduled_for, id LIMIT ?
      `).all(input.target_domain, input.now, input.now, input.limit) as Array<{ id: string }>;
      const claimed: RelationshipInitiativeRecord[] = [];
      for (const row of rows) {
        const leaseToken = input.lease_token_factory();
        this.db.prepare(`
          UPDATE relationship_initiatives
          SET status = 'claimed', consumer_ref = ?, lease_token = ?, lease_expires_at = ?,
              attempt_count = attempt_count + 1, updated_at = ?
          WHERE id = ?
        `).run(input.consumer_ref, leaseToken, input.lease_expires_at, input.now, row.id);
        const record = this.getById(row.id);
        if (record) claimed.push(record);
      }
      this.db.exec('COMMIT');
      return claimed;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  public markDelivered(id: string, leaseToken: string, deliveredAt: string) {
    const result = this.db.prepare(`
      UPDATE relationship_initiatives SET status = 'delivered', delivered_at = ?, updated_at = ?,
        lease_expires_at = NULL WHERE id = ? AND status = 'claimed' AND lease_token = ?
    `).run(deliveredAt, deliveredAt, id, leaseToken);
    return result.changes === 0 ? null : this.getById(id);
  }

  public markFailed(id: string, leaseToken: string, error: string, failedAt: string) {
    const result = this.db.prepare(`
      UPDATE relationship_initiatives SET status = 'failed', last_error = ?, updated_at = ?,
        lease_expires_at = NULL WHERE id = ? AND status = 'claimed' AND lease_token = ?
    `).run(error, failedAt, id, leaseToken);
    return result.changes === 0 ? null : this.getById(id);
  }

  public cancel(id: string, cancelledAt: string) {
    const result = this.db.prepare(`
      UPDATE relationship_initiatives SET status = 'cancelled', updated_at = ?
      WHERE id = ? AND status = 'scheduled'
    `).run(cancelledAt, id);
    return result.changes === 0 ? null : this.getById(id);
  }

  private parse(row: Record<string, unknown>): RelationshipInitiativeRecord {
    return {
      id: row.id as string,
      profile_id: row.profile_id as string,
      profile_version: Number(row.profile_version),
      owner_ref: row.owner_ref as string,
      agent_ref: row.agent_ref as string,
      trigger: relationshipInitiativeTriggerSchema.parse(row.trigger),
      modality: relationshipInitiativeModalitySchema.parse(row.modality),
      text: row.text as string,
      resource_ref: row.resource_ref as string,
      source_domain: row.source_domain as string,
      target_domain: row.target_domain as string,
      delivery_binding_ref: row.delivery_binding_ref as string,
      purpose: row.purpose as string,
      requested_fields: parseJsonValue(row.requested_fields, []) as string[],
      scheduled_for: row.scheduled_for as string,
      schedule_local_date: row.schedule_local_date as string,
      status: relationshipInitiativeStatusSchema.parse(row.status),
      consumer_ref: row.consumer_ref as string | null,
      lease_token: row.lease_token as string | null,
      lease_expires_at: row.lease_expires_at as string | null,
      attempt_count: Number(row.attempt_count),
      last_error: row.last_error as string | null,
      delivered_at: row.delivered_at as string | null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    };
  }
}

