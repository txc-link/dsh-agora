# Progress

## 2026-09-12

- [x] 改前基线：`npm run typecheck` = 156 error / 32 file（全部 `*.test.ts`）；`npm run build`、生产源码 0 error。
- [x] 核准收窄口径：`expect(...)` 不收窄、tsconfig 无对应开关 → 测试侧显式收窄（不改断言、不放宽阈值）。
- [x] 逐文件消错：core 106 → 0、db 6 → 0、adapters-mem0 5 → 0、adapters-matrix 4 → 0、cli 3 → 0、server 3 → 0、monitoring-relay 3 → 0。
- [x] `npm run typecheck` = 0 error。
- [x] `npx eslint .` = 0 error（修掉 1 处因改动产生的未用 import）。
- [x] `npm run check` 全绿：core architecture gate / barrel governance gate / lint / build / typecheck / test。
      test = 284 files / 1662 tests / 0 failed。
- [x] 复核：`git diff` 生产源码零改动（仅 `*.test.ts`）。
- [ ] 提交并推送到 `origin master`。
- [ ] PAOS 侧 bump 子模块指针 + 更新 `docs/agora-integration.md` §6/§8 + 新增 D 条目留痕。

## 2026-09-12（可写检出实测留档）

命令：`cd agora-ts && npm run check > /tmp/agora-check2.log 2>&1; echo exit=$?`

```text
exit=0
> check
> npm run gate:core-architecture && npm run gate:barrel-governance && npm run lint && npm run build && npm run typecheck && npm test
core all gate passed: /Users/austin/workspace/dsh-agora/agora-ts/packages/core/src
barrel governance gate passed: /Users/austin/workspace/dsh-agora/agora-ts
 Test Files  284 passed (284)
      Tests  1662 passed (1662)
   Duration  134.95s (transform 3.58s, setup 0ms, collect 42.19s, tests 70.73s, environment 24ms, prepare 814ms)
```

改前基线（`a13ef75` 工作树，`/tmp/agora-tc.log`）：`npm run typecheck` → 156 error / 32 file；`npm run build` → 0 error。
改后（`/tmp/agora-tc5.log`）：`npm run typecheck` → `exit=0`，`grep -c "error TS"` = 0。

## 独立复核（非实现方）

- 通道：`codex exec --sandbox read-only -C /Users/austin/workspace/dsh-agora`（独立 `CODEX_HOME`）；报告 `/tmp/agora-typecheck-review.md`。
- 结论：**有条件通过**。A–E 逐条复核未发现断言被删除/放宽/恒真/降级；`git diff` 32 个文件全部为 `*.test.ts`；未发现 `as any` / `@ts-ignore` / `@ts-expect-error` / `eslint-disable` / `toBeDefined` / `.skip`。
- 独立复跑：`npm run typecheck` = **0 error**（21 workspace 全跑）；32 个改动文件 `npx eslint` = 0 problem。
- 未独立复现项：`npm test` 全量——只读沙箱下 Vite 需写 `node_modules/.vite-temp/` 报 `EPERM`。已按复核建议在可写检出跑 `npm run check` 并把真实输出留在上一节。
- 留存风险（复核方提出，本任务接受并登记）：① 9 处 `as unknown as` 跨类型替身断言（编译期擦除、运行期零影响，已在 task_plan 声明口径）；② `evolution-service.test.ts` 把 `listPosts({})` 收紧为 `{ project_id: 'p-1' }`（当前用例等价）。
