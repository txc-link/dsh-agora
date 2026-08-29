# Dashboard Vitest Cleanup — Findings

**Date**: 2026-08-30
**Worktree**: `/home/ailink/dsh-agora/.worktrees/dashboard-vitest-cleanup`
**Branch**: `feat/dashboard-vitest-cleanup`

---

## §1 真实债 2 数据

### §1.1 之前记账（错）
- turn 146 记账："dashboard 144 vitest failures (React19 + vitest React.act)"

### §1.2 实际数据（侦察 turn 153 step 7）
```
$ NODE_ENV=development npm test -- --run
 Test Files  3 failed | 61 passed (64)
 Tests       2 failed | 376 passed (378)
```

**真实失败**: 2 个 test fixture (`project-workbench-pages.test.tsx` 中 4 处 link/button role 不匹配)

**外加 2 个 stale FAIL files**（vitest 试图解析不识别的测试格式）：
- `tests/api/r-f-2-polling-api.test.mjs` — Node test (Node `--test` runner)，vitest 不识别 → "No test suite found"
- `tests/e2e/r-f-2-polling.spec.ts` — Playwright spec，vitest 不识别 → "Failed to resolve import @playwright/test"

---

## §2 失败模式根因分析

### §2.1 fixture 失败根因 — R-F.1 followup 债

`project-workbench-pages.test.tsx` 2 个失败 test，期望：
- `getByRole('link', { name: 'Bootstrap flow' })`
- `getByRole('link', { name: 'Review handoff' })`

实际 `dashboard/src/pages/ProjectDetailPage.tsx` line 495-505 渲染 task title：
```tsx
<button
  type="button"
  className="type-heading-sm button-ghost"
  aria-label={`Open task ${task.title}`}
  onClick={() => setOpenThreadTaskId(task.id)}
>
  {task.title}
</button>
```

**R-F.1 (turn 144) 把 task title 从 `<Link>` 改成 `<button>`**：
- 改前：`<Link>{task.title}</Link>` → role="link", accessible name = task.title
- 改后：`<button aria-label="Open task ${task.title}">{task.title}</button>` → role="button", accessible name = "Open task Bootstrap flow"

testing-library `getByRole('button', { name: 'Bootstrap flow' })` 精确匹配失败因为 accessible name 是 "Open task Bootstrap flow"。

**这是 R-F.1 时代的 fixture followup 债**，R-F.1 改业务代码时未同步更新 test fixture。

### §2.2 stale FAIL files 根因 — R-F.2 visual verify 漏 vitest config

`tests/api/r-f-2-polling-api.test.mjs` + `tests/e2e/r-f-2-polling.spec.ts` 是 R-F.2 visual verify (turn 148) commit 加的：
- `r-f-2-polling-api.test.mjs` 用 `node:test` (`node --test`) 跑 API-level polling
- `r-f-2-polling.spec.ts` 用 `@playwright/test` 跑 UI polling

vitest 默认扫 `**/*.{test,spec}.?(c|m)[jt]s?(x)`：
- `.mjs` 文件 vitest 试图解析，**不能识别 `node:test` 语法** → "No test suite found"
- `.spec.ts` 文件 vitest 试图解析 `@playwright/test` import，**找不到包**（playwright 不是 vitest 依赖）→ "Failed to resolve import @playwright/test"

**R-F.2 visual verify commit 时没在 vite.config.ts 排除这两个路径**——subagent 只跑了 `npm run test:api` (Node test) 和 Playwright spec，没跑 vitest，没发现 vitest 报 stale FAIL。

---

## §3 worktree-local contracts dist 必要性

`vite.config.ts` line 27:
```ts
alias: {
  '@': path.resolve(__dirname, './src'),
  '@agora-ts/contracts': path.resolve(__dirname, '../agora-ts/packages/contracts/src/index.ts'),
},
```

vitest 启动 vite 解析 `@agora-ts/contracts` → `agora-ts/packages/contracts/src/index.ts` → 触发 contracts src 编译 → `import { z } from 'zod'` → **zod resolve 失败**（worktree `agora-ts/` 无 node_modules）。

**修法**（每个 dashboard worktree 必须）：
```bash
cd agora-ts/packages/contracts
npm install --include=dev --cache <workspace>/.npm-cache-install
npm run build  # 生成 dist/
```

`dist/` 是 `.gitignore` 排除的（line 10: `dist/`），不进 commit。

**这是基础设施债**：每次新 dashboard worktree 都需要本地编译 contracts dist 才能跑 vitest。

**根治方案（债 5?）**：
- 改 vite.config.ts alias 指向 `dist/index.js` (编译后路径) 而非 `src/index.ts`
- 或加 workspace root `package.json` postinstall hook 自动 build contracts
- 或把 contracts dist 编译产物放进 git（违反 §1.5 "先打模型对，dist 是 build 产物不进 git"）

按 §1.5 最短路径 + §4 "完成后必须回写" — 本轮只修债 2，债 5 (worktree-local dist build) 记账留作下一轮。

---

## §4 与 R-F 时代的债链

| 时代 | 改动 | 债 |
|---|---|---|
| **R-D (turn ~100)** | agora-ts 加 `ApiTaskConversationEntryDto.binding_id: string \| null` | dashboard `TaskConversationEntry.binding_id: string` 不匹配 |
| **R-F.1 (turn 144)** | ProjectDetailPage task title `Link → button` + 加 aria-label | test fixture `link → button` + name 没同步 |
| **R-F.2 (turn 146)** | TaskDetailSheet 4s 短轮询 | 无 |
| **R-F.2 visual verify (turn 148)** | 加 `tests/api/r-f-2-polling-api.test.mjs` + `tests/e2e/r-f-2-polling.spec.ts` | vitest config 没 exclude，2 个 stale FAIL |
| **R-baseline cleanup (turn 152)** | view model `binding_id` nullable + 2 fixture 同步 | 闭环 R-D 债 |
| **R-vitest cleanup (本轮 turn 153)** | vitest config exclude + 4 处 fixture 同步 | 闭环 R-F.1 + R-F.2 visual verify 债 |

---

## §5 Side effects / 未决

- ✅ 0 个测试失败（`npm test --run` 62 files / 378 tests 全绿）
- ⚠️ **债 5**：worktree-local contracts dist build 仍是手工步骤（每开新 dashboard worktree 都得手动 build contracts）
- ⚠️ **债 4**：Layer 2 UI E2E（dashboard React 渲染）— 沙箱 agora server dashboard session auth 没启，仍需 user 拍板做不做 systemd restart

---

## §6 Cross-references

- task_plan.md: 修复路径 + 守约
- progress.md: 步骤 checkbox + 实测验证
- Doc/10-WALKTHROUGH/2026-08-30-dashboard-vitest-cleanup.md: 待 commit
- Doc/Agora-实施排期-Dashboard.md: 收口时加 row 6 status