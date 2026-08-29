/**
 * inbox-reply-service.test.ts — R-D (T-3) inbound reply→task comment.
 *
 * §1 compliance: InboxReplyService knows nothing about matrix. It only
 * consumes opaque provider_message_ref / parent_message_ref (event ids
 * resolved by the adapter) and a thread binding key that is opaque to
 * agora central. matrix m.relates_to.m.in_reply_to parsing lives in the
 * adapter (dsh-matrix-connector).
 */

import { describe, expect, it } from 'vitest';
import { InboxReplyService } from './inbox-reply-service.js';
import type { InboxReplyInput } from './inbox-reply-service.js';
import type {
  ITaskConversationRepository,
  ITaskRepository,
  TaskConversationEntryRecord,
  TaskRecord,
} from '@agora-ts/contracts';

class StubConversationRepo implements ITaskConversationRepository {
  public entries: TaskConversationEntryRecord[] = [];
  insert(input: Parameters<ITaskConversationRepository['insert']>[0]): TaskConversationEntryRecord {
    const record: TaskConversationEntryRecord = {
      id: input.id,
      task_id: input.task_id,
      binding_id: input.binding_id ?? null,
      thread_task_binding_id: input.thread_task_binding_id ?? null,
      provider: input.provider,
      provider_message_ref: input.provider_message_ref ?? null,
      parent_message_ref: input.parent_message_ref ?? null,
      direction: input.direction,
      author_kind: input.author_kind,
      author_ref: input.author_ref ?? null,
      display_name: input.display_name ?? null,
      body: input.body,
      body_format: input.body_format ?? 'plain_text',
      occurred_at: input.occurred_at,
      ingested_at: input.ingested_at ?? new Date().toISOString(),
      dedupe_key: input.dedupe_key ?? null,
      metadata: input.metadata ?? null,
    };
    const existing = this.entries.find((e) => e.dedupe_key === record.dedupe_key);
    if (existing) return existing;
    this.entries.push(record);
    return record;
  }
  listByTask(taskId: string, limit = 100): TaskConversationEntryRecord[] {
    return this.entries.filter((e) => e.task_id === taskId).slice(0, limit);
  }
  getLatestByTask(taskId: string): TaskConversationEntryRecord | null {
    return this.entries.filter((e) => e.task_id === taskId).at(-1) ?? null;
  }
  countByTask(taskId: string): number {
    return this.entries.filter((e) => e.task_id === taskId).length;
  }
  countUnreadByTask(taskId: string): number {
    return this.countByTask(taskId);
  }
}

class StubTaskRepo implements Pick<ITaskRepository, 'getTask'> {
  constructor(private readonly tasks: Map<string, TaskRecord>) {}
  getTask(id: string): TaskRecord | null {
    return this.tasks.get(id) ?? null;
  }
}

function makeInput(overrides: Partial<InboxReplyInput> = {}): InboxReplyInput {
  return {
    taskId: 'T-1',
    provider: 'matrix',
    providerMessageRef: '$event-1',
    body: '答复内容',
    authorKind: 'human',
    authorRef: '@user:agent-hub.local',
    displayName: 'user',
    occurredAt: '2026-08-30T12:00:00Z',
    ...overrides,
  };
}

function makeService(overrides: { taskIds?: string[] } = {}) {
  const tasks = new Map<string, TaskRecord>();
  for (const id of overrides.taskIds ?? ['T-1']) {
    tasks.set(id, {
      id,
      version: 1,
      title: 'demo',
      description: null,
      type: 'oneoff',
      priority: 'normal',
      creator: 'user:txc-link',
      locale: 'zh-CN',
      project_id: null,
      state: 'pending',
      archive_status: null,
      current_stage: null,
      skill_policy: null,
      team: { members: [] },
      workflow: { stages: [], graph: { graph_version: 1, entry_nodes: [], nodes: [], edges: [] } },
      control: null,
      scheduler: null,
      scheduler_snapshot: null,
      discord: null,
      metrics: null,
      error_detail: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });
  }
  const conversationRepo = new StubConversationRepo();
  const service = new InboxReplyService({
    conversationRepository: conversationRepo,
    taskRepository: new StubTaskRepo(tasks),
  });
  return { service, conversationRepo };
}

