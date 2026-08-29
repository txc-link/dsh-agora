# Task: P3.5-2b Borrow CLI wiring — composition 注入 + index.ts argv 接线 (2026-08-30)

## 1. 目标

把 P3.5-2 Core `runBorrowCommand` 接入 apps/cli composition root + index.ts argv handler, 让 `agora-ts borrow create|list|show` 命令真正可执行。

## 2. 范围

### 必须
1. `apps/cli/src/composition.ts`:
   - import `BorrowRequestRepository` + `BorrowService` + `ScopeAuthorization`
   - `context.repositories.borrowRequest` = new BorrowRequestRepository(db)
   - `CliCompositionFactories.createBorrowService`
   - `CliComposition.borrowService`
   - `createDefaultCliCompositionFactories` 实现 createBorrowService (env-based scopeAuth)
   - `createCliComposition` 实例化 borrowService
2. `apps/cli/src/index.ts`: register `borrow` subcommand (commander) → parse args → runBorrowCommand → JSON output
3. 测试: `borrow-command-integration.test.ts` (端到端 via createCliComposition)

### 不做
- ❌ worksite registry 解析 (留到 P3.5-3, 本段用 env stub)

## 3. worktree

- worktree: `.worktrees/feat-phase-3-5-2b-cli/`
- branch: `feat/phase-3-5-2b-borrow-cli-wire` (base master `48cc907`)

## 4. scopeAuth 默认 (env stub)

```
AGORA_BORROW_SCOPE = agora://workspace/default
AGORA_BORROW_POSTURE = Auto  (Strict|Auto|Dangerous)
AGORA_BORROW_PERMISSIONS = read,write
```

未设置 → 返回 undefined → deny (fail-safe)。

## 5. 验证

- borrow-command.test.ts + 集成测试全绿
- 全量 baseline 不引入新失败 (沙箱 EROFS 不变)
- build/typecheck 0
