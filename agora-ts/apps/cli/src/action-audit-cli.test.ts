import { describe, expect, it } from 'vitest';
import type {
  ActionAttemptRecord,
  ActionReceiptRecord,
  CollaborationPlanRecord,
  DelegationAuthorityRecord,
  ExecutionBaselineRecord,
  ICollaborationPlanRepository,
  IDelegationAuthorityRepository,
  IExecutionBaselineRepository,
  IActionAttemptRepository,
  IActionReceiptRepository,
} from '@agora-ts/contracts';
import { ActionAuditService } from '@agora-ts/core';
import { createCliProgram } from './index.js';

class EmptyAttempts implements IActionAttemptRepository {
  insert(record: ActionAttemptRecord) { return record; }
  getById() { return null; }
  getByIdempotencyKey() { return null; }
  listByTask() { return []; }
}
class EmptyReceipts implements IActionReceiptRepository {
  insert(record: ActionReceiptRecord) { return record; }
  getById() { return null; }
  getByAttemptId() { return null; }
  getByIdempotencyKey() { return null; }
  listByTask() { return []; }
}
class EmptyReference<T extends { id: string }> {
  getById() { return null as T | null; }
}

describe('action audit CLI', () => {
  it('exposes read-only audit lists without opening default composition', async () => {
    let output = '';
    const service = new ActionAuditService({
      attempts: new EmptyAttempts(), receipts: new EmptyReceipts(),
      plans: new EmptyReference<CollaborationPlanRecord>() as ICollaborationPlanRepository,
      authorities: new EmptyReference<DelegationAuthorityRecord>() as IDelegationAuthorityRepository,
      baselines: new EmptyReference<ExecutionBaselineRecord>() as IExecutionBaselineRepository,
    });
    const program = createCliProgram({
      actionAuditService: service,
      stdout: { write: (chunk: string) => { output += chunk; } }, stderr: { write: () => undefined },
    });
    await program.parseAsync(['audit', 'attempt', 'list', 'task-1'], { from: 'user' });
    await program.parseAsync(['audit', 'receipt', 'list', 'task-1'], { from: 'user' });
    expect(output).toContain('[]');
  });
});
