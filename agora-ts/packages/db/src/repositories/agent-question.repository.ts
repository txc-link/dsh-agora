/**
 * agent-question.repository.ts — org-aware-work-os S5 agent question store (2026-08-30).
 *
 * Persists agent → human questions so the question state machine
 * (pending → answered | escalated → answered; * → closed) is queryable.
 * Pattern follows task-claim.repository.ts.
 */

import { randomUUID } from 'node:crypto';
import type {
  AgentQuestionKind,
  AgentQuestionRecord,
  AgentQuestionStatus,
  AgentQuestionTarget,
  IAgentQuestionRepository,
} from '@agora-ts/contracts';
import type { AgoraDatabase } from '../database.js';
import { parseJsonValue, stringifyJsonValue } from './json.js';

export class AgentQuestionRepository implements IAgentQuestionRepository {
  constructor(private readonly db: AgoraDatabase) {}

  insert(input: {
    id?: string;
    taskId?: string | null;
    agentRef: string;
    kind: AgentQuestionKind;
    question: string;
    context?: string | null;
    target: AgentQuestionTarget;
    metadata?: Record<string, unknown> | null;
  }): AgentQuestionRecord {
    const id = input.id ?? randomUUID();
    const createdAt = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO agent_questions (
        id, task_id, agent_ref, kind, question, context, target,
        status, created_at, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `).run(
      id,
      input.taskId ?? null,
      input.agentRef,
      input.kind,
      input.question,
      input.context ?? null,
      input.target,
      createdAt,
      stringifyJsonValue(input.metadata ?? null),
    );
    const stored = this.getById(id);
    if (stored === null) {
      throw new Error('agent question insert failed: reload returned null');
    }
    return stored;
  }

  getById(id: string): AgentQuestionRecord | null {
    const row = this.db.prepare('SELECT * FROM agent_questions WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? this.parseRow(row) : null;
  }

  listByStatus(status: AgentQuestionStatus): AgentQuestionRecord[] {
    const rows = this.db.prepare(
      'SELECT * FROM agent_questions WHERE status = ? ORDER BY created_at DESC, id DESC',
    ).all(status) as Record<string, unknown>[];
    return rows.map((row) => this.parseRow(row));
  }

  listByAgent(agentRef: string): AgentQuestionRecord[] {
    const rows = this.db.prepare(
      'SELECT * FROM agent_questions WHERE agent_ref = ? ORDER BY created_at DESC, id DESC',
    ).all(agentRef) as Record<string, unknown>[];
    return rows.map((row) => this.parseRow(row));
  }

  listOpen(): AgentQuestionRecord[] {
    const rows = this.db.prepare(
      "SELECT * FROM agent_questions WHERE status IN ('pending', 'escalated') ORDER BY created_at DESC, id DESC",
    ).all() as Record<string, unknown>[];
    return rows.map((row) => this.parseRow(row));
  }

  updateStatus(id: string, status: AgentQuestionStatus, at: string): AgentQuestionRecord | null {
    let info: { changes: number | bigint };
    if (status === 'escalated') {
      info = this.db.prepare('UPDATE agent_questions SET status = ?, escalated_at = ? WHERE id = ?').run(status, at, id);
    } else if (status === 'closed') {
      info = this.db.prepare('UPDATE agent_questions SET status = ?, closed_at = ? WHERE id = ?').run(status, at, id);
    } else {
      info = this.db.prepare('UPDATE agent_questions SET status = ? WHERE id = ?').run(status, id);
    }
    if (info.changes === 0) {
      return null;
    }
    return this.getById(id);
  }

  updateAnswer(
    id: string,
    answer: string,
    answeredBy: string,
    answeredAt: string,
  ): AgentQuestionRecord | null {
    const info = this.db.prepare(
      'UPDATE agent_questions SET answer = ?, answered_by = ?, answered_at = ? WHERE id = ?',
    ).run(answer, answeredBy, answeredAt, id);
    if (info.changes === 0) {
      return null;
    }
    return this.getById(id);
  }

  updateTarget(id: string, target: AgentQuestionTarget): AgentQuestionRecord | null {
    const info = this.db.prepare('UPDATE agent_questions SET target = ? WHERE id = ?').run(target, id);
    if (info.changes === 0) {
      return null;
    }
    return this.getById(id);
  }

  private parseRow(row: Record<string, unknown>): AgentQuestionRecord {
    return {
      id: row.id as string,
      taskId: row.task_id as string | null,
      agentRef: row.agent_ref as string,
      kind: row.kind as AgentQuestionKind,
      question: row.question as string,
      context: row.context as string | null,
      target: row.target as AgentQuestionTarget,
      status: row.status as AgentQuestionStatus,
      answer: row.answer as string | null,
      answeredBy: row.answered_by as string | null,
      answeredAt: row.answered_at as string | null,
      escalatedAt: row.escalated_at as string | null,
      closedAt: row.closed_at as string | null,
      createdAt: row.created_at as string,
      metadata: parseJsonValue<Record<string, unknown> | null>(row.metadata, null),
    };
  }
}
