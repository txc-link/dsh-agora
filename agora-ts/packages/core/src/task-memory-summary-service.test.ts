import { describe, expect, it } from 'vitest';
import type { GroupMemoryAddInput, GroupMemoryEntry, GroupMemoryPort } from './group-memory-ports.js';
import type { TaskMemorySummaryDto, TaskRecord } from '@agora-ts/contracts';
import { TaskMemorySummaryService } from './task-memory-summary-service.js';

function task(state: string = 'done'): TaskRecord {
  return {
    id: 'T-1', version: 1, title: 'Research', description: 'Compare memory systems', type: 'research', priority: 'normal', creator: 'human:ceo',
    locale: 'zh-CN' as const, project_id: 'project:company', state, archive_status: null, current_stage: null, skill_policy: null,
    team: { members: [{ role: 'researcher', agentId: 'agent:research', member_kind: 'citizen' as const, model_preference: '' }] }, workflow: {}, control: null,
    scheduler: null, scheduler_snapshot: null, discord: null, metrics: null, error_detail: null, created_at: '2026-09-01T00:00:00.000Z', updated_at: '2026-09-01T01:00:00.000Z',
  };
}

describe('TaskMemorySummaryService', () => {
  it('creates one deterministic group-memory entry and is idempotent by fingerprint', async () => {
    const records: TaskMemorySummaryDto[] = [];
    const memories: GroupMemoryEntry[] = [];
    const service = new TaskMemorySummaryService({
      taskRepository: { getTask: () => task(), listTasks: () => [task()] },
      conversationRepository: { listByTask: () => [{ body: 'Use Mem0 for episodic recall', occurred_at: '2026-09-01T01:00:00.000Z', author_ref: 'agent:research' }] },
      progressRepository: { listByTask: () => [{ content: 'Compared three options', created_at: '2026-09-01T01:00:00.000Z' }] },
      summaryRepository: {
        getByTaskFingerprint: (_taskId: string, fingerprint: string) => records.find((r) => r.fingerprint === fingerprint) ?? null,
        insert: (r: TaskMemorySummaryDto) => { records.push(r); return r; },
        markSucceeded: (id: string, memoryId: string, updatedAt: string) => { const r = records.find((x) => x.id === id); r.status = 'succeeded'; r.memory_id = memoryId; r.updated_at = updatedAt; return r; },
        markFailed: () => null, listByTask: () => records,
      },
      memoryPort: { add: async (input: GroupMemoryAddInput) => { const memory: GroupMemoryEntry = { id: `m-${memories.length + 1}`, scopeRef: input.scopeRef, agentRef: input.agentRef, kind: input.kind, text: input.text, createdAt: '2026-09-01T01:00:00.000Z', metadata: input.metadata ?? null }; memories.push(memory); return memory; }, search: async () => [], list: async () => memories } satisfies GroupMemoryPort,
      now: () => new Date('2026-09-01T02:00:00.000Z'),
      idGenerator: () => 'summary-1',
    });
    const first = await service.summarizeTask('T-1');
    const second = await service.summarizeTask('T-1');
    expect(first.status).toBe('created');
    expect(second.status).toBe('already_summarized');
    expect(memories).toHaveLength(1);
    expect(memories[0].metadata.summary_kind).toBe('task_terminal');
  });

  it('does not summarize a non-terminal task', async () => {
    const service = new TaskMemorySummaryService({
      taskRepository: { getTask: () => task('active'), listTasks: () => [] },
      conversationRepository: { listByTask: () => [] }, progressRepository: { listByTask: () => [] },
      summaryRepository: { getByTaskFingerprint: () => null, insert: (record: TaskMemorySummaryDto) => record, markSucceeded: () => null, markFailed: () => null, listByTask: () => [] },
      memoryPort: { add: async () => ({ id: 'unused', scopeRef: 'unused', agentRef: 'unused', kind: 'lesson', text: 'unused', createdAt: new Date().toISOString(), metadata: null }), search: async () => [], list: async () => [] } satisfies GroupMemoryPort,
    });
    await expect(service.summarizeTask('T-1')).resolves.toEqual({ status: 'skipped', reason: 'task is not terminal: active' });
  });
});
