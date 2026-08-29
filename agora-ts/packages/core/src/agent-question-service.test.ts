import { describe, expect, it } from 'vitest';
import { AgentQuestionService, routeQuestion } from './agent-question-service.js';
import { StubIMMessagingPort } from './im-ports.js';
import type { AgentQuestionRecord, IAgentQuestionRepository } from '@agora-ts/contracts';

function makeQuestion(overrides: Partial<AgentQuestionRecord> = {}): AgentQuestionRecord {
  return {
    id: 'q-1',
    taskId: null,
    agentRef: 'agent:dev-1',
    kind: 'clarify',
    question: '表结构有歧义',
    context: null,
    target: 'assistant',
    status: 'pending',
    answer: null,
    answeredBy: null,
    answeredAt: null,
    escalatedAt: null,
    closedAt: null,
    createdAt: '2026-08-30T10:00:00.000Z',
    metadata: null,
    ...overrides,
  };
}

function makeRepo(seed: AgentQuestionRecord[] = []): IAgentQuestionRepository & { store: AgentQuestionRecord[] } {
  const store: AgentQuestionRecord[] = [...seed];
  let seq = 0;
  const clone = (r: AgentQuestionRecord): AgentQuestionRecord => ({ ...r });
  return {
    store,
    insert(input) {
      seq += 1;
      const now = '2026-08-30T10:00:00.000Z';
      const record: AgentQuestionRecord = {
        id: input.id ?? `q-${seq}`,
        taskId: input.taskId ?? null,
        agentRef: input.agentRef,
        kind: input.kind,
        question: input.question,
        context: input.context ?? null,
        target: input.target,
        status: 'pending',
        answer: null,
        answeredBy: null,
        answeredAt: null,
        escalatedAt: null,
        closedAt: null,
        createdAt: now,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      };
      store.push(record);
      return clone(record);
    },
    getById(id) {
      const found = store.find((r) => r.id === id);
      return found ? clone(found) : null;
    },
    listByStatus(status) {
      return store.filter((r) => r.status === status).map(clone);
    },
    listByAgent(agentRef) {
      return store.filter((r) => r.agentRef === agentRef).map(clone);
    },
    listOpen() {
      return store.filter((r) => r.status !== 'closed' && r.status !== 'answered').map(clone);
    },
    updateStatus(id, status, at) {
      const found = store.find((r) => r.id === id);
      if (!found) return null;
      if (status === 'escalated') found.escalatedAt = at;
      if (status === 'closed') found.closedAt = at;
      found.status = status;
      return clone(found);
    },
    updateAnswer(id, answer, answeredBy, answeredAt) {
      const found = store.find((r) => r.id === id);
      if (!found) return null;
      found.answer = answer;
      found.answeredBy = answeredBy;
      found.answeredAt = answeredAt;
      return clone(found);
    },
    updateTarget(id, target) {
      const found = store.find((r) => r.id === id);
      if (!found) return null;
      found.target = target;
      return clone(found);
    },
  };
}

describe('routeQuestion', () => {
  it('配置了助手 → assistant', () => {
    expect(routeQuestion({ assistantRef: 'agent:assistant' })).toEqual({ target: 'assistant' });
  });

  it('未配置助手 → ceo', () => {
    expect(routeQuestion({ assistantRef: null })).toEqual({ target: 'ceo' });
  });
});