describe('InboxReplyService', () => {
  it('records an inbound reply as an inbound task conversation entry', () => {
    const { service, conversationRepo } = makeService();
    const receipt = service.recordInboundReply(makeInput());
    expect(receipt.deduped).toBe(false);
    expect(receipt.id).toBeTruthy();
    const entry = conversationRepo.entries[0]!;
    expect(entry.task_id).toBe('T-1');
    expect(entry.provider).toBe('matrix');
    expect(entry.direction).toBe('inbound');
    expect(entry.author_kind).toBe('human');
    expect(entry.parent_message_ref).toBeNull();
  });

  it('links parent_message_ref (adapter-side reply-to target) opaquely', () => {
    const { service, conversationRepo } = makeService();
    service.recordInboundReply(
      makeInput({ providerMessageRef: '$reply-2', parentMessageRef: '$orig-1' }),
    );
    const entry = conversationRepo.entries[0]!;
    expect(entry.parent_message_ref).toBe('$orig-1');
  });

  it('records provider_message_ref + dedupe_key for idempotent retries', () => {
    const { service, conversationRepo } = makeService();
    const first = service.recordInboundReply(makeInput({ providerMessageRef: '$evt-9' }));
    const second = service.recordInboundReply(makeInput({ providerMessageRef: '$evt-9' }));
    expect(second.deduped).toBe(true);
    expect(second.id).toBe(first.id);
    expect(conversationRepo.entries).toHaveLength(1);
  });

  it('stores thread binding key when provided', () => {
    const { service, conversationRepo } = makeService();
    service.recordInboundReply(
      makeInput({ threadTaskBindingKey: 'mx_0123456789abcdef', providerMessageRef: '$evt-3' }),
    );
    expect(conversationRepo.entries[0]!.thread_task_binding_id).toBe('mx_0123456789abcdef');
  });

  it('throws when task does not exist', () => {
    const { service } = makeService({ taskIds: [] });
    expect(() => service.recordInboundReply(makeInput())).toThrow(/task not found/i);
  });

  it('throws on empty body', () => {
    const { service } = makeService();
    expect(() => service.recordInboundReply(makeInput({ body: '' }))).toThrow(/body/i);
  });

  it('throws on missing providerMessageRef (dedupe anchor)', () => {
    const { service } = makeService();
    expect(() =>
      service.recordInboundReply(makeInput({ providerMessageRef: '' })),
    ).toThrow(/provider message ref/i);
  });

  it('auto-binds threadTaskBindingKey when the binding does not exist yet', () => {
    const tasks = new Map<string, TaskRecord>();
    tasks.set('T-1', {
      id: 'T-1', version: 1, title: 'demo', description: null, type: 'oneoff',
      priority: 'normal', creator: 'user:txc-link', locale: 'zh-CN', project_id: null,
      state: 'pending', archive_status: null, current_stage: null, skill_policy: null,
      team: { members: [] },
      workflow: { stages: [], graph: { graph_version: 1, entry_nodes: [], nodes: [], edges: [] } },
      control: null, scheduler: null, scheduler_snapshot: null, discord: null, metrics: null,
      error_detail: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    });
    const bound: Array<{ threadKey: string; taskId: string }> = [];
    const stubBindingService = {
      getByThreadKey: () => undefined,
      bind: (input: { threadKey: string; taskId: string }) => {
        bound.push(input);
        return { thread_key: input.threadKey, task_id: input.taskId, created_at: '', updated_at: '' };
      },
    } as unknown as ConstructorParameters<typeof InboxReplyService>[0]['threadTaskBindingService'];

    const conversationRepo = new StubConversationRepo();
    const service = new InboxReplyService({
      conversationRepository: conversationRepo,
      taskRepository: new StubTaskRepo(tasks),
      threadTaskBindingService: stubBindingService,
    });

    service.recordInboundReply(
      makeInput({ threadTaskBindingKey: 'mx_abcdef', providerMessageRef: '$evt-bind' }),
    );
    expect(bound).toHaveLength(1);
    expect(bound[0]).toEqual({ threadKey: 'mx_abcdef', taskId: 'T-1' });
    expect(conversationRepo.entries[0]!.thread_task_binding_id).toBe('mx_abcdef');
  });

  it('reuses an existing binding instead of re-binding', () => {
    const tasks = new Map<string, TaskRecord>();
    tasks.set('T-1', {
      id: 'T-1', version: 1, title: 'demo', description: null, type: 'oneoff',
      priority: 'normal', creator: 'user:txc-link', locale: 'zh-CN', project_id: null,
      state: 'pending', archive_status: null, current_stage: null, skill_policy: null,
      team: { members: [] },
      workflow: { stages: [], graph: { graph_version: 1, entry_nodes: [], nodes: [], edges: [] } },
      control: null, scheduler: null, scheduler_snapshot: null, discord: null, metrics: null,
      error_detail: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    });
    const bound: Array<{ threadKey: string; taskId: string }> = [];
    const stubBindingService = {
      getByThreadKey: () => ({ thread_key: 'mx_abcdef', task_id: 'T-1', created_at: '', updated_at: '' }),
      bind: (input: { threadKey: string; taskId: string }) => {
        bound.push(input);
        return { thread_key: input.threadKey, task_id: input.taskId, created_at: '', updated_at: '' };
      },
    } as unknown as ConstructorParameters<typeof InboxReplyService>[0]['threadTaskBindingService'];

    const conversationRepo = new StubConversationRepo();
    const service = new InboxReplyService({
      conversationRepository: conversationRepo,
      taskRepository: new StubTaskRepo(tasks),
      threadTaskBindingService: stubBindingService,
    });

    service.recordInboundReply(
      makeInput({ threadTaskBindingKey: 'mx_abcdef', providerMessageRef: '$evt-reuse' }),
    );
    expect(bound).toHaveLength(0);
  });
});