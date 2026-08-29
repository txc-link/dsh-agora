# Task: P3.5-2 Borrow CLI 入口 + apps/cli compose BorrowService (2026-08-30)

## 1. 目标

把 P3.5-1 BorrowService 通过 CLI 暴露给 Agent (§2 Entry Surface: Agent 主入口 = CLI).

## 2. 范围

### 必须
1. `apps/cli/src/borrow-command.ts` — `agora borrow create|list|show` 命令实现
2. `apps/cli/src/borrow-command.test.ts` — TDD
3. `apps/cli/src/composition.ts` — CliCompositionFactories 加 `borrowService` + `borrowRequestRepo` factory
4. `apps/cli/src/index.ts` — register `borrow` subcommand
5. BorrowService scopeAuthResolver: 从 worksite registry 读 scopeAuthorization (composition root 注入)

### 不做
- ❌ Dashboard 人类批准 (前端)
- ❌ kill switch (P3.5-3)
- ❌ interactive 确认 (Strict posture 直接返回 needs_confirm 让调用方处理)

## 3. worktree / 分支

- worktree: `.worktrees/feat-phase-3-5-2-cli/`
- branch: `feat/phase-3-5-2-borrow-cli` (base master `3d57235`)

## 4. 验证

- borrow-command.test.ts 全绿
- 全量 vitest 不引入新失败 (baseline 36 EROFS 不变)
- build/typecheck 0
