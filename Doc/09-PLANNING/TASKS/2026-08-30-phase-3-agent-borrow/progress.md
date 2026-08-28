# Progress: R6 Phase 3 (2026-08-30)

## 完成记录 (turn 110)

### TDD 结果
- `agora-ts/packages/core/src/worksite/borrow.test.ts`: 12 tests, 12 pass
- core 全量: 70 files / 421 tests 全绿 (含新增)
- workspace build: exit 0

### 实施 (4 files + index)
- `types.ts` — Posture / Permission / ScopeAuthorization + WorksiteMetadata.scopeAuthorization
- `borrow.ts` (新) — BorrowRequest / BorrowDecision / decideBorrow (fail-safe 顺序) + scopeCovers
- `resolver.ts` — resolveScopeAuthorization (U4=A 一次查完)
- `index.ts` — 全部导出

### 关键设计
- Auto + delete → needs_confirm (QM-stricter gate, decisions §U3)
- 无 scopeAuth / ttl 过期 / scope 越界 / 权限越权 → deny (fail-safe)
- Dangerous → needs_dual, Strict → needs_confirm
- 纯函数无 IO; store + Dashboard 入口属 Phase 3.5

### 未决 (Phase 3.5)
- kill switch 粒度 / org+scope 双层合并 / Auto classifier / ttl 默认值
- 见 Doc/03-ARCHITECTURE/2026-08-30-phase-3-agent-borrow/README.md §2

### 关联
- base: origin/develop `551fa53` (Phase 1 merged)
- decisions.md U3=C / U4=A (master `8df2d88`)
