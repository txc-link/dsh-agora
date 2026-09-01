import { createHash, randomUUID } from 'node:crypto';
import type {
  IProgressLogRepository,
  ITaskConversationRepository,
  ITaskMemorySummaryRepository,
  ITaskRepository,
  TaskMemorySummaryDto,
  TaskRecord,
} from '@agora-ts/contracts';
import { TaskState } from './enums.js';
import type { GroupMemoryEntry, GroupMemoryPort } from './group-memory-ports.js';
import { DefaultMemoryRedactor, DeterministicTaskMemorySummaryProvider, type MemoryRedactor, type StructuredTaskMemorySummary, type TaskMemorySummaryProvider } from './memory-summary-provider.js';

export interface TaskMemorySummaryServiceOptions {
  taskRepository: Pick<ITaskRepository, 'getTask' | 'listTasks'>;
  conversationRepository: Pick<ITaskConversationRepository, 'listByTask'>;
  progressRepository: Pick<IProgressLogRepository, 'listByTask'>;
  summaryRepository: ITaskMemorySummaryRepository;
  memoryPort: GroupMemoryPort;
  now?: () => Date;
  idGenerator?: () => string;
  summaryProvider?: TaskMemorySummaryProvider;
  redactor?: MemoryRedactor;
}

export type TaskMemorySummaryResult =
  | { status: 'created'; summary: TaskMemorySummaryDto; memory: GroupMemoryEntry }
  | { status: 'already_summarized'; summary: TaskMemorySummaryDto }
  | { status: 'skipped'; reason: string };

/**
 * Creates one concise, provenance-rich group-memory entry for a terminal task.
 * The summarizer is deliberately deterministic: an LLM/provider can be added
 * behind GroupMemoryPort later without changing the Core lifecycle contract.
 */
export class TaskMemorySummaryService {
  private readonly now: () => Date;
  private readonly idGenerator: () => string;
  private readonly summaryProvider: TaskMemorySummaryProvider;
  private readonly redactor: MemoryRedactor;

  constructor(private readonly options: TaskMemorySummaryServiceOptions) {
    this.now = options.now ?? (() => new Date());
    this.idGenerator = options.idGenerator ?? randomUUID;
    this.summaryProvider = options.summaryProvider ?? new DeterministicTaskMemorySummaryProvider();
    this.redactor = options.redactor ?? new DefaultMemoryRedactor();
  }

  async summarizeTask(taskId: string, scopeRef?: string): Promise<TaskMemorySummaryResult> {
    const task = this.options.taskRepository.getTask(taskId);
    if (!task) return { status: 'skipped', reason: `task not found: ${taskId}` };
    if (task.state !== TaskState.DONE && task.state !== TaskState.CANCELLED) {
      return { status: 'skipped', reason: `task is not terminal: ${task.state}` };
    }
    const conversation = this.options.conversationRepository.listByTask(taskId);
    const progress = this.options.progressRepository.listByTask(taskId);
    const fingerprint = fingerprintTask(task, conversation, progress);
    const existing = this.options.summaryRepository.getByTaskFingerprint(taskId, fingerprint);
    if (existing?.status === 'succeeded') return { status: 'already_summarized', summary: existing };

    const resolvedScope = scopeRef?.trim() || (task.project_id ? `project:${task.project_id}` : `task:${task.id}`);
    const timestamp = this.now().toISOString();
    const pending = existing ?? this.options.summaryRepository.insert({
      id: this.idGenerator(), task_id: task.id, scope_ref: resolvedScope, fingerprint,
      memory_id: null, status: 'pending', error: null, created_at: timestamp, updated_at: timestamp,
    });
    try {
      const structured = await this.summaryProvider.summarize({ task, conversation, progress });
      const rendered = renderStructuredSummary(task, conversation, progress, structured, this.redactor);
      const memory = await this.options.memoryPort.add({
        scopeRef: resolvedScope,
        agentRef: resolveSummaryAgent(task),
        kind: task.type === 'research' ? 'research' : 'lesson',
        text: rendered.text,
        metadata: {
          summary_kind: 'task_terminal', task_id: task.id, task_state: task.state,
          fingerprint, contributors: task.team.members.map((member) => member.agentId),
          summary_schema: 'agora.task-memory/v2', facts: redactStructured(rendered.structured.facts, this.redactor),
          decisions: redactStructured(rendered.structured.decisions, this.redactor), lessons: redactStructured(rendered.structured.lessons, this.redactor),
          unresolved: redactStructured(rendered.structured.unresolved, this.redactor), confidence: rendered.structured.confidence,
          redacted: rendered.redacted, redaction_patterns: rendered.redactionPatterns,
        },
      });
      const summary = this.options.summaryRepository.markSucceeded(pending.id, memory.id, this.now().toISOString());
      return { status: 'created', summary: summary ?? pending, memory };
    } catch (error) {
      this.options.summaryRepository.markFailed(pending.id, error instanceof Error ? error.message : String(error), this.now().toISOString());
      throw error;
    }
  }

