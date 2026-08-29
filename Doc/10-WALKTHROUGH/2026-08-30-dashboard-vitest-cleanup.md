# Walkthrough — Dashboard Vitest Cleanup v0.1

**Date**: 2026-08-30 (Asia/Shanghai)
**Branch**: `feat/dashboard-vitest-cleanup` (worktree `/home/ailink/dsh-agora/.worktrees/dashboard-vitest-cleanup`)
**Author**: 总工
**Status**: ✅ done (62 files / 378 tests 全绿, 0 failed)

---

## 1. TL;DR

dashboard vitest 债 2 完整闭环：
- **之前记账"144 fail"严重错估**，真实失败 = 2 fixture + 2 stale FAIL files（vitest 不识别 Node test + Playwright）
- **3 处修复**：(a) vitest config exclude Node test + Playwright 路径; (b) project-workbench-pages 4 处 fixture 同步 R-F.1 button+aria-label; (c) worktree-local 编译 contracts dist（infra 债）
- **`npm test --run` 62 files / 378 tests / 0 failed** ✓
- **未触碰 R-F.1/R-F.2 业务代码 / agora-ts src / package.json / lock**

## 2. 问题分层（与之前记账完全不同）

| 层 | 数量 | 根因 |
|---|---|---|
| A. fixture 失败 | 2 tests | R-F.1 改 `Link → button` + 加 aria-label，但 4 处 test 断言没同步 (`role: 'link' → role: 'button'` + name 字符串) |
| B. stale FAIL files | 2 files | R-F.2 visual verify 加 Node test + Playwright 测试，vitest config 没 exclude 路径，vitest 默认扫它们报 "No test suite found" / "Failed to resolve @playwright/test" |
| C. 隐藏债 (worktree-local dist) | infra | 每个新 dashboard worktree 需手工编译 contracts dist 才能跑 vitest（vite alias path-map 到 src → zod resolve 失败）|

## 3. 修复

### 3.1 vitest config exclude
`dashboard/vite.config.ts` test 段加 exclude:
```ts
exclude: [
  'tests/api/**',    // Node test 格式 (R-F.2 Layer 1)
  'tests/e2e/**',    // Playwright 格式 (R-F.2 Layer 2)
  'node_modules/**',
  'dist/**',
],
```

### 3.2 4 处 fixture 同步
- `getByRole('link', { name: 'Bootstrap flow' })` → `getByRole('button', { name: 'Open task Bootstrap flow' })`
- `getByRole('link', { name: 'Review handoff' })` → `getByRole('button', { name: 'Open task Review handoff' })`
- 第 1499/1500 行 + 第 1709/1710 行，共 4 处

### 3.3 worktree-local contracts dist build
```bash
cd agora-ts/packages/contracts
npm install --include=dev --cache <workspace>/.npm-cache-install
npm run build  # 生成 dist/
```

## 4. Files Changed

| File | 改动 |
|---|---|
| `dashboard/vite.config.ts` | +8 lines (test.exclude) |
| `dashboard/src/test/project-workbench-pages.test.tsx` | +4 / -4 lines (role+name 同步) |
| `Doc/09-PLANNING/TASKS/2026-08-30-dashboard-vitest-cleanup/{task_plan,findings,progress}.md` | task_dir 三件套 |
| `Doc/10-WALKTHROUGH/2026-08-30-dashboard-vitest-cleanup.md` | walkthrough |
| `agora-ts/packages/contracts/dist/**` | build 产物（gitignore 排除）|

2 src changes / +12 lines / -4 lines

## 5. Architecture decisions locked

| ID | Decision | Why |
|---|---|---|
| **V1** | vitest config exclude `tests/api/**` + `tests/e2e/**` | vitest 不识别 Node test + Playwright 格式；这些测试在它们自己的 runner 下跑（`npm run test:api` + `PLAYWRIGHT_E2E=1 npm run test:e2e`）|
| **V2** | 4 处 fixture `link → button` + aria-label name | §1.5 同步真实代码状态；R-F.1 改业务代码时未同步 fixture 是事实存在的债 |
| **V3** | 精确 aria-label name（不是正则匹配） | §1.5 最短路径，精确反映 code reality |

## 6. Verification

```
$ NODE_ENV=development npm test -- --run
 Test Files  62 passed (62)
 Tests       378 passed (378)
```

**0 failed** ✓

- R-F.1 / R-F.2 业务代码未触碰 ✓
- agora-ts src 未触碰 ✓
- package.json / lock 未修改 ✓

## 7. Side effects / 未决

- ⚠️ **债 5 (新)**: worktree-local contracts dist build 是手工步骤，每开新 dashboard worktree 都得手动 build — 候选根治方案：vite alias 改指 `dist/index.js` 或 workspace postinstall hook
- ⚠️ **债 4 (维持)**: Layer 2 UI E2E (dashboard React 渲染) — 沙箱 agora server dashboard session auth 没启，需 user 拍板 systemd restart

## 8. Cross-references

- **task_dir**: `Doc/09-PLANNING/TASKS/2026-08-30-dashboard-vitest-cleanup/`
- **Dashboard SSoT**: `Doc/Agora-实施排期-Dashboard.md`（收口时加 row 6 baseline cleanup status）
- **R-F.1 walkthrough**: `Doc/10-WALKTHROUGH/2026-08-30-r-f-thread-web-detail-v01.md`（R-F.1 改 Link→button 触发 fixture 债）
- **R-F.2 visual verify walkthrough**: `Doc/10-WALKTHROUGH/2026-08-30-r-f-visual-verify.md`（R-F.2 visual verify 加 Node test + Playwright 触发 stale FAIL 债）
- **baseline cleanup walkthrough**: `Doc/10-WALKTHROUGH/2026-08-30-dashboard-baseline-cleanup.md`（worktree-local dist build 模式首次发现）

## 9. Change Log

- 2026-08-30: dashboard vitest cleanup v0.1 — vitest config exclude + 4 fixture 同步 + worktree-local dist build；`npm test` 62 files / 378 tests 全绿；R-F.1 fixture 债 + R-F.2 visual verify stale FAIL 债 闭环