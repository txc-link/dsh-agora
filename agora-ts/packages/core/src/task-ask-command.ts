/**
 * task-ask-command.ts — org-aware-work-os S5: Agent 主动提问 CLI 入口 (§2 Entry Surface).
 *
 * Subcommands: create | list | show | answer | escalate | close. Plain JSON output.
 * Agent 通过 create 发问; 助手/CEO 通过 answer 回填; escalate 升级直达 CEO。
 * No interactive prompts (the CLI is for agents, not humans; humans use Dashboard).
 */

import type { IAgentQuestionRepository } from '@agora-ts/contracts';
import type { AgentQuestionKind } from '@agora-ts/contracts';
import { AgentQuestionService } from './agent-question-service.js';

export interface TaskAskCommandDeps {
  questionService: AgentQuestionService;
  questionRepo: IAgentQuestionRepository;
}

export type TaskAskSubcommand = 'create' | 'list' | 'show' | 'answer' | 'escalate' | 'close';

export interface RunTaskAskCommandOptions {
  subcommand: TaskAskSubcommand;
  // create
  createAgentRef?: string;
  askKind?: string;
  askQuestion?: string;
  askTaskId?: string;
  askContext?: string;
  // list
  listAgent?: string;
  listOpenOnly?: boolean;
  // show
  questionId?: string;
  // answer
  answeredBy?: string;
  answerText?: string;
}

export interface TaskAskCommandResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

const VALID_KINDS: readonly AgentQuestionKind[] = ['clarify', 'resource', 'approval', 'info', 'research'];

export async function runTaskAskCommand(
  deps: TaskAskCommandDeps,
  options: RunTaskAskCommandOptions,
): Promise<TaskAskCommandResult> {
  switch (options.subcommand) {
    case 'create':
      return runCreate(deps, options);
    case 'list':
      return runList(deps, options);
    case 'show':
      return runShow(deps, options);
    case 'answer':
      return runAnswer(deps, options);
    case 'escalate':
      return runEscalate(deps, options);
    case 'close':
      return runClose(deps, options);
    default:
      return { ok: false, error: `unknown subcommand: ${options.subcommand}` };
  }
}

function requireString(value: string | undefined, field: string): string | null {
  if (value === undefined || value === '') {
    return `${field} is required`;
  }
  return null;
}

async function runCreate(deps: TaskAskCommandDeps, options: RunTaskAskCommandOptions): Promise<TaskAskCommandResult> {
  const missing = requireString(options.createAgentRef, '--agent')
    ?? requireString(options.askQuestion, '--question');
  if (missing) return { ok: false, error: missing };
  const kind = (options.askKind ?? 'clarify') as AgentQuestionKind;
  if (!VALID_KINDS.includes(kind)) {
    return { ok: false, error: `invalid --kind '${options.askKind}'; valid: ${VALID_KINDS.join('|')}` };
  }
  const result = await deps.questionService.create({
    agentRef: options.createAgentRef as string,
    kind,
    question: options.askQuestion as string,
    ...(options.askTaskId !== undefined ? { taskId: options.askTaskId } : {}),
    ...(options.askContext !== undefined ? { context: options.askContext } : {}),
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: result.question };
}

async function runList(deps: TaskAskCommandDeps, options: RunTaskAskCommandOptions): Promise<TaskAskCommandResult> {
  const result = await deps.questionService.list({
    ...(options.listAgent !== undefined ? { agentRef: options.listAgent } : {}),
    ...(options.listOpenOnly ? { openOnly: true } : {}),
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: { questions: result.questions, count: result.count } };
}

async function runShow(deps: TaskAskCommandDeps, options: RunTaskAskCommandOptions): Promise<TaskAskCommandResult> {
  const missing = requireString(options.questionId, '--id');
  if (missing) return { ok: false, error: missing };
  const record = deps.questionRepo.getById(options.questionId as string);
  if (!record) return { ok: false, error: `question '${options.questionId}' not found` };
  return { ok: true, data: record };
}

async function runAnswer(deps: TaskAskCommandDeps, options: RunTaskAskCommandOptions): Promise<TaskAskCommandResult> {
  const missing = requireString(options.questionId, '--id')
    ?? requireString(options.answeredBy, '--by')
    ?? requireString(options.answerText, '--answer');
  if (missing) return { ok: false, error: missing };
  const result = await deps.questionService.answer({
    questionId: options.questionId as string,
    answeredBy: options.answeredBy as string,
    answer: options.answerText as string,
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: result.question };
}

async function runEscalate(deps: TaskAskCommandDeps, options: RunTaskAskCommandOptions): Promise<TaskAskCommandResult> {
  const missing = requireString(options.questionId, '--id');
  if (missing) return { ok: false, error: missing };
  const result = await deps.questionService.escalate({ questionId: options.questionId as string });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: result.question };
}

async function runClose(deps: TaskAskCommandDeps, options: RunTaskAskCommandOptions): Promise<TaskAskCommandResult> {
  const missing = requireString(options.questionId, '--id');
  if (missing) return { ok: false, error: missing };
  const result = await deps.questionService.close({ questionId: options.questionId as string });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: result.question };
}
