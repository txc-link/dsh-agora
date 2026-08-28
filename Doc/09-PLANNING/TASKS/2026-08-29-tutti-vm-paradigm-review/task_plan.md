# Task: Tutti·VM Paradigm Review (2026-08-29)

## 1. 目标

用户(t=55) 提供 Tutti·VM 产品介绍, 要求"结合这个产品介绍想一下我们应该怎么实现目标"。

**任务目标**:
- 用 §1.5 first-principles 拆 Tutti·VM 的本质机制
- **不**照抄 SaaS Room, 只采纳真缺的部分
- 把跨子话题 brainstorm 全落盘 (按 §3 discussion-landing 规则)

## 2. §1 + §1.5 + §2 约束

- §1: agora 中央的语义不变 — 这次 brainstorm **不**动 Core 代码
- §1.5: 不照抄 SaaS, 不主动扩展到用户未要求的范围
- §2: 不补 CLI/REST/plugin 入口 (这是 brainstorm, 还没到实现)
- §3: 建立 task_dir + architecture 子目录
- §4: 不需要 TDD (没写代码)

## 3. Tutti·VM 4 机制 vs 我们现状

| 机制 | Tutti·VM | 我们 | 借鉴? |
|---|---|---|---|
| 共享状态层 | Room = 文件 + 预览 + 任务 + 历史 | agora Task + matrix thread — **两层分开** | 🟠 必 |
| @深度引用 = pull 对象 | @task_id = 完整 task 在上下文 | @<citizen> = 只是 IM 通知 | 🔴 必 |
| Agent 借用 (跨房, 共享额度) | A 的 Agent 跑在 B 的 Room | dsh-agent-teams 是 captain+member, 不能借出 | 🟠 应 |
| Room 内置应用 | 工具 = Room 对象 | 工具是 agent 内置, 不是 Room 对象 | 🟡 暂不做 |
| 本地凭证不离开 | Agent 跑本地 VM | ✅ 我们已经是 — DSH 优势 | ✅ 不缺 |

## 4. 借鉴到我们的方案 — 4 phase 实施顺序

### Phase 1 — 共享工作现场层 (WorkSite 抽象 + URI 协议)
- agora 中央加 WorkSite 抽象
- URI: `agora://task/<id>`, `agora://thread/<key>`, `agora://commit/<sha>`, `agora://watch/<id>`

### Phase 2 — @深度引用 = pull 对象
- dsh-matrix-connector 解析消息里的 `agora://` URI
- agent 收到的事件 payload 直接 embed 对象

### Phase 3 — Agent 借用 + 受控 ACL
- agora 加 borrow_request + borrow_approval
- dashboard 强制人 confirm
- matrix-connector `/agora borrow` slash command

### Phase 4 — 真任务 end-to-end
- 选1 个真项目跑, 验证体感

## 5. 阶段

1. ✅ turn 55 step 1: 拆 Tutti·VM 4 机制, 定位真缺
2. ✅ turn 55 step 2: 建立 task_dir + architecture 子目录
3. ⏳ 写 task_plan.md (本文件)
4. ⏳ 写 findings.md
5. ⏳ 写 progress.md
6. ⏳ 写 architecture 子目录 README + 子话题 + undecided.md

## 6. Constitution Constraints

- 不动 Core 代码 (这次 brainstorm 不实现)
- 不写 SaaS Room
- 不主动装新插件 (除非用户确认)
- SSoT 不强制 — turn 38 已确认 SSoT 不存在不作 §3 阻断

## 7. 跟踪

- task_plan: 本文件
- findings: `findings.md`
- progress: `progress.md`
- architecture: `Doc/03-ARCHITECTURE/2026-08-29-shared-work-site/README.md`