import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import type { ActionAttemptDto, ActionReceiptDto } from '@agora-ts/contracts';
import { createAgoraDatabase, runMigrations } from './database.js';
import { TaskRepository } from './repositories/task.repository.js';
import { ActionAttemptRepository, ActionReceiptRepository } from './repositories/action-audit.repository.js';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const databases: ReturnType<typeof createAgoraDatabase>[] = [];

function makeDb() {
  const db = createAgoraDatabase({ dbPath: ':memory:' });
  databases.push(db);
  runMigrations(db);
  new TaskRepository(db).insertTask({
    id: 'task-1', title: '审计任务', description: null, type: 'research', priority: 'normal', creator: 'human:ceo', locale: 'zh-CN',
    team: { members: [] }, workflow: { stages: [] }, control: { mode: 'normal' },
  });
  return db;
}

afterEach(() => {
  while (databases.length > 0) databases.pop()!.close();
});

const attempt: ActionAttemptDto = {
  id: 'attempt-1', task_id: 'task-1', collaboration_plan_id: 'plan-1', execution_baseline_id: 'baseline-1',
  delegation_authority_id: 'authority-1', subtask_spec_id: 'spec-1', actor_ref: 'agent:worker', action: 'dispatch_subtask',
  subject_ref: 'subtask:spec-1', decision: 'admit', decision_reason: 'authorized', attempt_digest: digest('attempt'),
  idempotency_key: 'attempt-key', created_at: '2026-09-01T10:00:00.000Z',
};
const receipt: ActionReceiptDto = {
  id: 'receipt-1', task_id: 'task-1', attempt_id: 'attempt-1', outcome: 'succeeded', provider_ref: 'runtime:dispatch-1',
  evidence_refs: ['artifact:1'], error_code: null, summary: 'completed', receipt_digest: digest('receipt'), created_by: 'runtime:worker',
  idempotency_key: 'receipt-key', created_at: '2026-09-01T10:01:00.000Z',
};

describe('action audit repositories', () => {
  it('round-trips attempts and terminal receipts', () => {
    const db = makeDb();
    const attempts = new ActionAttemptRepository(db);
    const receipts = new ActionReceiptRepository(db);
    expect(attempts.insert(attempt)).toEqual(attempt);
    expect(attempts.getById('attempt-1')).toEqual(attempt);
    expect(attempts.getByIdempotencyKey('attempt-key')).toEqual(attempt);
    expect(attempts.listByTask('task-1')).toEqual([attempt]);
    expect(receipts.insert(receipt)).toEqual(receipt);
    expect(receipts.getById('receipt-1')).toEqual(receipt);
    expect(receipts.getByAttemptId('attempt-1')).toEqual(receipt);
    expect(receipts.getByIdempotencyKey('receipt-key')).toEqual(receipt);
    expect(receipts.listByTask('task-1')).toEqual([receipt]);
  });
});
