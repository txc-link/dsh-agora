# Dashboard Contracts Dist Onboarding — Findings

**Date**: 2026-08-30
**Worktree**: `/home/ailink/dsh-agora/.worktrees/dashboard-contracts-dist-onboarding`
**Branch**: `feat/dashboard-contracts-dist-onboarding`

---

## §1 债 5 根因（精确描述）

### §1.1 vite alias 优先于 package.json

`vite.config.ts` 的 `resolve.alias` 在 vite/vitest 模块解析路径上**优先级最高**，覆盖 npm 包的 main/types 字段。

**之前 alias 配置**:
```ts
alias: {
  '@': path.resolve(__dirname, './src'),
  '@agora-ts/contracts': path.resolve(__dirname, '../agora-ts/packages/contracts/src/index.ts'),
},
```

`@agora-ts/contracts` alias 指向 `src/index.ts` — vite 解析时直接打开 contracts 源代码，**绕过 contracts package.json 的 main/types 字段**（即使 `package.json` main 指向 dist）。

### §1.2 contracts src 的 zod import 链路

`agora-ts/packages/contracts/src/*.ts` (64 个文件) 全部 `import { z } from 'zod'`：
- `craftsman.ts`: `import { z } from "zod";`
- `task.ts`, `participant.ts`, ... 等全部如此

### §1.3 contracts 包结构（不寻常）
- `name: "@agora-ts/contracts"`
- `private: true`
- `main: "dist/index.js"`
- `types: "dist/index.d.ts"`
- `dependencies: { zod: "^4.1.11" }`
- **没有自己的 `node_modules/`**（依赖 npm workspaces 装到 root）

### §1.4 worktree 内 zod resolve 失败链路

dashboard worktree 启动 vitest 时:
1. vite 解析 `@agora-ts/contracts` → `src/index.ts`
2. contracts `src/index.ts` 展开其 imports
3. `craftsman.ts` `import { z } from "zod"` 触发 zod resolve
4. TS bundler resolution 从 `agora-ts/packages/contracts/src/craftsman.ts` 向上找 `node_modules`
5. `agora-ts/packages/contracts/node_modules/` — **不存在**
6. `agora-ts/packages/node_modules/` — 不存在
7. `agora-ts/node_modules/` — 不存在
8. 根 `node_modules/` 存在 zod，但 bundler 不跨包边界回根（dashboard 的 `node_modules/zod` v4.3.6 也存在但走不通）
9. **zod resolve 失败** → vitest 大面积 import 失败

### §1.5 R-baseline cleanup (turn 152) 临时方案
- 在 worktree 内手动 `npm run build` 生成 `dist/`
- dist 含 `.d.ts` declarations + `.js` 产物，build 时 zod 已 serialize
- 之后 vite/vitest 看 `.d.ts` 不触发 zod resolve
- **每个新 dashboard worktree 都需要手工编译** → **债 5**

---

## §2 修复方案对比

### §2.1 选项 (a) vite alias 指 dist — **采用**
**改动**: alias `src/index.ts` → `dist/index.js`
- ✅ 一次性配置，所有 worktree 受益
- ✅ §1.5 最短路径，不兜底
- ⚠️ **首次必须有 dist** — 必须配 onboarding automation

### §2.2 选项 (b) dashboard package.json pretest hook — **作为 (a) 补充**
**改动**: `"pretest": "cd ../agora-ts/packages/contracts && npm run build"`
- ✅ 跑 `npm test` 时自动 build
- ⚠️ **不解决 dev 启动问题**（`npm run dev` 不会跑 pretest hook）

### §2.3 选项 (c) workspace root postinstall hook
**改动**: `package.json` (workspace root) postinstall 自动 build 所有 packages
- ✅ 一次安装全覆盖
- ⚠️ 沙箱 `NODE_ENV=production` 让 npm install 跳过 devDeps (之前 turn 152 发现的债)
- ⚠️ 增加了 workspace root 复杂度

