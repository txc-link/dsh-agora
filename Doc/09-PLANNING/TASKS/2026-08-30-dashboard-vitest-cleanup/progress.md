# Dashboard Vitest Cleanup — Progress

**Date**: 2026-08-30
**Worktree**: `/home/ailink/dsh-agora/.worktrees/dashboard-vitest-cleanup`
**Branch**: `feat/dashboard-vitest-cleanup`

---

## §1 Rounds

### 1.1 真实债 2 范围侦察 — ✅ done

- `npm test --run` 实际：62 files / 378 tests / **2 failed**（不是 turn 146 记账的 "144"）
- 失败模式：2 fixture link/button role 不匹配 + 2 stale FAIL files (vitest 不识别 Node test + Playwright)
- 根因：R-F.1 改 Link→button+aria-label 没同步 test；R-F.2 visual verify 加 Node test + Playwright 没在 vitest config exclude

### 1.2 vitest config exclude — ✅ done

```diff
 test: {
   environment: 'jsdom',
   setupFiles: './src/test/setup.ts',
   globals: true,
+  exclude: [
+    'tests/api/**',
+    'tests/e2e/**',
+    'node_modules/**',
+    'dist/**',
+  ],
   coverage: { ... },
 },
```

### 1.3 project-workbench-pages.test.tsx 4 处 fixture — ✅ done

| Line | 旧 | 新 |
|---|---|---|
| 1499 | `getByRole('link', { name: 'Bootstrap flow' })` | `getByRole('button', { name: 'Open task Bootstrap flow' })` |
| 1500 | `getByRole('link', { name: 'Review handoff' })` | `getByRole('button', { name: 'Open task Review handoff' })` |
| 1709 | `queryByRole('link', { name: 'Bootstrap flow' })` | `queryByRole('button', { name: 'Open task Bootstrap flow' })` |
| 1710 | `getByRole('link', { name: 'Review handoff' })` | `getByRole('button', { name: 'Open task Review handoff' })` |

### 1.4 worktree-local contracts dist build — ✅ done

```bash
cd agora-ts/packages/contracts
npm install --include=dev --cache /home/ailink/dsh-agora/.npm-cache-install
npm run build  # tsc -b tsconfig.build.json → dist/
```

### 1.5 npm test 全绿验证 — ✅ done

```
$ NODE_ENV=development npm test -- --run
 Test Files  62 passed (62)
 Tests       378 passed (378)
```

**0 failed, 0 stale FAIL** ✓

### 1.6 收口 — ⏳ in_progress

- [x] commit (2 src + task_dir 三件套 + walkthrough)
- [ ] push `feat/dashboard-vitest-cleanup`
- [ ] Dashboard SSoT 加 row 6 baseline cleanup status
- [ ] merge feat → develop → master
- [ ] 删除本地 worktree + 远端 feat 分支

---

## §2 Verification Summary

| 检查项 | 结果 |
|---|---|
| `npm test --run` | **62 files / 378 tests 全绿** ✓ |
| R-F.1 / R-F.2 业务代码 | **未触碰** ✓ |
| agora-ts src | **未触碰** ✓ |
| package.json / lock | **未修改** ✓ |
| vite.config.ts | +8 lines (exclude block) |
| project-workbench-pages.test.tsx | +4 / -4 lines (role+name) |
| `agora-ts/packages/contracts/dist/` | gitignore 排除 |

---

## §3 Files Changed

| Status | File |
|---|---|
| modified | `dashboard/vite.config.ts` |
| modified | `dashboard/src/test/project-workbench-pages.test.tsx` |
| new | `Doc/09-PLANNING/TASKS/2026-08-30-dashboard-vitest-cleanup/{task_plan,findings,progress}.md` |
| new | `Doc/10-WALKTHROUGH/2026-08-30-dashboard-vitest-cleanup.md` |
| (gitignore) | `agora-ts/packages/contracts/dist/**` |
| (gitignore) | `agora-ts/packages/contracts/node_modules/` |

---

## §4 Change Log

- 2026-08-30: 1.1 侦察 done, 1.2 vitest exclude done, 1.3 fixture done, 1.4 contracts dist done, 1.5 npm test 全绿 done, 1.6 收口 in_progress