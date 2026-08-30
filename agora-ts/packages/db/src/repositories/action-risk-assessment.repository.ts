import {
  actionIntentSchema,
  type ActionRiskAssessmentRecord,
  type IActionRiskAssessmentRepository,
} from '@agora-ts/contracts';
import type { AgoraDatabase } from '../database.js';
import { parseJsonValue, stringifyJsonValue } from './json.js';

export class ActionRiskAssessmentRepository implements IActionRiskAssessmentRepository {
  constructor(private readonly db: AgoraDatabase) {}

  insert(record: ActionRiskAssessmentRecord): ActionRiskAssessmentRecord {
    this.db.prepare(`
      INSERT INTO action_risk_assessments (
        id, subject_ref, intent, risk_level, decision, reasons, policy_version, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      record.id,
      record.intent.subject_ref,
      stringifyJsonValue(record.intent),
      record.risk_level,
      record.decision,
      stringifyJsonValue(record.reasons),
      record.policy_version,
      record.created_at,
    );
    return this.getById(record.id) as ActionRiskAssessmentRecord;
  }

  getById(id: string): ActionRiskAssessmentRecord | null {
    const row = this.db.prepare('SELECT * FROM action_risk_assessments WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? this.parseRow(row) : null;
  }

  listBySubject(subjectRef: string): ActionRiskAssessmentRecord[] {
    const rows = this.db.prepare(`
      SELECT * FROM action_risk_assessments WHERE subject_ref = ? ORDER BY created_at ASC, id ASC
    `).all(subjectRef) as Record<string, unknown>[];
    return rows.map((row) => this.parseRow(row));
  }

  private parseRow(row: Record<string, unknown>): ActionRiskAssessmentRecord {
    return {
      id: row.id as string,
      intent: actionIntentSchema.parse(parseJsonValue(row.intent, {})),
      risk_level: row.risk_level as ActionRiskAssessmentRecord['risk_level'],
      decision: row.decision as ActionRiskAssessmentRecord['decision'],
      reasons: parseJsonValue<string[]>(row.reasons, []),
      policy_version: row.policy_version as string,
      created_at: row.created_at as string,
    };
  }
}

