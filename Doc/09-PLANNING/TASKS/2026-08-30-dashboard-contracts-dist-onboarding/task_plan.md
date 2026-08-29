# Dashboard Contracts Dist Onboarding — Task Plan

**Date**: 2026-08-30
**Worktree**: `/home/ailink/dsh-agora/.worktrees/dashboard-contracts-dist-onboarding`
**Branch**: `feat/dashboard-contracts-dist-onboarding` (from master `929b42c`)
**Owner**: 总工
**Goal**: 自动化 dashboard worktree 的 contracts dist 编译 onboarding (债 5 闭环)

---

## §1 总工排期

| 轮 | 范围 | 状态 |
|---|---|---|
| 1.1 | 债 5 根因确认 + 方案选择 | ✅ done |
| 1.2 | vite.config.ts alias 改指 dist + 注释 | ✅ done |
| 1.3 | `dashboard/scripts/build-contracts.sh` 写 | ✅ done |
| 1.4 | package.json 加 `setup` + `pretest` + `predev` hooks | ✅ done |
| 1.5 | npm install + npm test + npm build + tsc 全跑通验证 | ✅ done |
| 1.6 | 收口 commit + merge + 删 worktree | ⏳ in_progress |

---

## §2 债 5 真实根因

### §2.1 之前手工流程（每个 worktree 都要走 5 步）
1. `git worktree add ...`
2. `cd dashboard && npm install`
3. `cd ../agora-ts/packages/contracts && npm install --include=dev && npm run build`
4. `cd ../../dashboard`
5. `npm test` 才不报 zod resolve 失败

### §2.2 根因
- `dashboard/vite.config.ts` alias `@agora-ts/contracts` → `../agora-ts/packages/contracts/src/index.ts`
- vite alias 优先于 package.json → 解析 contracts src
- contracts src 用 `import { z } from 'zod'`
- contracts 包**没自己的 node_modules**（依赖 workspace root）
- TS bundler resolution 从 `agora-ts/packages/contracts/src/*.ts` 向上找，walk out `agora-ts/` 找不到 `node_modules/zod`
- 报"Failed to resolve import 'zod'" → 大面积 vitest fail（baseline cleanup turn 152 时发现）

### §2.3 R-baseline cleanup (turn 152) 临时方案
- 在 worktree 内手动 `npm run build` 生成 `dist/`
- dist 是 .gitignore 排除的，**不进 commit**
- 每个新 dashboard worktree 都需要**手工**编译一次

### §2.4 债 5 = 手工 onboarding 债
- **§1.5 "不允许兜底性方案"** — 不应该让手工 onboarding 长期存在
- **正确路径**: onboarding 自动化

---

## §3 修复方案

### §3.1 vite alias 改指 dist (V1)
```diff
resolve: {
-  alias: {
-    '@': path.resolve(__dirname, './src'),
-    '@agora-ts/contracts': path.resolve(__dirname, '../agora-ts/packages/contracts/src/index.ts'),
-  },
+  alias: [
+    { find: '@', replacement: path.resolve(__dirname, './src') },
+    {
+      find: '@agora-ts/contracts',
+      replacement: path.resolve(__dirname, '../agora-ts/packages/contracts/dist/index.js'),
+    },
+  ],
},
```

**为什么改指 dist**:
- dist 含 `.d.ts` 声明 + `.js` 产物，**build 时 zod 已 serialize 进 declarations**
- vite 解析 declaration 不触发 `zod` 模块 resolve → 从根消除债 2/5 的 zod resolve 链路
- 任何 worktree 编译过 contracts dist 后，dev/test 即开即用

### §3.2 `dashboard/scripts/build-contracts.sh` (V2)
- 编译 contracts (install zod + tsc -b)
- 自检 `dist/index.js` 存在
- npm cache 路径走 `${REPO_ROOT}/.npm-cache-install`（沙箱 EROFS 兼容）
- 失败 fail-fast (`set -euo pipefail`)
- 错误信息明确指出"先跑 build-contracts.sh"

### §3.3 package.json 加 npm hooks (V3)
```diff
"scripts": {
  "dev": "vite",
+ "setup": "bash ./scripts/build-contracts.sh",
+ "pretest": "bash ./scripts/build-contracts.sh",
+ "predev": "bash ./scripts/build-contracts.sh",
  "test": "vitest run",
  ...
}
```

**为什么是 hook 而不是手动**:
- npm `pretest` / `predev` 在对应命令前自动跑
- 用户/agent 跑 `npm test` 或 `npm run dev` 时**自动**完成 onboarding
- 不污染通用 npm 语义（`npm test` 仍是 vitest run，但**保证** dist 存在）

### §3.4 §1.5 守约评估
| 维度 | 是否守约 |
|---|---|
| 不允许兜底性 | ✅ vite alias 直接指 dist，没有 fallback 到 src |
| 不允许过度设计 | ✅ 没有抽象层，直接硬编码路径 |
| 不允许扩展到用户未要求的范围 | ✅ 只解决"worktree-local dist 自动化"，不动 agora-ts src / 其他 config |
| 必须保证方案逻辑自洽 | ✅ npm hooks 跑 build，alias 路径必存在，否则 vite fail-fast |

---

## §4 Files Changed

| File | 改动 |
|---|---|
| `dashboard/vite.config.ts` | alias object → alias array, `@agora-ts/contracts` 指 dist, 加注释解释 |
| `dashboard/scripts/build-contracts.sh` | new — 编译 contracts dist script |
| `dashboard/package.json` | +3 scripts: `setup`, `pretest`, `predev` |
| `agora-ts/packages/contracts/dist/**` | build 产物（gitignore 排除）|
| `agora-ts/packages/contracts/node_modules/` | zod install 产物（gitignore 排除）|

3 src changes / +45 lines / -4 lines

---

## §5 Verification

| 检查项 | 结果 |
|---|---|
| `npm install --include=dev` | 366 packages added in 6s ✓ |
| `npm test` (自动跑 pretest hook) | 62 files / 378 tests pass ✓ |
| `npm run build` (vite build) | ✓ built in 6.89s |
| `npx tsc -b` | 0 errors, exit 0 ✓ |
| vite alias 解析 `@agora-ts/contracts` | 走 `dist/index.js` ✓ |

---

## §6 Cross-references

- **R-baseline cleanup walkthrough** (`Doc/10-WALKTHROUGH/2026-08-30-dashboard-baseline-cleanup.md`): 债 1 修复时已暴露债 5 — 当时记账"worktree-local dist build 是手工步骤"
- **R-vitest cleanup walkthrough** (`Doc/10-WALKTHROUGH/2026-08-30-dashboard-vitest-cleanup.md`): 债 2 修复时同样依赖 worktree-local dist build
- **AGENTS.md §1.5**: 不允许兜底/补丁方案 — 本方案直接指 dist，自动化 onboarding
- **AGENTS.md §3**: Worktree First + Worktree Hygiene
- **Dashboard SSoT**: `Doc/Agora-实施排期-Dashboard.md` (收口时加 row 7)

---

## §7 Change Log

- 2026-08-30: 1.1-1.5 done; 1.6 收口 in_progress