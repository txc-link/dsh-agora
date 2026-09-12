# Findings

## 改前错误分布（156 → 0）

- 按码：TS2339 ×54 / TS2322 ×24 / TS2532 ×19 / TS2352 ×10 / TS2739 ×4 / TS2379 ×3 / TS18048 ×3 / TS7006 ×2 /
  TS2740 ×2 / TS2493 ×2 / TS2345 ×2 / TS2741・TS2531・TS2459・TS2353・TS2304 各 1。
- 按包：core 106 / db 6 / adapters-mem0 5 / adapters-matrix 4 / apps-cli 3 / apps-server 3 / monitoring-relay 3。

## 关键结论

- `expect(x.ok).toBe(true)` **不做**类型收窄（vitest 的 `expect` 无 `asserts` 签名）；TypeScript 5.9 也**没有**
  `reduceTypeOfAssertions` 这类编译选项（实测 `error TS5023: Unknown compiler option`）。
  因此收窄只能在测试侧显式表达，不能靠 tsconfig 开关“一键消红”。
- `AgentQuestionRecord.metadata` 契约是 `Record<string, unknown> | null`；生产仓储
  (`packages/db/src/repositories/agent-question.repository.ts`) 在 DB 边界做 stringify/parse。
  `agent-question-service.test.ts` 的内存替身原先自行 `JSON.stringify(...)`，属替身与契约不同形，按契约改为对象直存。
- `ThreadTaskBindingServiceOptions.threadKeyPattern?: RegExp`（exactOptionalPropertyTypes 下不允许显式传 `undefined`）：
  条件 spread 会把类型摊成 `RegExp | undefined`，改为显式二分支构造 + `sourcePattern(): RegExp`。
- `monitoring-relay` 的 `vi.fn(async () => ...)` 无参签名导致 `mock.calls[0]` 被推成空元组 `[]`，
  改为 `vi.fn<typeof fetch>(...)` 后才拿得到 `(input, init)`。

## 未改动的已知项

- 生产源码 0 改动；156 个错全部是测试文件里的类型表达问题，不是契约/实现漂移。
