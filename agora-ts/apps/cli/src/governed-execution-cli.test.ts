import { describe, expect, it } from 'vitest';
import type {
  EvidenceManifestRecord,
  ExecutionBaselineRecord,
  IExecutionBaselineRepository,
  IEvidenceManifestRepository,
  ITaskSpecRevisionRepository,
  TaskSpecRevisionRecord,
} from '@agora-ts/contracts';
import { GovernedExecutionService } from '@agora-ts/core';
import { createCliProgram } from './index.js';

class EmptyRevisionRepository implements ITaskSpecRevisionRepository {
  insert(record: TaskSpecRevisionRecord) { return record; }
  getById() { return null; }
  getLatest() { return null; }
  getByIdempotencyKey() { return null; }
  listByTask() { return []; }
}

class EmptyBaselineRepository implements IExecutionBaselineRepository {
  insert(record: ExecutionBaselineRecord) { return record; }
  getById() { return null; }
  getByIdempotencyKey() { return null; }
  listByTask() { return []; }
}

class EmptyManifestRepository implements IEvidenceManifestRepository {
  insert(record: EvidenceManifestRecord) { return record; }
  getById() { return null; }
  getByIdempotencyKey() { return null; }
  listByTask() { return []; }
}

describe('governed execution CLI', () => {
  it('exposes read-only revision, baseline and evidence commands without opening the default composition', async () => {
    let output = '';
    const service = new GovernedExecutionService({
      taskSpecRevisions: new EmptyRevisionRepository(),
      executionBaselines: new EmptyBaselineRepository(),
      evidenceManifests: new EmptyManifestRepository(),
    });
    const program = createCliProgram({
      governedExecutionService: service,
      stdout: { write: (chunk: string) => { output += chunk; } },
      stderr: { write: () => undefined },
    });

    await program.parseAsync(['execution', 'revision', 'list', 'task-1'], { from: 'user' });
    await program.parseAsync(['execution', 'baseline', 'list', 'task-1'], { from: 'user' });
    await program.parseAsync(['execution', 'evidence', 'list', 'task-1'], { from: 'user' });

    expect(output).toContain('[]');
    expect(output).toContain('\n');
  });
});
