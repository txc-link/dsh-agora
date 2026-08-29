import type {
  AgentQuestionKind,
  AgentQuestionRecord,
  AgentQuestionTarget,
  IAgentQuestionRepository,
} from '@agora-ts/contracts';
import { NotificationPayload } from './im-ports.js';

export type { AgentQuestionKind, AgentQuestionRecord, AgentQuestionTarget };

/** Agent→人 推送缝: core 不耦合任何平台, adapter 负责投递。 */
export interface QuestionMessagingPort {
  sendNotification(targetRef: string, payload: NotificationPayload): Promise<void>;
}

export interface AgentQuestionServiceOptions {
  questionRepo: IAgentQuestionRepository;
  messagingPort?: QuestionMessagingPort;
  /** 共享记忆缝: kind=research 的问题被 answer 时自动沉淀经验; 失败不阻塞 answer */
  groupMemory?: { add: (input: { scopeRef: string; agentRef: string; kind: string; text: string; metadata?: Record<string, unknown> | null }) => Promise<unknown> };
  /** 助手 ref; 未配置 → 所有问题直达 ceo */
  assistantRef?: string | null;
  ceoRef: string;
  now?: () => Date;
}

export interface RouteQuestionInput {
  assistantRef?: string | null;
}

export interface RouteQuestionResult {
  target: AgentQuestionTarget;
}

export interface CreateAgentQuestionInput {
  taskId?: string | null;
  agentRef: string;
  kind: AgentQuestionKind;
  question: string;
  context?: string | null;
}

export type AgentQuestionResult =
  | { ok: true; question: AgentQuestionRecord }
  | { ok: false; error: string };

export type AgentQuestionListResult =
  | { ok: true; questions: AgentQuestionRecord[]; count: number }
  | { ok: false; error: string };

/** 路由规则: 有助手走助手, 没有直达 ceo (U2 助手形态由 ref 字符串解耦)。 */
export function routeQuestion(input: RouteQuestionInput): RouteQuestionResult {
  if (input.assistantRef && input.assistantRef.length > 0) {
    return { target: 'assistant' };
  }
  return { target: 'ceo' };
}

function targetRef(options: AgentQuestionServiceOptions, target: AgentQuestionTarget): string {
  return target === 'assistant' && options.assistantRef
    ? options.assistantRef
    : options.ceoRef;
}

export class AgentQuestionService {
  private readonly questionRepo: IAgentQuestionRepository;
  private readonly groupMemory: AgentQuestionServiceOptions['groupMemory'];
  private readonly messagingPort: QuestionMessagingPort | undefined;
  private readonly assistantRef: string | null;
  private readonly ceoRef: string;
  private readonly now: () => Date;

  constructor(options: AgentQuestionServiceOptions) {
    this.questionRepo = options.questionRepo;
    this.messagingPort = options.messagingPort;
    this.groupMemory = options.groupMemory;
    this.assistantRef = options.assistantRef ?? null;
    this.ceoRef = options.ceoRef;
    this.now = options.now ?? (() => new Date());
  }

  private async push(eventType: string, record: AgentQuestionRecord): Promise<void> {
    if (!this.messagingPort) return;
    await this.messagingPort.sendNotification(targetRef({
      questionRepo: this.questionRepo,
      assistantRef: this.assistantRef,
      ceoRef: this.ceoRef,
      now: this.now,
    }, record.target), {
      task_id: record.taskId ?? '',
      event_type: eventType,
      data: {
        question_id: record.id,
        agent_ref: record.agentRef,
        kind: record.kind,
        question: record.question,
      },
    });
  }

  async create(input: CreateAgentQuestionInput): Promise<AgentQuestionResult> {
    if (!input.agentRef || input.agentRef.length === 0) {
      return { ok: false, error: 'agentRef is required' };
    }
    if (!input.question || input.question.trim().length === 0) {
      return { ok: false, error: 'question text is required' };
    }
    const { target } = routeQuestion({ assistantRef: this.assistantRef });
    const record = this.questionRepo.insert({
      taskId: input.taskId ?? null,
      agentRef: input.agentRef,
      kind: input.kind,
      question: input.question,
      context: input.context ?? null,
      target,
    });
    await this.push('agent_question_created', record);
    return { ok: true, question: record };
  }

  async answer(input: { questionId: string; answeredBy: string; answer: string }): Promise<AgentQuestionResult> {
    const record = this.questionRepo.getById(input.questionId);
    if (!record) return { ok: false, error: `question '${input.questionId}' not found` };
    if (record.status === 'closed') {
      return { ok: false, error: `question '${input.questionId}' is closed` };
    }
    const at = this.now().toISOString();
    const withAnswer = this.questionRepo.updateAnswer(input.questionId, input.answer, input.answeredBy, at);
    if (!withAnswer) return { ok: false, error: `question '${input.questionId}' not found` };
    const updated = this.questionRepo.updateStatus(input.questionId, 'answered', at);
    if (withAnswer.kind === 'research' && this.groupMemory) {
      try {
        // await 而非 fire-and-forget: CLI 进程随命令退出, 不等会把 POST 砍掉
        await this.groupMemory.add({
          scopeRef: (withAnswer.metadata as Record<string, unknown> | null)?.scope_ref as string ?? `task:${withAnswer.taskId ?? 'org'}`,
          agentRef: withAnswer.agentRef,
          kind: 'research',
          text: `${withAnswer.question}\n\n${input.answer}`,
          metadata: { question_id: withAnswer.id, answered_by: input.answeredBy },
        });
      } catch {
        // 共享记忆不可用时静默: answer 主链路不依赖
      }
    }
    return { ok: true, question: updated ?? withAnswer };
  }

  async escalate(input: { questionId: string }): Promise<AgentQuestionResult> {
    const record = this.questionRepo.getById(input.questionId);
    if (!record) return { ok: false, error: `question '${input.questionId}' not found` };
    if (record.status !== 'pending' && record.status !== 'escalated') {
      return { ok: false, error: `question '${input.questionId}' in status '${record.status}' cannot escalate` };
    }
    if (record.target !== 'ceo') {
      this.questionRepo.updateTarget(input.questionId, 'ceo');
    }
    const at = this.now().toISOString();
    const updated = this.questionRepo.updateStatus(input.questionId, 'escalated', at);
    if (!updated) return { ok: false, error: `question '${input.questionId}' not found` };
    await this.push('agent_question_escalated', { ...updated, target: 'ceo' });
    return { ok: true, question: { ...updated, target: 'ceo' } };
  }

  async close(input: { questionId: string }): Promise<AgentQuestionResult> {
    const record = this.questionRepo.getById(input.questionId);
    if (!record) return { ok: false, error: `question '${input.questionId}' not found` };
    if (record.status === 'closed') {
      return { ok: false, error: `question '${input.questionId}' is already closed` };
    }
    const updated = this.questionRepo.updateStatus(input.questionId, 'closed', this.now().toISOString());
    if (!updated) return { ok: false, error: `question '${input.questionId}' not found` };
    return { ok: true, question: updated };
  }

  async list(input: { agentRef?: string; openOnly?: boolean }): Promise<AgentQuestionListResult> {
    let questions: AgentQuestionRecord[];
    if (input.openOnly) {
      questions = this.questionRepo.listOpen();
    } else if (input.agentRef) {
      questions = this.questionRepo.listByAgent(input.agentRef);
    } else {
      questions = this.questionRepo.listByStatus('pending');
    }
    return { ok: true, questions, count: questions.length };
  }
}
