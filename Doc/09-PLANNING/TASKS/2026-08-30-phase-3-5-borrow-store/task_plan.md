# Task: P3.5-1 Borrow Store — borrow_requests 持久化 + Core 编排服务 (2026-08-30)

## 1. 目标

把 Phase 3 的 `decideBorrow` 纯决策函数变成可用的执行链: borrow 请求可持久化 (U4=A: ACL 跟 scope 一起持久化), Core 编排服务 `createBorrow` 完成 存 → 决策 → 回写决策 + audit。

## 2. 决策引用

- decisions.md U3=C / U4=A; Phase 3 borrow.ts (develop/main 已合入)
- §2 Entry Surface: Agent 主入口是 CLI (P3.5-2 补 CLI, 本段先 Core 服务)
- §1: repository 在 db 层, 决策在 core, contracts 定义接口
- §1.5: 最短路径, 0 compat

## 3. 范围

### 必须 (本段)
1. `packages/db/src/migrations/033_borrow_requests.sql` + database.ts 注册
2. contracts: `IBorrowRequestRepository` + 领域类型
3. `packages/db/src/repositories/borrow-request.repository.ts` + test
4. core: `borrow-service.ts` (createBorrow: 存 store → decideBorrow → 回写决策) + test
5. TDD red → green + 全量回归

### 不做
- ❌ CLI 入口 (P3.5-2)
- ❌ Dashboard 人类批准 (前端, 单独块)
- ❌ kill switch (P3.5-3)

## 4. worktree / 分支

- worktree: `.worktrees/feat-phase-3-5-borrow-store/`
- branch: `feat/phase-3-5-borrow-store` (base master `63ab131`)

## 5. 验证口径

- borrow-request.repository.test.ts + borrow-service.test.ts 全绿
- agora-ts 全量测试通过 (vitest)
- tsc build 0 errors
- §1 边界: 无平台名
