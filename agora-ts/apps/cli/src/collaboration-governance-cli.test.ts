import { describe, expect, it } from 'vitest';
import type {
  CollaborationPlanRecord,
  CollaborationRequirementRecord,
  DelegationAuthorityRecord,
  ICollaborationPlanRepository,
  ICollaborationRequirementRepository,
  IDelegationAuthorityRepository,
  ISubTaskSpecRepository,
  SubTaskSpecRecord,
} from '@agora-ts/contracts';
import { CollaborationGovernanceService } from '@agora-ts/core';
import { createCliProgram } from './index.js';

class EmptyRepository<T extends { id: string; idempotency_key: string; task_id: string }> {
  insert(record: T) { return record; }
  getById() { return null; }
  getByIdempotencyKey() { return null; }
  listByTask() { return []; }
  listByRequirement() { return []; }
}

describe('collaboration governance CLI', () => {
  it('exposes read-only collaboration record commands without opening default composition', async () => {
    let output = '';
    const service = new CollaborationGovernanceService({
      requirements: new EmptyRepository<CollaborationRequirementRecord>() as ICollaborationRequirementRepository,
      specs: new EmptyRepository<SubTaskSpecRecord>() as ISubTaskSpecRepository,
      authorities: new EmptyRepository<DelegationAuthorityRecord>() as IDelegationAuthorityRepository,
      plans: new EmptyRepository<CollaborationPlanRecord>() as ICollaborationPlanRepository,
    });
    const program = createCliProgram({
      collaborationGovernanceService: service,
      stdout: { write: (chunk: string) => { output += chunk; } },
      stderr: { write: () => undefined },
    });

    await program.parseAsync(['collaboration', 'requirement', 'list', 'task-1'], { from: 'user' });
    await program.parseAsync(['collaboration', 'spec', 'list', 'task-1'], { from: 'user' });
    await program.parseAsync(['collaboration', 'authority', 'list', 'task-1'], { from: 'user' });
    await program.parseAsync(['collaboration', 'plan', 'list', 'task-1'], { from: 'user' });

    expect(output).toContain('[]');
    expect(output).toContain('\n');
  });
});
