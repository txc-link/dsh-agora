# Dashboard Baseline Cleanup — Progress

**Date**: 2026-08-30
**Worktree**: `/home/ailink/dsh-agora/.worktrees/dashboard-baseline-cleanup`
**Branch**: `feat/dashboard-baseline-cleanup`

---

## §1 Rounds

### 1.1 真实范围侦察 (subagent) — ✅ done

- `npx tsc -b` 实际: devDeps 缺失 (3 errors) + contracts zod resolve (97 errors) + dashboard 真实 typedrift (3 errors)
- brief 假设 10 errors 实际是 subagent 误判 (实质错误层是 devDeps + contracts dist, 都不是 typedrift)
- subagent 按 §1.5 stop-rule 停手, 上报 4 个 scope 选项 A/B/C/D
- 总工决策: **方案 = 编译 contracts dist + 修 3 typedrift** (不选 subagent 的任何 A/B/C/D, 选更干净的路径)

### 1.2 编译 `agora-ts/packages/contracts` — ✅ done

```
cd /home/ailink/dsh-agora/.worktrees/dashboard-baseline-cleanup/agora-ts/packages/contracts
npm install --include=dev --cache /home/ailink/dsh-agora/.npm-cache-install
# → added 2 packages in 1s (zod + 1 transitive)
npm run build
# → tsc -b tsconfig.build.json
# → dist/ 生成 (a2a.d.ts, a2a.js, artifact.d.ts, ... 共 64 files)
```

- agora-ts src **完全未触碰**
- dist 是 `.gitignore` 排除的, 不进 commit
- dashboard tsc-b 走 dist 后, 97 个 contracts errors **全消失**

### 1.3 修 3 个真实 typedrift — ✅ done

| 改动 | 文件:行 | 旧 | 新 |
|---|---|---|---|
| 1 | `dashboard/src/types/task.ts:277` | `binding_id: string;` | `binding_id: string \| null;` + 注释解释 nullable (R-D 时代遗留, server DTO 是 nullable) |
| 2 | `dashboard/src/test/taskMappers.test.ts:168` | `binding_id: 'binding-1',` | `binding_id: 'binding-1',\n      thread_task_binding_id: null,` |
| 3 | `dashboard/src/test/taskStore.live-api.test.ts:394` | `binding_id: 'binding-1',` | `binding_id: 'binding-1',\n        thread_task_binding_id: null,` |

3 file changes / +4 lines / -1 line

### 1.4 验证 — ✅ done

```
$ cd /home/ailink/dsh-agora/.worktrees/dashboard-baseline-cleanup/dashboard
$ npx tsc -b
$ echo $?
0
```

**0 errors, exit 0** ✓

### 1.5 收口 — ⏳ in_progress

- [x] commit (3 file + task_dir 三件套) — 待发
- [ ] push `feat/dashboard-baseline-cleanup`
- [ ] Dashboard SSoT 加 baseline cleanup 状态行
- [ ] merge feat → develop → master
- [ ] 删除本地 worktree + 远端 feat 分支

---

## §2 Verification Summary

| 检查项 | 结果 |
|---|---|
| `npx tsc -b` | **0 errors** ✓ |
| R-F.1/R-F.2 代码 | **未触碰** ✓ |
| agora-ts src | **未触碰** ✓ |
| agora-ts/dist 生成 | ✅ (gitignore 排除) |
| package.json / lock | **未修改** ✓ |
| `dashboard/node_modules` | 已有 (R-F.2 visual verify 装过) |
| `agora-ts/packages/contracts/node_modules` | 新增 (workspaces 自动管理, 不进 commit) |
| `dashboard/src/types/task.ts` 改动 | 1 处 (binding_id nullable) — R-D 时代遗留真实 typedrift |
| `dashboard/src/test/*.test.ts` 改动 | 2 处 fixture 加字段 |

---

## §3 Files Changed

| Status | File |
|---|---|
| modified | `dashboard/src/types/task.ts` |
| modified | `dashboard/src/test/taskMappers.test.ts` |
| modified | `dashboard/src/test/taskStore.live-api.test.ts` |
| new | `Doc/09-PLANNING/TASKS/2026-08-30-dashboard-baseline-cleanup/task_plan.md` |
| new | `Doc/09-PLANNING/TASKS/2026-08-30-dashboard-baseline-cleanup/findings.md` |
| new | `Doc/09-PLANNING/TASKS/2026-08-30-dashboard-baseline-cleanup/progress.md` |
| new | `Doc/10-WALKTHROUGH/2026-08-30-dashboard-baseline-cleanup.md` (待 commit) |

(worktree untracked: `agora-ts/packages/contracts/dist/`, `agora-ts/packages/contracts/node_modules/` — 不进 git)

---

## §4 Change Log

- 2026-08-30: 1.1 侦察 done, 1.2 编译 contracts dist done, 1.3 修3 typedrift done, 1.4 验证 0 errors done, 1.5 收口 in_progress