describe('AgentQuestionService', () => {
  it('create: 有助手 → target=assistant, pending, 推送通知给助手 ref', async () => {
    const repo = makeRepo();
    const im = new StubIMMessagingPort();
    const service = new AgentQuestionService({
      questionRepo: repo,
      messagingPort: im,
      assistantRef: 'agent:assistant',
      ceoRef: 'human:ceo',
    });
    const result = await service.create({
      agentRef: 'agent:dev-1',
      kind: 'clarify',
      question: '表结构有歧义',
      taskId: 'T-1',
    });
    expect(result.ok).toBe(true);
    const record = result.question!;
    expect(record.status).toBe('pending');
    expect(record.target).toBe('assistant');
    expect(im.sent).toHaveLength(1);
    expect(im.sent[0].targetRef).toBe('agent:assistant');
    expect(im.sent[0].payload.event_type).toBe('agent_question_created');
  });

  it('create: 无助手 → target=ceo, 推送通知给 ceo ref', async () => {
    const repo = makeRepo();
    const im = new StubIMMessagingPort();
    const service = new AgentQuestionService({
      questionRepo: repo,
      messagingPort: im,
      assistantRef: null,
      ceoRef: 'human:ceo',
    });
    const result = await service.create({
      agentRef: 'agent:dev-1',
      kind: 'resource',
      question: '需要 qdrant 凭据',
    });
    expect(result.ok).toBe(true);
    expect(result.question!.target).toBe('ceo');
    expect(im.sent[0].targetRef).toBe('human:ceo');
  });

  it('answer: pending → answered, 记录 answer/answeredBy/answeredAt', async () => {
    const repo = makeRepo([makeQuestion()]);
    const service = new AgentQuestionService({ questionRepo: repo });
    const result = await service.answer({
      questionId: 'q-1',
      answeredBy: 'agent:assistant',
      answer: '用方案 B',
    });
    expect(result.ok).toBe(true);
    expect(result.question!.status).toBe('answered');
    expect(result.question!.answer).toBe('用方案 B');
    expect(result.question!.answeredBy).toBe('agent:assistant');
    expect(result.question!.answeredAt).not.toBeNull();
  });

  it('answer: closed 问题被拒', async () => {
    const repo = makeRepo([makeQuestion({ status: 'closed' })]);
    const service = new AgentQuestionService({ questionRepo: repo });
    const result = await service.answer({ questionId: 'q-1', answeredBy: 'x', answer: 'y' });
    expect(result.ok).toBe(false);
  });

  it('escalate: pending → escalated, target 强制 ceo, 推送通知给 ceo', async () => {
    const repo = makeRepo([makeQuestion()]);
    const im = new StubIMMessagingPort();
    const service = new AgentQuestionService({
      questionRepo: repo,
      messagingPort: im,
      assistantRef: 'agent:assistant',
      ceoRef: 'human:ceo',
    });
    const result = await service.escalate({ questionId: 'q-1' });
    expect(result.ok).toBe(true);
    expect(result.question!.status).toBe('escalated');
    expect(result.question!.target).toBe('ceo');
    expect(result.question!.escalatedAt).not.toBeNull();
    expect(im.sent[0].targetRef).toBe('human:ceo');
    expect(im.sent[0].payload.event_type).toBe('agent_question_escalated');
  });

  it('escalate: 已 answered 被拒', async () => {
    const repo = makeRepo([makeQuestion({ status: 'answered' })]);
    const service = new AgentQuestionService({ questionRepo: repo });
    const result = await service.escalate({ questionId: 'q-1' });
    expect(result.ok).toBe(false);
  });

  it('close: answered → closed', async () => {
    const repo = makeRepo([makeQuestion({ status: 'answered' })]);
    const service = new AgentQuestionService({ questionRepo: repo });
    const result = await service.close({ questionId: 'q-1' });
    expect(result.ok).toBe(true);
    expect(result.question!.status).toBe('closed');
    expect(result.question!.closedAt).not.toBeNull();
  });

  it('close: pending 也可撤回关闭', async () => {
    const repo = makeRepo([makeQuestion()]);
    const service = new AgentQuestionService({ questionRepo: repo });
    const result = await service.close({ questionId: 'q-1' });
    expect(result.ok).toBe(true);
    expect(result.question!.status).toBe('closed');
  });

  it('list: open 只含 pending+escalated', async () => {
    const repo = makeRepo([
      makeQuestion({ id: 'q-1' }),
      makeQuestion({ id: 'q-2', status: 'escalated' }),
      makeQuestion({ id: 'q-3', status: 'answered' }),
      makeQuestion({ id: 'q-4', status: 'closed' }),
    ]);
    const service = new AgentQuestionService({ questionRepo: repo });
    const result = await service.list({ openOnly: true });
    expect(result.ok).toBe(true);
    expect(result.questions!.map((q) => q.id).sort()).toEqual(['q-1', 'q-2']);
  });

  it('answer: kind=research 时自动写回共享记忆', async () => {
    const repo = makeRepo([
      makeQuestion({ id: 'q-r1', kind: 'research', question: 'qdrant 与 mem0 的取舍' }),
    ]);
    const added: Array<Record<string, unknown>> = [];
    const service = new AgentQuestionService({
      questionRepo: repo,
      ceoRef: 'human:ceo',
      groupMemory: {
        add: async (input) => {
          added.push(input as Record<string, unknown>);
          return { id: 'mem-1' } as never;
        },
      },
    });
    const result = await service.answer({
      questionId: 'q-r1',
      answeredBy: 'agent:dev-1',
      answer: '结论: mem0 适合对话记忆, qdrant 适合向量检索',
    });
    expect(result.ok).toBe(true);
    expect(added).toHaveLength(1);
    expect(added[0]!.kind).toBe('research');
    expect(String(added[0]!.text)).toContain('mem0 适合对话记忆');
    expect(added[0]!.agentRef).toBe('agent:dev-1');
  });

  it('answer: kind 非 research 不写共享记忆; 写入失败不影响 answer', async () => {
    const repo = makeRepo([
      makeQuestion({ id: 'q-c1', kind: 'clarify' }),
      makeQuestion({ id: 'q-r2', kind: 'research', question: '调研' }),
    ]);
    let calls = 0;
    const service = new AgentQuestionService({
      questionRepo: repo,
      ceoRef: 'human:ceo',
      groupMemory: {
        add: async () => {
          calls += 1;
          throw new Error('mem0 down');
        },
      },
    });
    const clarify = await service.answer({ questionId: 'q-c1', answeredBy: 'human:ceo', answer: 'ok' });
    expect(clarify.ok).toBe(true);
    expect(calls).toBe(0);
    const research = await service.answer({ questionId: 'q-r2', answeredBy: 'agent:dev-1', answer: 'findings' });
    expect(research.ok).toBe(true);
    expect(calls).toBe(1);
    expect(repo.getById('q-r2')?.status).toBe('answered');
  });
});
