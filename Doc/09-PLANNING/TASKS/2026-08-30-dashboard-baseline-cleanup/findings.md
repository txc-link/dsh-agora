# Dashboard Baseline Cleanup — Findings

**Date**: 2026-08-30
**Worktree**: `/home/ailink/dsh-agora/.worktrees/dashboard-baseline-cleanup`
**Branch**: `feat/dashboard-baseline-cleanup`

---

## §1 真实问题分层 (与 brief 假设完全不同)

### §1.1 devDeps 缺失 (环境层)

**症状**: `npx tsc -b` 报"Cannot find type definition file for 'node'/'vite/client'/'vitest/globals'"

**根因**:
- sandbox `NODE_ENV=production` 预设 → `npm install` 跳过 devDeps
- `dashboard/package.json` 列了 `@types/node@^24.10.1` + `@vitejs/plugin-react@^5.1.1` + `vitest@^4.0.8` 等 devDeps, 但 `node_modules/` 没装
- **修复**: `cd dashboard && npm install --include=dev --cache /home/ailink/dsh-agora/.npm-cache-install` (251 packages added)

**意义**: 这层修了**前**报 3 个"Cannot find type definition" errors (R-F.1 subagent turn 144 误判为"main baseline typedrift")。

### §1.2 contracts zod resolve 失败 (97 个 errors)

**症状**: `agora-ts/packages/contracts/src/*.ts` 不能 resolve `zod` 模块。

**根因**:
- `dashboard/tsconfig.app.json` 把 `@agora-ts/contracts` path-map 到 `../agora-ts/packages/contracts/src/index.ts`
- `dashboard` 的 `tsc -b` 把 contracts 源**展开编译**
- contracts 64 个 src 文件全部 `import { z } from 'zod'`
- worktree `agora-ts/` **整个目录树没有任何 node_modules/**
- TS `moduleResolution: "bundler"` 从导入文件目录向上找, 全部路径无 node_modules
- `dashboard/node_modules/zod` (v4.3.6) 装好但 bundler 不跨 worktree 边界

**修复**: **编译 contracts 生成 dist**
```bash
cd agora-ts/packages/contracts
npm install  # 装 zod ^4.1.11
npm run build  # tsc -b tsconfig.build.json → dist/
```

- agora-ts 根 `package.json` 用 workspaces 模式 (`packages/*`), contracts 编译是 master 历史流程
- worktree 没编译过 contracts (gitignore 排除), 所以 path-map 落到 src 触发 zod resolve
- 编译后 `dashboard tsc -b` 走 `dist/index.d.ts` 不触发 zod resolve (声明已被 build 序列化)
- `dist/` 是 `.gitignore` 已排除的 (line 10: `dist/`), **不污染 commit**

**意义**: 修后 97 个 contracts errors 全消失。

### §1.3 dashboard 真实 typedrift (3 个, 不是 10 个)

devDeps 装齐 + contracts dist 生成后, 实际只剩 **3 个真实 typedrift**:

| 位置 | 错误 | 类型 | 根因 |
|---|---|---|---|
| `src/types/task.ts:277` | `Type 'string \| null' is not assignable to type 'string'` | `TaskConversationEntry.binding_id` 应为 nullable | R-D 时代遗留; server DTO `ApiTaskConversationEntryDto.binding_id` 是 `string \| null` (首条回复前未绑定), view model 写死 mandatory |
| `src/test/taskMappers.test.ts:165` | Property 'thread_task_binding_id' missing | fixture 缺字段 | R-F.1 加了 `thread_task_binding_id?` 到 `TaskConversationEntry`, 但旧 fixture 没同步 |
| `src/test/taskStore.live-api.test.ts:391` | 同上 | 同上 | 同上 |

**修复**:
1. `task.ts:277` `binding_id: string` → `binding_id: string | null` (加注释解释 nullable 语义)
2. 两个 fixture 在 `binding_id` 之后加 `thread_task_binding_id: null`

### §1.4 subagent 误报澄清

subagent 侦察时报告 "41 个 dashboard src + 97 个 contracts" = 138 个 errors, 但实际修 devDeps + contracts dist 后 **只浮现 3 个**, 不是 41 个。
- subagent 报告的额外 31 个 (api.ts/dashboardExpansionMappers.ts/projectContextMappers.ts/HumanAccountsPanel.tsx implicit any) **不实际存在**, 是 devDeps 缺失**前**的视野盲区推断
- 修了 devDeps 后, TS 视野完整, 这些位置类型推断**正确** (不报 implicit any)

---

## §2 修复方案选择

按 §1.5 最短路径 + 不允许兜底/补丁:

| 方案 | agora-ts src 改动 | agora-ts dist 改动 | dashboard 改动 | tsc-b | 守 §1.5 |
|---|---|---|---|---|---|
| ❌ symlink zod 到 contracts node_modules | 新增 node_modules/ | 无 | 无 | ✗ 仍有 3 个 src errors | 边界 (污染 agora-ts 树) |
| ✅ **编译 contracts dist** (采用) | 无 | dist 生成 (.gitignore) | 改 3 个 src 文件 | ✅ 0 errors | ✓ 干净 |
| ❌ 仅改 src typedrift | 无 | 无 | 改 3 个 src 文件 | ✗ 仍有 97 个 contracts errors | ✓ |

---

## §3 与 R-F.1 subagent 报告的关系

R-F.1 subagent turn 144 报告 "dashboard 3 ts errors = main baseline typedrift (R-D 时代遗留 typedrift)" — 这是**错误判断**:
- 实际那 3 个 errors 是 devDeps 缺失导致的"Cannot find type definition file"
- 真实的 baseline typedrift 是 `task.ts:277 binding_id` 类型不匹配 (R-D 时代真实遗留) + 2 fixture 缺字段
- subagent 修复时**未察觉 devDeps 缺失根因**, 直接报告"zero new typedrift" 而没说"baseline 也没清"

R-F.1 walkthrough v01/v02 已 ship, 此项**不改正** (历史记录), 但**此 worktree 修正 baseline 债 1, 闭环 R-F 时代遗留 typedrift**。

---

## §4 Side effects / 副作用

- `agora-ts/packages/contracts/node_modules/` 新增 (装 zod + zod 的 transitive deps), **不进 commit** (workspaces 自动管理)
- `agora-ts/packages/contracts/dist/` 生成 (~60 个 .d.ts + .js 文件), **不进 commit** (`dist/` 在 `.gitignore`)
- `dashboard/node_modules/zod` 之前已存在 (4.3.6), contracts 用的是 4.1.11 — **双版本共存但不影响** (各自 scope)

---

## §5 Cross-references

- task_plan.md: 总工排期 + 完整文件改动清单
- progress.md: 步骤 checkbox + 实测验证
- agora-ts SSoT: `docs/Agora-实施排期-Agora-TS.md` §3.5 (R-D baseline 债已记, 本轮修复闭环)
- Dashboard SSoT: `Doc/Agora-实施排期-Dashboard.md` (收口时加 baseline cleanup 状态行)