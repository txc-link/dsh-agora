# Walkthrough — Dashboard Contracts Dist Onboarding v0.1

**Date**: 2026-08-30 (Asia/Shanghai)
**Branch**: `feat/dashboard-contracts-dist-onboarding` (worktree `/home/ailink/dsh-agora/.worktrees/dashboard-contracts-dist-onboarding`)
**Author**: 总工
**Status**: ✅ done — `npm test` / `npm run build` / `npx tsc -b` 全跑通

---

## 1. TL;DR

dashboard worktree-local contracts dist 编译 onboarding 自动化 (债 5 闭环)：
- **根因**: vite alias `@agora-ts/contracts` 指 src → 触发 contracts src → zod resolve 失败
- **修复**: alias 改指 dist + `pretest`/`predev` hook 自动 build contracts
- **结果**: 任何新 dashboard worktree 跑 `npm test` 或 `npm run dev` 自动完成 onboarding

## 2. 问题根因

### 2.1 之前的债链
- R-baseline cleanup (turn 152): 编译 contracts dist 修债 1 typedrift
- R-vitest cleanup (turn 153): 同样依赖 worktree-local dist 编译修债 2
- 两轮都记账"worktree-local dist build 是手工步骤"— **本质是 §1.5 不允许的兜底**

### 2.2 精确根因
- `dashboard/vite.config.ts` alias `@agora-ts/contracts` 指 `src/index.ts`
- vite alias **优先于 package.json** main/types
- contracts src 64 个文件全部 `import { z } from 'zod'`
- contracts 包无 `node_modules/`（依赖 workspace root）
- TS bundler resolution 从 contracts src 向上 walk 出 `agora-ts/` → 找不到 zod
- 大面积 vitest / dev server 失败

## 3. 修复路径

### 3.1 vite alias 改指 dist
```ts
resolve: {
  alias: [
    { find: '@', replacement: path.resolve(__dirname, './src') },
    {
      find: '@agora-ts/contracts',
      replacement: path.resolve(__dirname, '../agora-ts/packages/contracts/dist/index.js'),
    },
  ],
},
```

dist 含 `.d.ts` declarations + `.js` 产物，build 时 zod 已 serialize 进 declaration → vite 走 declaration 不触发 zod resolve。

### 3.2 `dashboard/scripts/build-contracts.sh` (45 行)
- bash script 编译 contracts
- 自检产物存在
- npm cache 走 `${REPO_ROOT}/.npm-cache-install`（沙箱 EROFS 兼容）
- `set -euo pipefail` + fail-fast
- 错误信息明确

### 3.3 package.json hooks
```json
"scripts": {
  "dev": "vite",
  "setup": "bash ./scripts/build-contracts.sh",
  "pretest": "bash ./scripts/build-contracts.sh",
  "predev": "bash ./scripts/build-contracts.sh",
  "test": "vitest run",
  ...
}
```

`pretest` / `predev` 在对应命令前自动跑 build-contracts.sh。

## 4. Files Changed

| File | 改动 |
|---|---|
| `dashboard/vite.config.ts` | alias object → alias array, contracts 指 dist, +6 行注释 |
| `dashboard/scripts/build-contracts.sh` | new — 45 行 bash onboarding script |
| `dashboard/package.json` | +3 scripts: `setup`, `pretest`, `predev` |
| `Doc/09-PLANNING/TASKS/2026-08-30-dashboard-contracts-dist-onboarding/{task_plan,findings,progress}.md` | task_dir 三件套 |
| `agora-ts/packages/contracts/dist/**` | build 产物（gitignore 排除）|

3 src changes / +45 lines / -4 lines

## 5. Architecture decisions locked

| ID | Decision | Why |
|---|---|---|
| **O1** | vite alias 改指 dist | §1.5 最短路径，从根消除 zod resolve 链路 |
| **O2** | `pretest` + `predev` npm hooks | 自动化 onboarding；用户跑 `npm test` / `npm run dev` 时自动 build contracts |
| **O3** | 显式 `npm run setup` script | user 调试时单独调用，不用跑 test/dev |
| **O4** | 没有 alias fallback | §1.5 不允许兜底 — vite fail-fast if dist 缺失，错误信息指 user 跑 `npm run setup` |
| **O5** | npm cache 走 `${REPO_ROOT}/.npm-cache-install` | 沙箱 `/root/.npm` EROFS 兼容 + 多个 worktree 共享 cache |

## 6. Verification

```
$ npm install --include=dev --cache <repo>/.npm-cache-install
added 366 packages in 6s

$ NODE_ENV=development npm test
==> Contracts dir: ...
==> npm install --include=dev
==> npm run build
==> Contracts dist ready: ...
 Test Files  62 passed (62)
      Tests  378 passed (378)

$ npm run build
vite v7.3.1 building client environment for production...
✓ built in 6.89s

$ npx tsc -b
exit 0
```

**全绿** ✓

- R-baseline / R-vitest 业务代码 **未触碰** ✓
- agora-ts src **未触碰** ✓
- package.json / lock **未修改 contracts 部分** ✓

## 7. §1.5 反思

之前记账"worktree-local dist 是手工步骤" = **§1.5 不允许的兜底性方案**（默认接受手工 onboarding 长期存在）。

**正确做法**: 把 onboarding **自动化**，不让手工步骤作为持续存在的事实。

## 8. Side effects / 未决

- ⚠️ dev server 启动延迟: `npm run dev` 第一次会 build contracts (~3s)，后续 dist 已存在立即启动
- ⚠️ **债 4 (维持)**: Layer 2 UI E2E — 沙箱 agora server dashboard session auth 不可启用 (EROFS + systemctl bus)，需 user 在生产/开发机做

## 9. Cross-references

- **task_dir**: `Doc/09-PLANNING/TASKS/2026-08-30-dashboard-contracts-dist-onboarding/`
- **Dashboard SSoT**: `Doc/Agora-实施排期-Dashboard.md`（收口时加 row 7 baseline onboarding status）
- **R-baseline cleanup walkthrough**: `Doc/10-WALKTHROUGH/2026-08-30-dashboard-baseline-cleanup.md` (turn 152, 暴露债 5)
- **R-vitest cleanup walkthrough**: `Doc/10-WALKTHROUGH/2026-08-30-dashboard-vitest-cleanup.md` (turn 153, 同样依赖手工编译)

## 10. Change Log

- 2026-08-30: dashboard contracts dist onboarding v0.1 — vite alias 指 dist + pretest/predev hook 自动 build + setup script; `npm test` 62 files / 378 tests 全绿; `npm run build` ✓; `npx tsc -b` 0 errors; 债 5 闭环