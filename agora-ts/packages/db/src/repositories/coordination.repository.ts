import { randomUUID } from 'node:crypto';
import {
  coordinationMemberSchema,
  coordinationRunSchema,
  coordinationScorecardSchema,
  runtimeUsageSchema,
  type CoordinationMemberDto,
  type CoordinationMemberRoleDto,
  type CoordinationMemberStatusDto,
  type CoordinationRunDto,
  type CoordinationRunStatusDto,
  type CoordinationScorecardDto,
  type CoordinationSynthesisDto,
  type CreateCoordinationRunRequestDto,
  type RuntimeResultEnvelopeDto,
  type RuntimeUsageDto,
} from '@agora-ts/contracts';
import type { AgoraDatabase } from '../database.js';
import { parseJsonValue, stringifyJsonValue } from './json.js';

const EMPTY_USAGE: RuntimeUsageDto = runtimeUsageSchema.parse({});

export interface CreateCoordinationMemberInput {
  run_id: string;
  dispatch_id: string;
  runtime_target_ref: string;
  role: CoordinationMemberRoleDto;
  round: number;
  selection_score: number;
  selection_reason: string[];
}

export interface RuntimeAgentObservationInput {
  member_id: string;
  runtime_target_ref: string;
  task_type: string;
  outcome: CoordinationMemberStatusDto;
  retry_count: number;
  timed_out: boolean;
  duration_ms: number | null;
  evidence_count: number;
  claim_count: number;
  verifier_accepted: boolean | null;
  agreement_ratio: number | null;
  information_gain: number | null;
  environment_drift: boolean;
  total_tokens: number | null;
  cost_usd: number | null;
}

export class CoordinationRepository {
  constructor(private readonly db: AgoraDatabase) {}

  createRun(input: CreateCoordinationRunRequestDto, now = new Date()): CoordinationRunDto {
    const existing = this.getRunByIdempotencyKey(input.idempotency_key);
    if (existing) return existing;
    const id = randomUUID();
    const timestamp = now.toISOString();
    const deadlineAt = new Date(now.getTime() + input.budget.max_wall_clock_seconds * 1_000).toISOString();
    this.db.prepare(`
      INSERT INTO coordination_runs (
        id, task_id, task_type, prompt, mode, status, candidates, verifier_target_ref,
        budget, usage, memory_scopes, idempotency_key, metadata, synthesis, stop_reason,
        deadline_at, created_at, updated_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, 'running', ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, NULL)
    `).run(
      id,
      input.task_id ?? null,
      input.task_type,
      input.prompt,
      input.mode,
      stringifyJsonValue(input.candidates),
      input.verifier_target_ref ?? null,
      stringifyJsonValue(input.budget),
      stringifyJsonValue(EMPTY_USAGE),
      stringifyJsonValue(input.memory_scopes),
      input.idempotency_key,
      input.metadata ? stringifyJsonValue(input.metadata) : null,
      deadlineAt,
      timestamp,
      timestamp,
    );
    return this.getRun(id)!;
  }