  async scanTerminalTasks(limit = 25): Promise<{ scanned: number; created: number; skipped: number; failed: number }> {
    const tasks = [
      ...this.options.taskRepository.listTasks(TaskState.DONE),
      ...this.options.taskRepository.listTasks(TaskState.CANCELLED),
    ].slice(0, Math.max(1, Math.min(100, limit)));
    let created = 0; let skipped = 0; let failed = 0;
    for (const task of tasks) {
      try {
        const result = await this.summarizeTask(task.id);
        if (result.status === 'created') created += 1; else skipped += 1;
      } catch { failed += 1; }
    }
    return { scanned: tasks.length, created, skipped, failed };
  }

  listByTask(taskId: string): TaskMemorySummaryDto[] {
    return this.options.summaryRepository.listByTask(taskId);
  }
}

function redactStructured(value: unknown, redactor: MemoryRedactor): unknown {
  if (typeof value === 'string') return redactor.redact(value).text;
  if (Array.isArray(value)) return value.map((item) => redactStructured(item, redactor));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactStructured(item, redactor)]));
  }
  return value;
}

function fingerprintTask(
  task: TaskRecord,
  conversation: Array<{ body: string; occurred_at: string; author_ref: string | null }>,
  progress: Array<{ content: string; created_at?: string }>,
): string {
  return createHash('sha256').update(JSON.stringify({
    task: { id: task.id, version: task.version, state: task.state, updated_at: task.updated_at, title: task.title, description: task.description },
    conversation: conversation.map((entry) => [entry.occurred_at, entry.author_ref, entry.body]),
    progress: progress.map((entry) => [entry.created_at ?? null, entry.content]),
  })).digest('hex');
}

function resolveSummaryAgent(task: TaskRecord): string {
  return task.team.members.find((member) => member.member_kind === 'controller')?.agentId
    ?? task.team.members[0]?.agentId
    ?? task.creator;
}

function renderStructuredSummary(
  task: TaskRecord,
  conversation: Array<{ body: string; occurred_at: string; author_ref: string | null }>,
  progress: Array<{ content: string }>,
  structured: StructuredTaskMemorySummary,
  redactor: MemoryRedactor,
): { text: string; structured: StructuredTaskMemorySummary; redacted: boolean; redactionPatterns: string[] } {
  const clean = (value: string) => value.replace(/\s+/gu, ' ').trim();
  const original = [
    `任务：${task.title}`,
    `状态：${task.state}`,
    `类型：${task.type}`,
    task.description ? `目标：${clean(task.description)}` : '',
    `团队：${task.team.members.map((member) => `${member.agentId}(${member.role})`).join('、') || '未记录'}`,
    progress.length ? `进展：${progress.slice(-8).map((entry) => clean(entry.content)).join('；')}` : '',
    conversation.length ? `协作记录：${conversation.slice(-12).map((entry) => `${entry.author_ref ?? 'system'}：${clean(entry.body)}`).join('；')}` : '',
  ].filter(Boolean);
  const sections = [
    `## 事实\n${structured.facts.map(clean).join('\n') || '未记录'}`,
    `## 决策\n${structured.decisions.map(clean).join('\n') || '未记录'}`,
    `## 经验\n${structured.lessons.map(clean).join('\n') || '未记录'}`,
    `## 未决\n${structured.unresolved.map(clean).join('\n') || '无'}`,
    `## 原始摘要\n${original.join('\n')}`,
  ];
  const redacted = redactor.redact(sections.join('\n\n'));
  return { text: redacted.text.slice(0, 12_000), structured, redacted: redacted.redacted, redactionPatterns: redacted.patterns };
}
