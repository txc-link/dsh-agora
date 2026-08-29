# T-0 Progress (2026-08-30)

## 状态

✅ **全部完成**

## 验证

- `packages/core/src/worksite/thread-resolver.ts` 7/7 tests green
- `packages/core/src/worksite/resolver.test.ts` 24/24 tests green (含新增 2 个 thread registration case)
- 全量回归: 1328 tests, 1291 passed / 37 failed (baseline 36 EROFS + 1 locale, 无回归)
- build: 0 (tsc -b tsconfig.workspace.build.json)
- typecheck: 0 (tsc -p tsconfig.json --noEmit)

## 变更范围

| 文件 | 变更 |
|---|---|
| `packages/core/src/worksite/thread-resolver.ts` | **新增** — ThreadWorksiteResolver + ThreadSourcePort + ThreadMetadata + toThreadWorksite |
| `packages/core/src/worksite/thread-resolver.test.ts` | **新增** — 7 TDD tests (RED→GREEN) |
| `packages/core/src/worksite/index.ts` | export 5 个新符号 |
| `packages/core/src/worksite/resolver.test.ts` | 加 ThreadWorksiteResolver registration 集成 case (2 tests) |
| `packages/core/src/index.ts` | re-export ThreadWorksiteResolver + ThreadSourcePort 给 apps/cli 消费 |
| `Doc/09-PLANNING/TASKS/2026-08-30-matrix-tier0-thread-resolver/{task_plan,findings}.md` | 必填 planning 文档 |

## 未做（明确留给后续段）

- ❌ composition root 实际建 registry 实例 + register (大改动, 见 findings §3)
- ❌ ThreadSourcePort 真实 matrix adapter 实现 (T-1 R-B 范围)
- ❌ P3.5-3a scopeAuthResolver worksite 接入 (T-2 R-H 范围, 现在 P3.5 仍用 env stub)

## 下一步 (R-A 完成, 推荐下一条)

R-B T-1: 真实 MatrixTransport (matrix-js-sdk adapter)
- 新仓 `dsh-matrix-connector/src/transport/matrix-js-sdk.ts`
- 接已有 homeserver 实例 (turn 118 #1)
- 完成后 T-0 的 ThreadSourcePort 可填真实 adapter, borrow scope 自动从 matrix room metadata 读