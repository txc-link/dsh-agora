# 04 — 主动对话 push（agent → 人 提问 / 调研请求）

> 子能力 S5（用户 turn 159 原话："应该可以主动向我要东西，可以主动调研，不需要我提醒，把我当成公司董事或 CEO，我有助手，很多事就不用找我，而是找我助手"）
> 日期: 2026-08-30

## 1. 现状

| 已有 | 文件 | 说明 |
|---|---|---|
| IM 推送 | `im-ports.ts` (IMPublishMessageInput) | agent → IM 群发消息 |
| 任务广播 | `task-broadcast-service.ts` | 任务状态 → IM |
| 通知 | `notification` 概念 | Core 通知 |
| 助手 | `archon` 概念（archon review / approve） | 人类审批 |

| 缺失 | 说明 |
|---|---|
| **agent 主动发起对话** | agent 不能主动"问人问题"（现在只能被动等在任务里） |
| **提问路由** | 不知道"问谁"（CEO？助手？哪个 agent？） |
| **调研请求** | agent 主动发起 web/外部调研并回报 |

## 2. 设计

### 2.1 核心概念：**AgentQuestion**

```ts
interface AgentQuestion {
  id: string;
  from: string;            // 发起 agent
  to: string | 'assistant' | 'ceo';   // 问谁（助手=优先，CEO=升级）
  kind: 'clarify' | 'resource' | 'approval' | 'info' | 'escalation';
  question: string;        // 问题
  context_refs: string[];  // 相关任务/上下文
  urgency: 'low' | 'medium' | 'high';
  status: 'pending' | 'answered' | 'escalated' | 'closed';
  answer?: string;
}
```

### 2.2 路由规则（用户"把我当 CEO，有事找助手"）

```
agent 有疑问
  ├─→ 助手 (assistant agent) 可答 → 助手答，不回 CEO
  ├─→ 助手不可答 / 高优先级 → 升级到 CEO (用户)
  └─→ CEO 不在 → 挂起 + 提醒 (IM push)
```

### 2.3 主动调研

```
agent 判断需要外部信息
  ├─→ 发起 ResearchRequest (web_search / web_fetch / 文档)
  ├─→ 结果沉淀到共享记忆 (S4)
  └─→ 结论回投任务上下文
```

### 2.4 新组件（规划）

| 组件 | 职责 |
|---|---|
| `AgentQuestionService` | 提问创建 / 路由 / 状态机 |
| `QuestionRouter` | 助手优先 → CEO 升级 |
| `ResearchRequestService` | 主动调研发起 / 结果回收 |
| CLI: `agora ask` / `agora research` | agent 入口 |

## 3. 验收

1. agent 在任务中遇到歧义 → 发问 → 助手收到
2. 助手回答 → agent 继续（CEO 无感）
3. 助手不能答 / 高优 → 升级 CEO → CEO 回答
4. agent 发起调研 → 结果入库共享记忆

## 4. 未决

- "助手"是 agent 还是人类（用户有真人副手？）→ 设计为可配置 `assistant_ref`
- 提问超时未答 → 自动升级策略
- 与现有 archon review 的关系（复用 or 并行）
- 调研能力边界（web 搜索 / 代码库 / 文档库）

## 5. 实施记录（2026-08-30, develop `d002792`）

**已实现**（TDD 18 新测试 + core/db 回归 610/610 + 真实冒烟 7/7）:

| 设计组件 | 实现 | 文件 |
|---|---|---|
| AgentQuestionService | ✅ create/answer/escalate/close/list 状态机 | `core/src/agent-question-service.ts` |
| QuestionRouter | ✅ routeQuestion 纯函数 (assistant 优先→ceo, assistantRef 可配置解耦 U2) | 同上 |
| IM 推送缝 | ✅ QuestionMessagingPort (复用 NotificationPayload; core 零平台名) | 同上 + im-ports |
| CLI | ✅ `agora ask {create,list,show,answer,escalate,close}` | `apps/cli` + `core/src/task-ask-command.ts` |
| 存储 | ✅ migration 037_agent_questions + AgentQuestionRepository | `db/src` |
| ResearchRequestService | ✅ 以 kind=research + answer 承载（D1 修正, 不单独建服务） | planning findings D1 |

**实施偏差**（对照本蓝图, 全部记录于 planning findings）:
- escalation 是状态不是 kind（D2）
- answer 不回推 agent, agent 轮询 `ask list/show`（D3; runtime 事件订阅属未来）
- IM 真实通道绑定（composition root 注入 adapter）归 Phase 6 matrix transport 真实化（D4）

**未决继承**: 提问超时自动升级策略（未实现, 需求方拍板）; 与 archon review 关系（未触碰）
