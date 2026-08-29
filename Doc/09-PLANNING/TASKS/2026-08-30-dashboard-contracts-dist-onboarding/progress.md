# Dashboard Contracts Dist Onboarding — Progress

**Date**: 2026-08-30
**Worktree**: `/home/ailink/dsh-agora/.worktrees/dashboard-contracts-dist-onboarding`
**Branch**: `feat/dashboard-contracts-dist-onboarding`

---

## §1 Rounds

### 1.1 债 5 根因确认 + 方案选择 — ✅ done

**根因**:
- vite alias `@agora-ts/contracts` 指 `src/index.ts`，覆盖 package.json main
- contracts src `import { z } from 'zod'`，但 contracts 包无 node_modules
- bundler resolution 失败 → vitest 大面积 fail

**方案**: 改 alias 指 dist + pretest/predev hook 自动 build + 显式 `setup` script

### 1.2 vite.config.ts alias 改指 dist — ✅ done

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

加了 6 行注释解释为什么 alias 指 dist + 如何 onboarding。

### 1.3 `dashboard/scripts/build-contracts.sh` — ✅ done

- 45 行 bash script
- 自检 contracts dir 存在
- `npm install --include=dev --cache <repo>/.npm-cache-install`
- `npm run build` (tsc -b tsconfig.build.json)
- 自检 `dist/index.js` 产物
- `set -euo pipefail` + fail-fast
- 错误信息明确指向 user 行动

### 1.4 package.json hooks — ✅ done

```diff
 "scripts": {
   "dev": "vite",
+  "setup": "bash ./scripts/build-contracts.sh",
+  "pretest": "bash ./scripts/build-contracts.sh",
+  "predev": "bash ./scripts/build-contracts.sh",
   "test": "vitest run",
   ...
 }
```

chmod +x build-contracts.sh。

### 1.5 完整验证 — ✅ done

```
$ npm install --include=dev --cache /home/ailink/dsh-agora/.npm-cache-install
added 366 packages in 6s

$ NODE_ENV=development npm test
==> Contracts dir: /home/ailink/dsh-agora/.worktrees/.../agora-ts/packages/contracts
==> npm cache:     /home/ailink/dsh-agora/.worktrees/.../.npm-cache-install
==> npm install --include=dev
==> npm run build
==> Contracts dist ready: .../agora-ts/packages/contracts/dist/
 Test Files  62 passed (62)
      Tests  378 passed (378)

$ npm run build
vite v7.3.1 building client environment for production...
✓ built in 6.89s

$ npx tsc -b
$ echo $?
0
```

**全绿** ✓

### 1.6 收口 — ⏳ in_progress

- [x] commit (3 src + task_dir 三件套 + walkthrough)
- [ ] push `feat/dashboard-contracts-dist-onboarding`
- [ ] Dashboard SSoT 加 row 7
- [ ] merge feat → develop → master
- [ ] 删除本地 worktree + 远端 feat 分支

---

## §2 Verification Summary

| 检查项 | 结果 |
|---|---|
| `npm install --include=dev` | 366 packages ✓ |
| `npm test` (含 pretest 自动 build) | 62 files / 378 tests ✓ |
| `npm run build` (vite build) | ✓ built in 6.89s |
| `npx tsc -b` | 0 errors ✓ |
| vite alias 解析 | 走 `dist/index.js` ✓ |
| R-baseline / R-vitest 代码 | **未触碰** ✓ |
| agora-ts src | **未触碰** ✓ |
| package.json / lock | **未修改 contracts 部分**，仅 dashboard 加 3 个 script |

---

## §3 Files Changed

| Status | File |
|---|---|
| modified | `dashboard/vite.config.ts` |
| modified | `dashboard/package.json` |
| new | `dashboard/scripts/build-contracts.sh` |
| new | `Doc/09-PLANNING/TASKS/2026-08-30-dashboard-contracts-dist-onboarding/{task_plan,findings,progress}.md` |
| new | `Doc/10-WALKTHROUGH/2026-08-30-dashboard-contracts-dist-onboarding.md` |
| (gitignore) | `agora-ts/packages/contracts/dist/**` |
| (gitignore) | `agora-ts/packages/contracts/node_modules/` |

---

## §4 Change Log

- 2026-08-30: 1.1-1.5 done; 1.6 收口 in_progress