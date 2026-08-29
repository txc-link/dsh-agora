import { describe, expect, it } from 'vitest';
import { runTaskAskCommand } from './task-ask-command.js';
import { AgentQuestionService } from './agent-question-service.js';
import type { AgentQuestionRecord, IAgentQuestionRepository } from '@agora-ts/contracts';

function makeRepo(seed: AgentQuestionRecord[] = []): IAgentQuestionRepository {
  const store: AgentQuestionRecord[] = [...seed];
  let seq = 0;
  const clone = (r: AgentQuestionRecord): AgentQuestionRecord => ({ ...r });
  return {
    insert(input) {
      seq += 1;
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
        createdAt: '2026-08-30T10:00:00.000Z',
        metadata: null,
      };
      store.push(record);
      return clone(record);
    },
    getById: (id) => {
      const found = store.find((r) => r.id === id);
      return found ? clone(found) : null;
    },
    listByStatus: (status) => store.filter((r) => r.status === status).map(clone),
    listByAgent: (agentRef) => store.filter((r) => r.agentRef === agentRef).map(clone),
    listOpen: () => store.filter((r) => r.status === 'pending' || r.status === 'escalated').map(clone),
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

function makeDeps(seed?: AgentQuestionRecord[]) {
  const repo = makeRepo(seed);
  const service = new AgentQuestionService({
    questionRepo: repo,
    assistantRef: 'agent:assistant',
    ceoRef: 'human:ceo',
  });
  return { deps: { questionService: service, questionRepo: repo }, repo };
}

describe('runTaskAskCommand', () => {
  it('create: 缺 --agent 报错', async () => {
    const { deps } = makeDeps();
    const result = await runTaskAskCommand(deps, { subcommand: 'create', askQuestion: 'x' });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('--agent');
  });

  it('create: 非法 kind 报错', async () => {
    const { deps } = makeDeps();
    const result = await runTaskAskCommand(deps, {
      subcommand: 'create', createAgentRef: 'agent:dev-1', askKind: 'bogus', askQuestion: 'x',
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('invalid --kind');
  });

  it('create: 成功路由到 assistant', async () => {
    const { deps } = makeDeps();
    const result = await runTaskAskCommand(deps, {
      subcommand: 'create', createAgentRef: 'agent:dev-1', askKind: 'resource', askQuestion: '需要凭据',
    });
    expect(result.ok).toBe(true);
    expect((result.data as AgentQuestionRecord).target).toBe('assistant');
  });

  it('list --open 只含 pending+escalated', async () => {
    const { deps } = makeDeps([
      { id: 'q-1', taskId: null, agentRef: 'a', kind: 'info', question: 'x', context: null, target: 'assistant', status: 'pending', answer: null, answeredBy: null, answeredAt: null, escalatedAt: null, closedAt: null, createdAt: 't', metadata: null },
      { id: 'q-2', taskId: null, agentRef: 'a', kind: 'info', question: 'x', context: null, target: 'ceo', status: 'answered', answer: 'y', answeredBy: 'b', answeredAt: 't', escalatedAt: null, closedAt: null, createdAt: 't', metadata: null },
      { id: 'q-3', taskId: null, agentRef: 'a', kind: 'info', question: 'x', context: null, target: 'ceo', status: 'escalated', answer: null, answeredBy: null, answeredAt: null, escalatedAt: 't', closedAt: null, createdAt: 't', metadata: null },
    ]);
    const result = await runTaskAskCommand(deps, { subcommand: 'list', listOpenOnly: true });
    expect(result.ok).toBe(true);
    expect((result.data as { count: number }).count).toBe(2);
  });

  it('show: 不存在报错', async () => {
    const { deps } = makeDeps();
    const result = await runTaskAskCommand(deps, { subcommand: 'show', questionId: 'nope' });
    expect(result.ok).toBe(false);
  });

  it('answer → escalate → close 全链路', async () => {
    const { deps, repo } = makeDeps();
    const created = await runTaskAskCommand(deps, {
      subcommand: 'create', createAgentRef: 'agent:dev-1', askQuestion: '歧义', askKind: 'clarify',
    });
    const id = (created.data as AgentQuestionRecord).id;
    const closed = await runTaskAskCommand(deps, {
      subcommand: 'close', questionId: id,
    });
    expect(closed.ok).toBe(true);
    expect((closed.data as AgentQuestionRecord).status).toBe('closed');
    expect(repo.getById(id)?.status).toBe('closed');
  });

  it('escalate 后 target 强制 ceo', async () => {
    const { deps } = makeDeps();
    const created = await runTaskAskCommand(deps, {
      subcommand: 'create', createAgentRef: 'agent:dev-1', askQuestion: '歧义',
    });
    const id = (created.data as AgentQuestionRecord).id;
    const esc = await runTaskAskCommand(deps, { subcommand: 'escalate', questionId: id });
    expect(esc.ok).toBe(true);
    const record = esc.data as AgentQuestionRecord;
    expect(record.status).toBe('escalated');
    expect(record.target).toBe('ceo');
  });
});
