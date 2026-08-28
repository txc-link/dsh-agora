# Spec Brief — Slice 6 (cordis Plugin Loader Integration Verification)

**Spec ID**: `2026-08-30-slice-6-cordis-integration-verification`
**Date**: 2026-08-29 (Asia/Shanghai)
**Owner**: 总工 (turn 25 expert team meeting)
**Related SSoT**: [Doc/Agora-实施排期-dsh-matrix-connector.md §6 Slice 6](../../../../Agora-实施排期-dsh-matrix-connector.md#6-cordis-dynamic-plugin-loader-验证)
**Related Walkthrough**: [Doc/10-WALKTHROUGH/2026-08-30-phase-2-matrix-connector-walkthrough.md §6.2](../../../../10-WALKTHROUGH/2026-08-30-phase-2-matrix-connector-walkthrough.md)

---

## 1. Outcome

Verify that `dsh-agora`'s cordis dynamic plugin loader can dynamically load
`txc-link/dsh-matrix-connector` as a peer plugin via:

```
dsh plugin --profile <profile> add https://github.com/txc-link/dsh-matrix-connector.git
```

Result: **integration verified** + **minimal fixes applied** (if needed).

---

## 2. Why

Phase 2 实施了 dsh-matrix-connector 实质代码 (5 src modules + 60 tests + walkthrough)。
但**没验证**它能真的被 dsh-agora plugin loader 加载 — Q-E2=d 决议 ("cordis dynamic plugin loader")
要求 dsh-matrix-connector 是 peer plugin, 不是 submodule/npm dep。

Without Slice 6, Phase 2 = **孤儿代码** (compiled, 但运行不起来 in dsh-agora runtime)。

---

## 3. Non-goals

- ❌ No production deploy (user's dev machine only)
- ❌ No Discord smoke (留 user-side)
- ❌ No Agora Core modifications (per §1 hard constraint)
- ❌ No new abstraction (verify existing loader + minimal fixes only)
- ❌ No compat path (per §1.5 — fix forward, not backward)

---

## 4. Public API Surface (verifies only)

```typescript
// dsh-agora 端 verify:
import { loadPlugin } from 'dsh-agora/lib/plugin-loader';  // hypothetical
const plugin = await loadPlugin('https://github.com/txc-link/dsh-matrix-connector.git');
assert(plugin.id === 'matrix-connector');
assert(plugin.manifest.version === '2.0.2');  // or Phase 2 version
```

---

## 5. Verification Items (5 checks)

| # | Check | Method | Pass criteria |
|---|---|---|---|
| 1 | 新仓 `cordis.patch.yml` schema valid | YAML parser + validate fields | No parse error, all required fields present |
| 2 | 新仓 `dsh.plugin.json` manifest valid (if exists) or inferred from package.json | JSON parser + required fields | `id`, `name`, `version`, `entry` all present |
| 3 | dsh-agora plugin loader 能解析 patch + manifest | Mock loader + dry run | No throw, plugin descriptor returned |
| 4 | Phase 2 实施的 `lib/index.js` 是有效 entry point | Node.js require + verify exports | No error, exports include @pull hooks |
| 5 | Phase 2 audit trail fallback 不污染 dsh-agora runtime | Verify `.agora/` 路径不会自动创建在 /root | Audit-trail fallback to workspace only |

---

## 6. Test Coverage (8+ cases)

| # | Test | Expected |
|---|---|---|
| 1 | parsePatch new仓 URL → no throw | success |
| 2 | validatePatch missing `id` → throw | error |
| 3 | validatePatch missing `config.requestTimeoutMs` → throw | error |
| 4 | validateManifest new仓 inferred manifest → no throw | success |
| 5 | validateManifest missing `entry` → throw | error |
| 6 | pluginLoader.dryRun URL → returns descriptor | success |
| 7 | lib/index.js require → no throw, has @pull exports | success |
| 8 | audit-trail sandbox fallback path → not /root/.agora | path check |

---

## 7. Acceptance

- 8+ test cases pass
- 147 + 8+ = **155+/155+** pass total
- npm run build 0 errors
- DSH plugin loader integration 文档 写好 (describe install step)

---

## 8. Implementation Plan

### 8.1 工作区

- **新仓 dsh-matrix-connector** (txc-link): 已有 cordis.patch.yml + lib/index.js (Phase 2 实施) — 不改
- **dsh-agora superproject** (txc-link): 需要在 dsh-agora 端加 verify 工具
  - worktree: `feat/phase-2-slice-6-cordis-integration`
  - 文件: `tests/slice-6-cordis-integration.test.mjs` (新)
  - 文件: `extensions/dsh-agora/cordis-loader-verify.sh` (新, CLI)

### 8.2 TDD red → green 顺序

1. 写 `tests/slice-6-cordis-integration.test.mjs` (8 cases)
2. 在 dsh-agora 端写 `extensions/dsh-agora/lib/cordis-loader.mjs` (helper, 不依赖 Node_modules)
3. 跑 TDD red → 8 fail
4. 实施 `cordis-loader.mjs` (parse YAML + validate + dry run)
5. 跑 TDD green → 8/8 pass
6. 跑全 suite → 155+/155+ pass

### 8.3 兼容性边界

- ✅ Phase 2 实施不破坏 (新仓 src/ + tests/ + lib/ + walkthrough 全部保留)
- ✅ 不改新仓 cordis.patch.yml schema (已 valid)
- ❌ 不加 compat path (per §1.5)
- ❌ 不写新 abstraction (per §1.5)
- ❌ 不写 production deploy (留 user)

---

## 9. Self-Review

- ✅ No placeholder (each check has explicit method + pass criteria)
- ✅ No contradiction (§8 implementation plan ↔ §5 verification items aligned)
- ✅ Scope focused (1 test file + 1 helper + 1 verify script + walkthrough update)
- ✅ Boundary explicit (§3 non-goals explicit; §8.3 兼容性边界)
- ✅ ADR signal: Slice 6 records Phase 3 design baseline (Q-E2=d integration verification)

---

## 10. References

- Phase 1 decisions: `dsh-agora/Doc/03-ARCHITECTURE/2026-08-30-ecosystem-design-inputs/decisions.md` §Q-E2=d
- Phase 2 walkthrough: `Doc/10-WALKTHROUGH/2026-08-30-phase-2-matrix-connector-walkthrough.md` §6.2
- 新仓 patch: https://github.com/txc-link/dsh-matrix-connector/blob/main/cordis.patch.yml
- dsh-agora patch: `extensions/dsh-agora/cordis.patch.yml`
- dsh-agora manifest: `extensions/dsh-agora/dsh.plugin.json`

---

**Spec Status**: Approved by 总工 (turn 25 expert meeting).
**Implementation**: starts after this spec is written + committed.
**Owner**: 总工 (执行); user (review only).