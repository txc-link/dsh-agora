# Dashboard Baseline Cleanup — Task Plan

**Date**: 2026-08-30
**Worktree**: `/home/ailink/dsh-agora/.worktrees/dashboard-baseline-cleanup`
**Branch**: `feat/dashboard-baseline-cleanup` (from master `feaea47`)
**Owner**: 总工
**Goal**: dashboard `npx tsc -b` 0 errors (清除债 1: typedrift 阻塞 CI)

---

## §1 总工排期

| 轮 | 范围 | 状态 |
|---|---|---|
| 1.1 | 真实范围侦察 (subagent) — 发现 brief 假设错 | ✅ done |
| 1.2 | 编译 `agora-ts/packages/contracts` 生成 dist (消除 97 个 zod resolve errors) | ✅ done |
| 1.3 | 修 3 个真实 typedrift (task.ts:277 + 2 fixture) | ✅ done |
| 1.4 | 收口 commit + merge + 删 worktree | ⏳ in_progress |

---

## §2 真实路径 (与 brief 假设完全不同)

### §2.1 brief 假设 (错)
- `npx tsc -b` = 10 errors (dashboard src typedrift)
- 修这 10 个即清债

### §2.2 实际 (4 层叠加)
1. **devDeps 缺失**: `NODE_ENV=production` 让 `npm install` 跳过 devDeps, `@types/node`/`@vitejs/plugin-react`/`vitest` 全没装 → TS 报"Cannot find type definition file" (3 个 errors, R-F.1 subagent 把这误判为 baseline typedrift)
2. **contracts zod resolve 失败**: `agora-ts/packages/contracts/src/*.ts` `import { z } from 'zod'`, worktree `agora-ts/` 没 `node_modules/`, TS bundler resolution 不跨 worktree 边界 → **97 个 errors** (TS2307 + TS7006 + TS18046)
3. **真实 dashboard typedrift**: devDeps 装齐后浮现 **3 个 typedrift** (不是 10 个):
   - `src/types/task.ts(277)` — `TaskConversationEntry.binding_id: string` 应为 `string | null` (R-D 时代遗留, API DTO 是 nullable)
   - `src/test/taskMappers.test.ts(165)` — fixture 缺 `thread_task_binding_id`
   - `src/test/taskStore.live-api.test.ts(391)` — fixture 缺 `thread_task_binding_id`
4. **额外 31 个 src typedrift** (subagent 侦察发现的 api.ts / dashboardExpansionMappers.ts / projectContextMappers.ts / HumanAccountsPanel.tsx implicit any) — 修了 devDeps 后**没有浮现**, 是 subagent 误报

### §2.3 修复路径选择

| 方案 | 操作 | agora-ts 改动 | dashboard src 改动 | 结果 |
|---|---|---|---|---|
| ❌ symlink zod | `ln -s dashboard/node_modules/zod agora-ts/.../zod` | 新增 node_modules/ 目录 | 无 | contracts errors 解决, 但污染 agora-ts 树 |
| ✅ **编译 contracts dist** (采用) | `cd agora-ts/packages/contracts && npm install && npm run build` | **仅生 dist** (.gitignore 排除, 不进 commit) | 无 | contracts errors 解决, **不污染** |
| ❌ 修 src + 不动 contracts | 仅修 brief 10 + 额外 31 | 无 | 改 41 个 src | tsc-b 仍有 97 contracts errors |
| ✅ **完整路径** (采用) | 编译 contracts + 修 3 typedrift | 仅生 dist | 改 3 个文件 | tsc-b **0 errors** |

### §2.4 严格守约

- ✅ **未触碰 agora-ts src**: dist 是 build 产物, `.gitignore` 已排除
- ✅ **未修改 package.json / package-lock.json**: contracts dist 是 compile 产物, 不改 dep tree
- ✅ **未触碰 R-F.1/R-F.2 代码**: TaskDetailSheet.tsx / agora-client.ts / task.ts(原文件)/ agora.ts / ProjectDetailPage.tsx 完全未读未改
- ⚠️ task.ts **有 1 处修改**: `binding_id: string` → `string | null` (R-D 时代遗留 typedrift, 债 1 核心, 不算扩展 scope)

---

## §3 文件改动清单

| 文件 | 改动 |
|---|---|
| `dashboard/src/types/task.ts` | `binding_id: string` → `binding_id: string \| null` |
| `dashboard/src/test/taskMappers.test.ts` | entry-status-1 fixture 加 `thread_task_binding_id: null` |
| `dashboard/src/test/taskStore.live-api.test.ts` | entry-1 fixture 加 `thread_task_binding_id: null` |
| `agora-ts/packages/contracts/dist/**` | build 产物 (gitignore, 不进 commit) |

3 file changes / +4 lines / -1 line

---

## §4 Cross-references

- **agora-ts SSoT**: `docs/Agora-实施排期-Agora-TS.md` §3.5 (R-D baseline 债已记, 本轮修复闭环)
- **Dashboard SSoT**: `Doc/Agora-实施排期-Dashboard.md` (收口时加 baseline cleanup 状态行)
- **R-F.1 walkthrough**: `Doc/10-WALKTHROUGH/2026-08-30-r-f-thread-web-detail-v01.md` (R-F.1 subagent 报告错的 "3 ts errors = typedrift" 解释见 findings §1.3)
- **AGENTS.md §1.5**: 不允许兼容性/补丁方案 — 编译 dist 是正常 npm build 流程, 修 typedrift 是 §1.5 "先打模型对"

---

## §5 Change Log

- 2026-08-30: task_plan 建立; 总工排期 4 轮; 修复路径 = 编译 contracts + 改3 typedrift