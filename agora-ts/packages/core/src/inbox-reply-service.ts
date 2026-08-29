/**
 * inbox-reply-service.ts — R-D (T-3) inbound reply → task comment.
 *
 * §1 compliance: This service knows NOTHING about matrix / discord / any
 * IM. It consumes opaque, adapter-resolved identifiers:
 *   - provider:            which adapter produced the message (opaque string)
 *   - providerMessageRef:  adapter-side event id (dedupe anchor)
 *   - parentMessageRef:    adapter-side parent event id (reply-to target,
 *                          resolved by the adapter from m.relates_to)
 *   - threadTaskBindingKey: opaque threadKey from thread_task_bindings
 *                           (agora central never interprets it)
 *
 * matrix m.relates_to.m.in_reply_to parsing lives in the adapter.
 */

import type {
  ITaskConversationRepository,
  ITaskRepository,
  TaskConversationAuthorKind,
} from '@agora-ts/contracts';
import { NotFoundError } from './errors.js';

export interface InboxReplyInput {
  taskId: string;
  provider: string;
  providerMessageRef: string;
  parentMessageRef?: string;
  body: string;
  authorKind: TaskConversationAuthorKind;
  authorRef?: string;
  displayName?: string;
  occurredAt: string;
  threadTaskBindingKey?: string;
}

export interface InboxReplyReceipt {
  id: string;
  deduped: boolean;
}

export class InboxReplyService {
  private readonly conversationRepository: ITaskConversationRepository;
  private readonly taskRepository: Pick<ITaskRepository, 'getTask'>;

  public constructor(options: {
    conversationRepository: ITaskConversationRepository;
    taskRepository: Pick<ITaskRepository, 'getTask'>;
  }) {
    this.conversationRepository = options.conversationRepository;
    this.taskRepository = options.taskRepository;
  }

  public recordInboundReply(input: InboxReplyInput): InboxReplyReceipt {
    if (!input.taskId) {
      throw new Error('taskId is required');
    }
    const task = this.taskRepository.getTask(input.taskId);
    if (!task) {
      throw new NotFoundError(`task not found: ${input.taskId}`);
    }
    if (!input.body) {
      throw new Error('body is required');
    }
    if (!input.provider) {
      throw new Error('provider is required');
    }
    if (!input.providerMessageRef) {
      throw new Error('provider message ref is required');
    }

    const dedupeKey = `${input.provider}:${input.providerMessageRef}`;
    const existing = this.conversationRepository.listByTask(input.taskId).find(
      (e) => e.dedupe_key === dedupeKey,
    );
    if (existing) {
      return { id: existing.id, deduped: true };
    }

    const entry = this.conversationRepository.insert({
      id: `rc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      task_id: input.taskId,
      binding_id: null,
      thread_task_binding_id: input.threadTaskBindingKey ?? null,
      provider: input.provider,
      provider_message_ref: input.providerMessageRef,
      parent_message_ref: input.parentMessageRef ?? null,
      direction: 'inbound',
      author_kind: input.authorKind,
      author_ref: input.authorRef ?? null,
      display_name: input.displayName ?? null,
      body: input.body,
      occurred_at: input.occurredAt,
      dedupe_key: dedupeKey,
    });
    return { id: entry.id, deduped: false };
  }
}