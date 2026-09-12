# Typecheck Baseline Zero — task plan

## 目标

把 `agora-ts` 存量 typecheck 红清零（改前 `npm run typecheck` = 156 error / 32 file，全部落在 `*.test.ts`），
并在清零后保证 `npm run check`（architecture/barrel gates + lint + build + typecheck + test）整链路绿。

## 边界（不做的事）

- 不改任何生产源码语义（`packages/*/src/**` 中非 `*.test.ts` 文件零改动）。
- 不放宽 `tsconfig` 严格度（`strict` / `noUncheckedIndexedAccess` / `exactOptionalPropertyTypes` 全部保持）。
- 不放宽 eslint 规则级别。
- 不删除、不弱化任何既有断言；只补类型收窄、夹具字段与跨类型替身断言。

## 落地口径

- 判别联合（`{ok:true;data}|{ok:false;error}`）在断言后显式收窄：
  `if (!r.ok) throw new Error(r.error)` / `if (r.ok) throw new Error('expected failure')`，既有 `expect(...)` 原样保留。
- `noUncheckedIndexedAccess` 命中点用 `!` 或 `?.` 显式表达，不靠 any 掩盖。
- 测试替身跨类型断言统一 `as unknown as T`（单记录/空引用替身本就不是完整实现）。
- 夹具缺失字段按生产 contract 补齐（`TaskConversationEntryRecord` / `ProgressLogRecord` / `TaskGraph` / `RoutineDto`）。
- `as const` 造成的 readonly 数组冲突改为显式 DTO 类型注解，而不是删掉 `as const` 后让字面量失窄。

## 验收

- `npm run typecheck` = 0 error。
- `npm run check` 全绿（含 284 test files / 1662 tests）。
- `git diff` 中生产源码（非 `*.test.ts`）零改动。