### §2.4 选定方案 = (a) + (b) + 显式 `setup` script
| 改动 | 效果 |
|---|---|
| vite alias 指 dist | vite/vitest 走 dist 不触发 zod resolve |
| package.json `pretest` hook | `npm test` 自动 build contracts |
| package.json `predev` hook | `npm run dev` 自动 build contracts |
| `dashboard/scripts/build-contracts.sh` | 显式 `npm run setup` 入口，可独立调用 |
| 没有 alias fallback | §1.5 不兜底 — vite fail-fast if dist 缺失 |

---

## §3 §1.5 first-principles 反思

### §3.1 之前记账"worktree-local dist 是手工步骤"
**错误原因**: §1.5 "不允许兜底性方案" 应该适用于**记账本身**。
- 之前记账"债 5 = 手工步骤"接受为长期事实 → **本质是兜底**
- 真正修复 = **自动化 onboarding** — 不让手工步骤存在

### §3.2 dev + test 双 hook 必要性
- `predev` 必加: dev server 启动前必须 dist 存在（alias 强制要求）
- `pretest` 必加: vitest 启动前必须 dist 存在
- 两者独立（不是 pretest + predev 合并成一个 hook）— 因为 npm 不允许 pre hook 重叠

### §3.3 没改 agora-ts src 的守约
- vite alias 改动 = dashboard 仓 config
- build-contracts.sh 改动 = dashboard 仓 scripts
- package.json hooks 改动 = dashboard 仓 config
- **agora-ts src 完全未触碰**（仅 build dist 产物，gitignore 排除）

---

## §4 Side effects / 副作用

### §4.1 npm cache 共享
- 沙箱用 `NODE_ENV=production` + `--cache /home/ailink/dsh-agora/.npm-cache-install`
- build-contracts.sh 默认 cache 在 `${REPO_ROOT}/.npm-cache-install`（worktree-local 共享 cache）
- 多个 worktree 共享 cache，不重复下载 zod

### §4.2 dev server 启动延迟
- `npm run dev` 现在会先 build contracts (~3s) 再启动 vite
- 对 dev 体验略有影响，但 3s 一次性成本换 0 个手动步骤

### §4.3 npx tsc -b 仍需 dist 吗?
- `tsc -b` 编译 dashboard src，独立解析 `@agora-ts/contracts` path-mapping (跟 vite alias 同源)
- `tsconfig.app.json` 把 `@agora-ts/contracts` path-map 到 contracts src — **不依赖 alias**
- 但 dashboard/src 编译时仍可能间接 resolve zod 通过 contracts → **仍需 dist**
- 验证: `npx tsc -b` 在 onboarding 后 0 errors ✓

---

## §5 与之前债务的关系

| 时代 | 债 | 本轮影响 |
|---|---|---|
| R-baseline cleanup (turn 152) | 债 1 typedrift — 编译 contracts dist 修 | 暴露"手工 onboarding"债 5 |
| R-vitest cleanup (turn 153) | 债 2 vitest — 同样手工编译 | 暴露同债 5 |
| **R-contracts onboarding (本轮)** | 债 5 手工步骤 | **根治**: 自动化 onboarding |

---

## §6 Cross-references

- **task_plan.md**: 修复路径 + 守约
- **progress.md**: 步骤 checkbox + 实测验证
- **Doc/10-WALKTHROUGH/2026-08-30-dashboard-contracts-dist-onboarding.md**: 待 commit
- **Doc/Agora-实施排期-Dashboard.md**: 收口时加 row 7 baseline onboarding
- **R-baseline cleanup walkthrough**: `Doc/10-WALKTHROUGH/2026-08-30-dashboard-baseline-cleanup.md`
- **R-vitest cleanup walkthrough**: `Doc/10-WALKTHROUGH/2026-08-30-dashboard-vitest-cleanup.md`