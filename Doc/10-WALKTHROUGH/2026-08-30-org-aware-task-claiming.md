# Walkthrough — Org-Aware Task Claiming (S2 主动任务接取)

> 日期: 2026-08-30
> 分支: `feat/org-aware-task-claiming` → develop `505ce4d`
> Planning: `Doc/09-PLANNING/TASKS/2026-08-30-org-aware-task-claiming/`
> Architecture: `Doc/03-ARCHITECTURE/org-aware-work-os/02-task-claiming.md`

## 1. 目标

用户愿景（公司化 agent 组织）的 S2: "常驻 agent 定期查看任务台，对应职责的 agent 接取对应任务"。让 agent 从被动接活变成主动认领。

## 2. 交付

| 层 | 内容 |
|---|---|
| contracts | `TaskClaimRecord` / `ITaskClaimRepository`（repository-interfaces section 30） |
| core | `TaskClaimService`（claim/release/expire 状态机） |
| core | `matchTaskToAgent`（职责匹配: agent skills_ref/role ↔ task skill_policy, enforcement required/advisory 语义） |
| core | `ResidentAgentPoller`（定时轮询 + 匹配 + 自动认领, deps 全注入） |
| core | `runTaskClaimCommand`（CLI runner: claim/release/list/claimable） |
| db | migration `036_task_claims.sql` + `TaskClaimRepository` |
| cli | `agora claim {create,release,list,claimable}` |

## 3. 设计要点

- **Claim 独立于 Task 状态机**（D1）: 认领是"所有权动作"不是任务状态; tasks 表无 controller 列, claim 记录即所有权标记; released/expired 保留历史, 允许重新认领
- **匹配语义**（D2）: `skill_policy.global_refs` required=全满足/advisory=至少1命中; `role_refs[agent.roleId]` 命中时必须满足; 无 skill_policy → 默认匹配 (score 1)
- **先到先得**: poller 循环内首个 matched agent 认领; claim 原子性由 service 校验（已 claimed 则拒绝）
- **claimable 状态**（实施修正 D4）: created + active（`agora create` 直达 active, 不滞留 created）

## 4. 验证

- TDD: 33 新测试（service 9 / matcher 9 / poller 7 / command 7 + boundaries 1）全绿
- 回归: core+db 592/592; `npm run build`; `gate:core-architecture`; `gate:barrel-governance`
- 真实冒烟 8/8（隔离 HOME, 真 CLI + migration 036）:
  创建带 skill_policy 任务 → claimable 匹配 (score 2) → claim (claimedAt/expiresAt 正确) → list → claimable 排除已认领 → 重复认领被拒 → release → claimable 恢复

## 5. 过程记录

- worktree: `.dsh/workspaces/org-claim`（/tmp 与 /home/ailink 直下 EROFS, 落插件约定路径）; 合并后已删除（Worktree Hygiene）
- 顺手修复: `database.test.ts` 迁移断言在 033-035 加入时已陈旧（主仓同 commit 复现失败）, 本次补齐 033-036
- 环境坑: worktree 全新 node_modules 装不全 → 复制主仓 node_modules + 重定向 @agora-ts symlink 到 worktree packages; vitest 需 `./node_modules/.bin/vitest` 直调（npx 会解析到 registry 最新版）

## 6. 未做 / 下一轮

- DelegateRouter（S3: 认领后按组织架构委派下级 + 群组通知）— 依赖 01-org-model.md 的 Team 模型
- Poller 的 composition root 落地（server 侧常驻进程 + agent 配置源: citizens/roster）
- matrix connector transport 真实化（Phase 6, 群聊入口）
