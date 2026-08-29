# Walkthrough — Agent Question Push (S5 主动对话 push)

> 日期: 2026-08-30 · 分支: `feat/agent-question-push` → develop `d002792`
> Planning: `Doc/09-PLANNING/TASKS/2026-08-30-agent-question-push/`
> Architecture: `Doc/03-ARCHITECTURE/org-aware-work-os/04-proactive-push.md`

## 1. 目标

用户愿景 S5: "agent 遇到问题主动向我要东西，我有助手挡事"。Agent 发问 → 助手优先应答 → 助手处理不了升级 CEO。

## 2. 交付

| 层 | 内容 |
|---|---|
| contracts | `AgentQuestionRecord` / `IAgentQuestionRepository`（section 31） |
| core | `routeQuestion` 纯函数: 有 assistantRef → assistant, 否则 → ceo |
| core | `AgentQuestionService`: create/answer/escalate/close/list; 状态机 pending→answered\|escalated→answered, *→closed |
| core | `QuestionMessagingPort` 推送缝: create/escalate 通知 routed target（core 零平台名, adapter 注入） |
| db | migration `037_agent_questions.sql` + `AgentQuestionRepository` |
| cli | `agora ask {create,list,show,answer,escalate,close}` |

## 3. 设计要点（第一性原理修正, planning findings D1-D4）

- **ResearchRequestService 不单独建**: "发起调研→结果回填" 语义上就是 question(kind=research)→answer; 单独 service 是重复状态机
- **escalation 是状态不是 kind**: pending→escalated 是转换
- **answer 不回推**: agent 轮询 `ask list/show`（与任务台模式一致）; runtime 事件订阅属未来
- **U2 解耦**: assistantRef/ceoRef 是构造注入的 ref 字符串, core 不知道背后是 agent 还是人
- **IM 真实通道绑定**: composition root 暂未注入 adapter（可选依赖, 不传不报错）, 归 Phase 6

## 4. 验证

- TDD: 18 新测试（service 11 / command 7）全绿; core+db 回归 **610/610**; build + 双 gate
- 真实冒烟 7/7（隔离 HOME）: create(target=ceo) → list --open → escalate(target=ceo) → answer → close → list 空 → closed 后 answer 拒绝

## 5. 未做 / 下一轮

- S2 收尾: Poller composition root（server 常驻启动）+ expire 周期扫描
- S4 共享记忆（mem0 adapter, 用户指定复用）
- 调研结果写回共享记忆（依赖 S4）
