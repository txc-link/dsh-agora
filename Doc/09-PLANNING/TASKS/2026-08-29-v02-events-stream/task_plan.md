# task_plan.md — v0.2 events stream (SSE/long-poll)

**Date:** 2026-08-29
**Author:** dsh-agent
**Status:** v0.2 设计 → 实现
**Branch:** `feat/v02-events-stream` (从 master @ 2de00a0 开)
**Worktree:** `/home/ailink/dsh-agora/.worktrees/feat-v02-events-stream/`

## 目标

把 `/api/events` 从 client 5 秒 polling 改成 **server push**。
用户在 Matrix 发完 `/agora dispatch` 后，placeholder 从 `pending → running → completed`
**端到端延迟 < 500ms**（v0.1.1 是 5 秒延迟）。

## 范围

### 必须做
1. **服务端**：`GET /api/events/stream` SSE endpoint (Fastify v5 raw `.write()`)
2. **客户端**：dsh-matrix-connector 把 polling (5s) 换成 SSE long-lived connection
3. **测试**：
   - 服务端单测：客户端连接 → 服务端推 SSE event → 客户端解析
   - 客户端单测：SSE 断开重连 / since cursor 持久化
   - 服务端 smoke：用 curl `-N` 验证真的 `data: {...}` 出来

### 不做（v0.3）
- per-citizen dispatch routing (B 线)
- 多 agent war room (C 线)
- 跨节点 event federation

## §1 边界检查

- **Core 抽象**：保持。SSE 端点是 `app.ts` 的 HTTP 层，不进 `packages/core`。
- **§1.5 最短路径**：不创建新 EventBus 包 / 不引入 `@fastify/sse` 第三方库（Fastify v5
  原生支持 raw stream via `reply.hijack()`）。不在 FlowLogRepository 上加回调
  （避免污染 db 包）。
- **provider 命名空间**：SSE payload 与现有 `/api/events` GET schema 一致，dsh-matrix-connector
  拿到的 `{events, next_since}` 形状不变。

## 设计选型

### 候选 A：Server 端 EventEmitter + db hook
- `FlowLogRepository.append()` 加 callback，触发 EventEmitter → SSE connection
- 优点：实时（<10ms 推送）
- 缺点：污染 `packages/db`，违反 §1（Core 不应感知 HTTP）
- **否决**

### 候选 B：服务端主动短轮询 flow_log（500ms tick）
- SSE 端点启动一个 interval，每 500ms 查 flow_log/progress_log 增量
- 优点：零污染 db 包 / 零新依赖 / 实现 ~50 行
- 缺点：~500ms 推送延迟
- **采用**（延迟从 5s → 500ms = 10x 提升，体感已无感）

### 候选 C：用 `reply.hijack` 拿 raw socket 后，每个连接独立轮询
- 与 B 同，**采用 B 的实现形式**

## 实施步骤

1. **RED 测试**：写 `events-stream-routes.test.ts`：
   - SSE 客户端 mock `reply.hijack()` 接收 `data: {...}\n\n`
   - 验证：连接 → 等 1s → 推 ≥1 个 event（如插入 flow_log 后）
2. **实现 SSE endpoint**：在 `app.ts` `/api/events` 后追加 `/api/events/stream`
3. **GREEN 测试**：跑通
4. **改客户端**：dsh-matrix-connector `src/index.ts` 把 `setInterval(pollEvents, 5000)` 换成 SSE
5. **客户端测试**：mock SSE 流，验证 placeholder edit 路径
6. **真 smoke**：用 curl `-N` 验证 SSE 流；用 dsh-matrix-connector 真跑

## 验收

- [ ] 单元测试全绿
- [ ] curl `-N http://.../api/events/stream` 真看到 `data: {...}\n\n`
- [ ] dsh-matrix-connector 用 SSE 后，元素集成测 < 500ms 端到端
- [ ] master commit 链完整、worktree merge 后删除
- [ ] walkthrough + progress.md 更新

## 不做兼容性

按 §7 高速重构期 — 不为旧 client 保留 long-poll fallback。
SSE 端点上线 = `/api/events` GET 仍可用但 dsh-matrix-connector 切到 SSE。