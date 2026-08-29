# Walkthrough — Dashboard Baseline Cleanup v0.1

**Date**: 2026-08-30 (Asia/Shanghai)
**Branch**: `feat/dashboard-baseline-cleanup` (worktree `/home/ailink/dsh-agora/.worktrees/dashboard-baseline-cleanup`)
**Author**: 总工
**Status**: ✅ done (dashboard `npx tsc -b` 0 errors, exit 0)

---

## 1. TL;DR

dashboard typedrift 债 1 完整闭环：
- **根因不是 typedrift**，是 **4 层叠加**：devDeps 缺失 + contracts zod resolve 失败 + 3 个真实 typedrift（brief 误判）
- **修复路径 = 编译 contracts 生成 dist + 改 3 个真实 typedrift**
- **未触碰 agora-ts src / package.json / R-F.1/R-F.2 代码**
- **`npx tsc -b` 0 errors, exit 0** ✓

## 2. 问题分层（与 brief 假设完全不同）

| 层 | 错误数 | 根因 | 修复 |
|---|---|---|---|
| 1. devDeps 缺失 | 3 | `NODE_ENV=production` 跳过 `@types/node`/`vitest`/`@vitejs/plugin-react` | `npm install --include=dev` |
| 2. contracts zod resolve | 97 | `agora-ts/` 无 node_modules, TS bundler 不跨 worktree | `npm run build` 生成 dist |
| 3. 真实 dashboard typedrift | 3 | R-D 时代 `TaskConversationEntry.binding_id` nullable 不匹配 + fixture 缺字段 | 改 view model 类型 + 加 fixture 字段 |

**brief 误判**：R-F.1 subagent turn 144 报告的 "3 ts errors = main baseline typedrift" 实际是层 1（devDeps 缺失），不是 typedrift。

## 3. 修复路径选择

| 方案 | agora-ts 改动 | dashboard 改动 | tsc-b | 守 §1.5 |
|---|---|---|---|---|
| symlink zod | 新增 node_modules/ | 无 | ✗ 仍有 3 src errors | 边界 |
| **编译 contracts dist**（采用） | 仅 dist（.gitignore 排除） | 改 3 个文件 | ✅ 0 errors | ✓ |
| 改 src 不动 contracts | 无 | 改 41 个 src | ✗ 仍有 97 contracts errors | ✓ |

**§1.5 守约**：编译 dist 是正常 npm build 流程（master 历史就在跑），不是兜底/补丁。

## 4. Files Changed

| File | 改动 |
|---|---|
| `dashboard/src/types/task.ts` | `binding_id: string` → `binding_id: string \| null` + nullable 注释 |
| `dashboard/src/test/taskMappers.test.ts` | entry-status-1 fixture 加 `thread_task_binding_id: null` |
| `dashboard/src/test/taskStore.live-api.test.ts` | entry-1 fixture 加 `thread_task_binding_id: null` |
| `Doc/09-PLANNING/TASKS/2026-08-30-dashboard-baseline-cleanup/{task_plan,findings,progress}.md` | task_dir 三件套 |
| `agora-ts/packages/contracts/dist/**` | build 产物（gitignore 排除） |

3 file changes / +4 lines / -1 line

## 5. Architecture decisions locked

| ID | Decision | Why |
|---|---|---|
| **B1** | 编译 `agora-ts/packages/contracts` 生成 dist（不污染 src） | §1.5 最短路径 + 不允许兜底/补丁 |
| **B2** | view model `binding_id: string \| null` 匹配 contracts DTO | §1.5 "先打模型对" — API 真可能 null（首条回复前未绑定）|
| **B3** | fixture 加 `thread_task_binding_id: null`（R-F.1 加字段后同步） | §4 TDD 同步测试 fixture |

## 6. Verification

```
$ cd /home/ailink/dsh-agora/.worktrees/dashboard-baseline-cleanup/dashboard
$ npx tsc -b
$ echo $?
0
```

**0 errors, exit 0** ✓

- R-F.1/R-F.2 代码未触碰 ✓
- agora-ts src 未触碰 ✓
- package.json / package-lock.json 未修改 ✓

## 7. Side effects / 未决

- `agora-ts/packages/contracts/node_modules/` 新增（workspaces 自动管理，不进 commit）
- `agora-ts/packages/contracts/dist/` 生成（`.gitignore` 排除，不进 commit）
- `dashboard/node_modules/zod` v4.3.6 已存在；contracts `zod ^4.1.11` — 双版本共存无影响（各自 scope）
- **R-F.1 walkthrough v01/v02 已 ship，"zero new typedrift" 报告被现实修订，但历史记录不改正**

## 8. Cross-references

- **agora-ts SSoT**: `Doc/Agora-实施排期-Agora-TS.md` §3.5（R-D baseline 债已记，本轮修复闭环）
- **Dashboard SSoT**: `Doc/Agora-实施排期-Dashboard.md`（收口时加 baseline cleanup 状态行）
- **task_dir**: `Doc/09-PLANNING/TASKS/2026-08-30-dashboard-baseline-cleanup/`
- **R-F.1 walkthrough v01**: `Doc/10-WALKTHROUGH/2026-08-30-r-f-thread-web-detail-v01.md`（subagent 报告错的 "3 ts errors = typedrift" 解释见 findings §1.3）

## 9. Change Log

- 2026-08-30: dashboard baseline cleanup v0.1 — 编译 contracts dist + 3 个 typedrift 修复；`npx tsc -b` 0 errors；R-D 时代遗留 typedrift 闭环