  getRun(id: string): CoordinationRunDto | null {
    const row = this.db.prepare('SELECT * FROM coordination_runs WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? this.parseRun(row) : null;
  }

  getRunByIdempotencyKey(key: string): CoordinationRunDto | null {
    const row = this.db.prepare('SELECT * FROM coordination_runs WHERE idempotency_key = ?').get(key) as Record<string, unknown> | undefined;
    return row ? this.parseRun(row) : null;
  }

  listRuns(status?: CoordinationRunStatusDto, limit = 100): CoordinationRunDto[] {
    const rows = (status
      ? this.db.prepare('SELECT * FROM coordination_runs WHERE status = ? ORDER BY created_at DESC LIMIT ?').all(status, limit)
      : this.db.prepare('SELECT * FROM coordination_runs ORDER BY created_at DESC LIMIT ?').all(limit)) as Record<string, unknown>[];
    return rows.map(row => this.parseRun(row));
  }

  listActiveRuns(): CoordinationRunDto[] {
    const rows = this.db.prepare(`
      SELECT * FROM coordination_runs
      WHERE status IN ('running', 'verifying')
      ORDER BY updated_at ASC
    `).all() as Record<string, unknown>[];
    return rows.map(row => this.parseRun(row));
  }

  addMember(input: CreateCoordinationMemberInput, now = new Date()): CoordinationMemberDto {
    const id = randomUUID();
    const timestamp = now.toISOString();
    this.db.prepare(`
      INSERT INTO coordination_members (
        id, run_id, dispatch_id, runtime_target_ref, role, round, status,
        selection_score, selection_reason, result_envelope, usage,
        observation_recorded_at, created_at, updated_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'dispatched', ?, ?, NULL, NULL, NULL, ?, ?, NULL)
    `).run(
      id,
      input.run_id,
      input.dispatch_id,
      input.runtime_target_ref,
      input.role,
      input.round,
      input.selection_score,
      stringifyJsonValue(input.selection_reason),
      timestamp,
      timestamp,
    );
    return this.getMember(id)!;
  }

  getMember(id: string): CoordinationMemberDto | null {
    const row = this.db.prepare('SELECT * FROM coordination_members WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? this.parseMember(row) : null;
  }

  updateMember(
    id: string,
    input: {
      status: CoordinationMemberStatusDto;
      result_envelope?: RuntimeResultEnvelopeDto | null;
      usage?: RuntimeUsageDto | null;
      completed_at?: string | null;
    },
    now = new Date(),
  ): CoordinationMemberDto {
    this.db.prepare(`
      UPDATE coordination_members
      SET status = ?, result_envelope = ?, usage = ?, completed_at = ?, updated_at = ?
      WHERE id = ?
    `).run(
      input.status,
      input.result_envelope ? stringifyJsonValue(input.result_envelope) : null,
      input.usage ? stringifyJsonValue(input.usage) : null,
      input.completed_at ?? null,
      now.toISOString(),
      id,
    );
    return this.getMember(id)!;
  }

  updateRun(
    id: string,
    input: {
      status: CoordinationRunStatusDto;
      usage?: RuntimeUsageDto;
      synthesis?: CoordinationSynthesisDto | null;
      stop_reason?: string | null;
      completed_at?: string | null;
    },
    now = new Date(),
  ): CoordinationRunDto {
    const current = this.getRun(id);
    if (!current) throw new Error(`Coordination run ${id} not found`);
    this.db.prepare(`
      UPDATE coordination_runs
      SET status = ?, usage = ?, synthesis = ?, stop_reason = ?, completed_at = ?, updated_at = ?
      WHERE id = ?
    `).run(
      input.status,
      stringifyJsonValue(input.usage ?? current.usage),
      input.synthesis === undefined
        ? (current.synthesis ? stringifyJsonValue(current.synthesis) : null)
        : (input.synthesis ? stringifyJsonValue(input.synthesis) : null),
      input.stop_reason === undefined ? current.stop_reason : input.stop_reason,
      input.completed_at === undefined ? current.completed_at : input.completed_at,
      now.toISOString(),
      id,
    );
    return this.getRun(id)!;
  }

  markObservationRecorded(memberId: string, now = new Date()): void {
    this.db.prepare(`
      UPDATE coordination_members SET observation_recorded_at = ?, updated_at = ? WHERE id = ?
    `).run(now.toISOString(), now.toISOString(), memberId);
  }

  recordObservation(input: RuntimeAgentObservationInput, now = new Date()): void {
    this.db.prepare(`
      INSERT OR IGNORE INTO runtime_agent_observations (
        id, member_id, runtime_target_ref, task_type, outcome, retry_count, timed_out,
        duration_ms, evidence_count, claim_count, verifier_accepted, agreement_ratio,
        information_gain, environment_drift, total_tokens, cost_usd, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(), input.member_id, input.runtime_target_ref, input.task_type, input.outcome,
      input.retry_count, input.timed_out ? 1 : 0, input.duration_ms, input.evidence_count,
      input.claim_count, booleanSql(input.verifier_accepted), input.agreement_ratio,
      input.information_gain, input.environment_drift ? 1 : 0, input.total_tokens,
      input.cost_usd, now.toISOString(),
    );
  }

  listScorecards(runtimeTargetRef?: string, taskType?: string): CoordinationScorecardDto[] {
    const clauses: string[] = [];
    const values: string[] = [];
    if (runtimeTargetRef) { clauses.push('runtime_target_ref = ?'); values.push(runtimeTargetRef); }
    if (taskType) { clauses.push('task_type = ?'); values.push(taskType); }
    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = this.db.prepare(`
      SELECT * FROM runtime_agent_observations ${where}
      ORDER BY created_at ASC
    `).all(...values) as Record<string, unknown>[];
    const groups = new Map<string, Record<string, unknown>[]>();
    for (const row of rows) {
      const key = `${String(row.runtime_target_ref)}\u0000${String(row.task_type)}`;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    return [...groups.values()].map(group => scorecardFrom(group)).sort((left, right) => (
      right.score - left.score || left.runtime_target_ref.localeCompare(right.runtime_target_ref)
    ));
  }

  private listMembers(runId: string): CoordinationMemberDto[] {
    const rows = this.db.prepare(`
      SELECT * FROM coordination_members WHERE run_id = ? ORDER BY round ASC, created_at ASC
    `).all(runId) as Record<string, unknown>[];
    return rows.map(row => this.parseMember(row));
  }

  private parseRun(row: Record<string, unknown>): CoordinationRunDto {
    return coordinationRunSchema.parse({
      id: String(row.id),
      task_id: row.task_id === null ? null : String(row.task_id),
      task_type: String(row.task_type),
      prompt: String(row.prompt),
      mode: String(row.mode),
      status: String(row.status),
      candidates: parseJsonValue(row.candidates, []),
      verifier_target_ref: row.verifier_target_ref === null ? null : String(row.verifier_target_ref),
      budget: parseJsonValue(row.budget, {}),
      usage: parseJsonValue(row.usage, EMPTY_USAGE),
      memory_scopes: parseJsonValue(row.memory_scopes, []),
      idempotency_key: String(row.idempotency_key),
      metadata: row.metadata ? parseJsonValue(row.metadata, null) : null,
      synthesis: row.synthesis ? parseJsonValue(row.synthesis, null) : null,
      stop_reason: row.stop_reason === null ? null : String(row.stop_reason),
      deadline_at: String(row.deadline_at),
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
      completed_at: row.completed_at === null ? null : String(row.completed_at),
      members: this.listMembers(String(row.id)),
    });
  }

  private parseMember(row: Record<string, unknown>): CoordinationMemberDto {
    return coordinationMemberSchema.parse({
      id: String(row.id),
      run_id: String(row.run_id),
      dispatch_id: String(row.dispatch_id),
      runtime_target_ref: String(row.runtime_target_ref),
      role: String(row.role),
      round: Number(row.round),
      status: String(row.status),
      selection_score: Number(row.selection_score),
      selection_reason: parseJsonValue(row.selection_reason, []),
      result_envelope: row.result_envelope ? parseJsonValue(row.result_envelope, null) : null,
      usage: row.usage ? parseJsonValue(row.usage, null) : null,
      observation_recorded_at: row.observation_recorded_at === null ? null : String(row.observation_recorded_at),
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
      completed_at: row.completed_at === null ? null : String(row.completed_at),
    });
  }
}

function scorecardFrom(rows: Record<string, unknown>[]): CoordinationScorecardDto {
  const durations = rows.map(row => nullableNumber(row.duration_ms)).filter((value): value is number => value !== null).sort((a, b) => a - b);
  const verifier = rows.map(row => nullableBoolean(row.verifier_accepted)).filter((value): value is boolean => value !== null);
  const agreements = rows.map(row => nullableNumber(row.agreement_ratio)).filter((value): value is number => value !== null);
  const gains = rows.map(row => nullableNumber(row.information_gain)).filter((value): value is number => value !== null);
  const successRate = ratio(rows.filter(row => row.outcome === 'completed').length, rows.length);
  const verifierRate = booleanRate(verifier);
  const agreementRate = average(agreements);
  const informationRate = average(gains);
  const driftRate = ratio(rows.filter(row => Number(row.environment_drift) === 1).length, rows.length);
  const evidenceYield = average(rows.map(row => Number(row.evidence_count)));
  const score = clamp(
    (successRate ?? 0.5) * 45
      + (verifierRate ?? 0.5) * 15
      + (agreementRate ?? 0.5) * 10
      + (informationRate ?? 0.5) * 15
      + Math.min((evidenceYield ?? 0) / 5, 1) * 10
      + (1 - (driftRate ?? 0)) * 5,
    0,
    100,
  );
  const totalTokens = nullableSum(rows.map(row => nullableNumber(row.total_tokens)));
  const totalCost = nullableSum(rows.map(row => nullableNumber(row.cost_usd)));
  return coordinationScorecardSchema.parse({
    runtime_target_ref: String(rows[0]!.runtime_target_ref),
    task_type: String(rows[0]!.task_type),
    observations: rows.length,
    success_rate: successRate,
    failure_rate: ratio(rows.filter(row => row.outcome === 'failed').length, rows.length),
    cancellation_rate: ratio(rows.filter(row => row.outcome === 'cancelled').length, rows.length),
    retry_rate: ratio(rows.filter(row => Number(row.retry_count) > 0).length, rows.length),
    timeout_rate: ratio(rows.filter(row => Number(row.timed_out) === 1).length, rows.length),
    median_duration_ms: percentile(durations, 0.5),
    p95_duration_ms: percentile(durations, 0.95),
    evidence_yield: evidenceYield,
    verifier_acceptance_rate: verifierRate,
    agreement_rate: agreementRate,
    unique_information_rate: informationRate,
    environment_drift_rate: driftRate,
    total_tokens: totalTokens === null ? null : Math.round(totalTokens),
    total_cost_usd: totalCost,
    score,
    updated_at: String(rows.at(-1)!.created_at),
  });
}

function nullableNumber(value: unknown): number | null { return value === null || value === undefined ? null : Number(value); }
function nullableBoolean(value: unknown): boolean | null { return value === null || value === undefined ? null : Number(value) === 1; }
function ratio(part: number, total: number): number | null { return total === 0 ? null : part / total; }
function average(values: number[]): number | null { return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length; }
function booleanRate(values: boolean[]): number | null { return values.length === 0 ? null : values.filter(Boolean).length / values.length; }
function percentile(values: number[], quantile: number): number | null {
  if (values.length === 0) return null;
  return values[Math.min(values.length - 1, Math.ceil(values.length * quantile) - 1)]!;
}
function nullableSum(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => value !== null);
  return present.length === 0 ? null : present.reduce((sum, value) => sum + value, 0);
}
function booleanSql(value: boolean | null): number | null { return value === null ? null : value ? 1 : 0; }
function clamp(value: number, minimum: number, maximum: number): number { return Math.min(maximum, Math.max(minimum, value)); }
