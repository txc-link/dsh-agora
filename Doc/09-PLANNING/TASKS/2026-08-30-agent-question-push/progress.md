# Progress: Agent Question Push (S5)

> 2026-08-30 · ✅ 全部完成 (develop d002792)

| 轮 | 内容 | 状态 | 证据 |
|---|---|---|---|
| R1 | contracts section 31 | ✅ | AgentQuestionRecord + IAgentQuestionRepository |
| R2 | core service + TDD | ✅ | agent-question-service 11/11 (route/create 推送/answer/escalate/close/list) |
| R3 | db migration 037 + repository | ✅ | 037_agent_questions.sql + 3 索引 + AgentQuestionRepository |
| R4 | CLI + 回归 | ✅ | task-ask-command 7/7; core+db 回归 610/610; build + 双 gate |
| R5 | 冒烟 + merge + 回写 | ✅ | 真实冒烟 7/7 |

## 真实冒烟（隔离 HOME, 真 CLI + migration 037）

1. `ask create --kind resource` → target=ceo（无助手默认直达）✅
2. `ask list --open` → count 1 ✅
3. `ask escalate` → status=escalated, target=ceo ✅
4. `ask answer --by human:ceo` → answered + answer 记录 ✅
5. `ask close` → closed + closedAt ✅
6. `ask list --open` → count 0 ✅
7. closed 后 answer 拒绝 ✅

## 设计偏差记录（对照蓝图 04）

- D1: ResearchRequestService 不单独建 — kind=research + answer 承载结果
- D2: escalation 是状态不是 kind
- D3: answer 不回推 agent（agent 用 ask list/show 轮询; runtime 订阅属未来）
- D4: CLI composition root 暂未注入真实 messagingPort（可选依赖, 不传即无推送不报错）— IM 通道绑定归 Phase 6 matrix transport 真实化时做

## Worktree

- `.dsh/workspaces/agent-question`（已删除）; 分支 feat/agent-question-push 已合并 develop d002792
