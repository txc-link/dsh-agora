# Dashboard Vitest Cleanup — Task Plan

**Date**: 2026-08-30
**Worktree**: `/home/ailink/dsh-agora/.worktrees/dashboard-vitest-cleanup`
**Branch**: `feat/dashboard-vitest-cleanup` (from master `ed3c312`)
**Owner**: 总工
**Goal**: dashboard `npm test` 全绿 (378/378 passed), 债 2 闭环

---

## §1 总工排期

| 轮 | 范围 | 状态 |
|---|---|---|
| 1.1 | 真实债 2 范围侦察 | ✅ done |
| 1.2 | vitest config 加 exclude (tests/api/** + tests/e2e/**) | ✅ done |
| 1.3 | project-workbench-pages.test.tsx 4 处 `link → button` + aria-label 同步 | ✅ done |
| 1.4 | 编译 contracts dist (worktree-local build) | ✅ done |
| 1.5 | npm test 全绿验证 | ✅ done |
| 1.6 | 收口 commit + merge + 删 worktree | ⏳ in_progress |

---

## §2 真实债 2 数据（与之前记账不同）

### §2.1 之前 turn 146 记账（错）
- "dashboard 144 vitest failures (React19 + vitest React.act)"

### §2.2 实际数据（侦察发现）
```
Test Files  3 failed | 61 passed (64)
Tests       2 failed | 376 passed (378)
```

**真实失败 = 2 个 test fixture**（`project-workbench-pages.test.tsx` 中 4 处 link/button role 不匹配），**外加 2 个 stale FAIL files**：
- `tests/api/r-f-2-polling-api.test.mjs` — Node test 格式，vitest 试图解析失败
- `tests/e2e/r-f-2-polling.spec.ts` — Playwright 格式，vitest 试图解析失败

**根因**：
- A. R-F.1 改 task title `Link → button` + 加 `aria-label="Open task ${title}"`，但 test fixture 没同步 `role: 'link' → role: 'button'` + name `aria-label` 字符串
- B. R-F.2 visual verify commit (turn 148) 在 `tests/api/` + `tests/e2e/` 加测试，但没在 vite.config 排除这俩路径，vitest 默认扫这些路径报 "No test suite found"

---

## §3 修复

### §3.1 vitest config exclude（vue.config.ts:55-79）
```ts
test: {
  environment: 'jsdom',
  setupFiles: './src/test/setup.ts',
  globals: true,
  exclude: [
    'tests/api/**',      // Node test 格式, R-F.2 Layer 1
    'tests/e2e/**',      // Playwright 格式, R-F.2 Layer 2
    'node_modules/**',
    'dist/**',
  ],
  coverage: { ... },
}
```

### §3.2 project-workbench-pages.test.tsx 4 处 fixture
- Line 1499: `link` → `button`, name `'Bootstrap flow'` → `'Open task Bootstrap flow'`
- Line 1500: `link` → `button`, name `'Review handoff'` → `'Open task Review handoff'`
- Line 1709: `link` → `button`, name `'Bootstrap flow'` → `'Open task Bootstrap flow'`
- Line 1710: `link` → `button`, name `'Review handoff'` → `'Open task Review handoff'`

### §3.3 worktree-local contracts dist build（每个 dashboard worktree 必须）
- vitest 启动时 vite 解析 `@agora-ts/contracts` path-map → `agora-ts/packages/contracts/src/*.ts`
- contracts src 用 `import { z } from 'zod'`，但 worktree `agora-ts/` 没 node_modules
- **修法**：`cd agora-ts/packages/contracts && npm install --include=dev && npm run build` 生成 dist
- dist 在 `.gitignore` (`dist/` rule line 10)，不进 commit
- 这是基础设施债：每个新 dashboard worktree 都需要本地编译 contracts dist 才能跑 vitest

---

## §4 守约

- ✅ **未触碰 R-F.1 / R-F.2 业务代码**：只改 test fixture + vitest config
- ✅ **未触碰 agora-ts src / package.json / lock**：仅生 dist (gitignore 排除)
- ✅ **未触碰 dashboard src**：只改 test + config
- ⚠️ project-workbench-pages.test.tsx 4 处 = R-F.1 时代 fixture 债的同步修复（不算 scope 扩展）

---

## §5 Files Changed

| File | 改动 |
|---|---|
| `dashboard/vite.config.ts` | test.exclude 加 4 个 glob |
| `dashboard/src/test/project-workbench-pages.test.tsx` | 4 处 role/name 同步 R-F.1 button + aria-label |
| `agora-ts/packages/contracts/dist/**` | build 产物（gitignore 排除） |

2 file changes / +8 lines / -4 lines

---

## §6 Cross-references

- **task_dir findings.md**: 详细侦察 + 修复路径对比
- **task_dir progress.md**: 步骤 checkbox + 实测验证
- **Doc/10-WALKTHROUGH/2026-08-30-dashboard-vitest-cleanup.md**: 待 commit
- **Doc/Agora-实施排期-Dashboard.md**: 收口时加 baseline cleanup 状态行 row 6
- **R-F.1 walkthrough**: turn 144 R-F.1 改 `Link → button`，本轮是 R-F.1 fixture followup