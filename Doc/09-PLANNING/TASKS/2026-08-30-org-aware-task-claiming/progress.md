# Progress: Org-Aware Task Claiming

> 日期: 2026-08-30

## 状态: ✅ 全部完成 (已合入 develop 505ce4d)

| 轮 | 内容 | 状态 |
|---|---|---|
| R1 | TaskClaimService 状态机 + repository | ✅ 9/9 通过 |
| R2 | TaskClaimMatcher 职责匹配 | ✅ 9/9 通过 |
| R3 | ResidentAgentPoller 定时轮询 | ✅ 7/7 通过 |
| R4 | CLI 命令 + 集成 | ✅ 7/7 通过 + 真实冒烟 8/8 |
| R5 | 回写 (SSoT + walkthrough + 蓝图) | ✅ 本次 |

## 交付清单

- `contracts/src/repository-interfaces.ts`: section 30 — `TaskClaimRecord` + `ITaskClaimRepository`
- `core/src/task-claim-service.ts` + test: claim/release/expire 状态机
- `core/src/task-claim-matcher.ts` + test: `matchTaskToAgent` 职责匹配
- `core/src/resident-agent-poller.ts` + test: 常驻 agent 轮询
- `core/src/task-claim-command.ts` + test: CLI runner
- `db/src/migrations/036_task_claims.sql` + `task-claim.repository.ts`
- `apps/cli/src/index.ts`: `agora claim {create,release,list,claimable}`
- core index 导出 + db index 导出

## 验证记录

- 新增测试 33 个全绿 (service 9 / matcher 9 / poller 7 / command 7 + boundaries 1)
- core+db 全量回归 **592/592** 通过
- `npm run build` + `gate:core-architecture` + `gate:barrel-governance` 通过
- **真实冒烟 8/8**（隔离 HOME，真实 CLI + migration 036）:
  1. create 任务（--skill typescript 写入 skill_policy）✅
  2. `claim claimable --role role-dev --skills typescript` 匹配到任务 score=2 ✅
  3. `claim create` → claimed（claimedAt/expiresAt 正确）✅
  4. `claim list --agent` 显示认领 ✅
  5. 已认领后 claimable 排除（count 0）✅
  6. 重复认领被拒（明确错误信息）✅
  7. `claim release` → released ✅
  8. 释放后 claimable 恢复（count 1）✅

## 关键发现（实施中）

- **新任务默认直达 `active` 状态**（不是 created）→ claimable 过滤改为 created+active（findings 已录）
- tasks 表无 controller 列 → claim 记录即所有权标记（与 D1 决策自洽）
- 顺手修复: `database.test.ts` 迁移断言在 033-035 加入时就已陈旧（主仓同 commit 可复现失败），本次补齐 033-036

## 决策落地（对应 task_plan D1-D3）

- D1 独立 Claim repository ✅（不污染 Task 状态机）
- D2 skills 交集匹配 ✅（skills_ref ↔ skill_policy.global_refs/role_refs, enforcement 语义）
- D3 core 内 poller ✅（deps 注入式, composition root 绑定）

## Worktree 记录

- worktree: `.dsh/workspaces/org-claim`（已删除）
- 分支: `feat/org-aware-task-claiming`（已合并 develop 505ce4d, 已删除）
- /tmp 与 /home/ailink 直下均 EROFS 只读, worktree 落在插件约定路径 `.dsh/workspaces/`
