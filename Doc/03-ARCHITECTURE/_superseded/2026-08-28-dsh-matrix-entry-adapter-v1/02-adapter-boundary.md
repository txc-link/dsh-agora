# adapter 边界 — C 方案（opaque threadKey + adapter 私有 registry）

## 三方案对比

### 方案 A：Core 纯净（最严格）
- agora 中央**绝不**出现 `matrix_room_id` 字面字段
- agora 中央事件流是 `{ task_state_changed, threadKey, state, result }`
- threadKey 由 connector 自己解释成 room
- 派发目标 `dsh:node-x:agent-y` 仍是 opaque

**优点**：明天换 matrix 为飞书，agora 中央零改动。**符合 §1 红线**。
**缺点**：agora 中央不知道房间里发生了什么，"用户看到派发历史"等体验功能依赖 connector 自己拉。

### 方案 B：功能完整（违反 §1）
- agora 中央显式持有 `matrix_room_id`、`mxid`、`power_level` 等字段
- agora 中央事件流是 matrix-aware
- 派发目标解析

**优点**：体验完整，"接近飞书"。
**缺点**：agora 中央变成 "matrix 中央的 RPC 代理"。**§1 违规**。换 IM 平台要改 core。

### 方案 C：A 为主 + 选择性扩展（**采用**）
- agora 中央 API **不动一字**
- agora 中央**不出现**任何 `matrix_*` 字面字段
- dsh-matrix-connector **内部**持有 thread registry：
  ```
  threadKey (agora opaque string) ↔ matrix_room_id (connector 私有)
  ```
- agora 中央事件流仍是 opaque，但 connector 解释 threadKey → room
- dsh-matrix-connector 内部从 matrix 中央 `/rooms/{roomId}/messages` 拉历史 → 拼装 "房间视图"

**核心约束**：

| agora 中央字段 | 是否含 matrix 概念 |
|---|---|
| threadKey | ❌ 不透明 |
| actor | ❌ 不解析，存原文 |
| result envelope | ❌ 不解析，存原文 |
| dispatch target | ❌ `dsh:node-x:agent-y` 不变 |

**最终方案 = C**。

## 数据流（双向桥）

### 入站：matrix room → DSH Agent
```
Element 用户发消息 "!"
  1. matrix-js-sdk /sync 收到 m.room.message
  2. message-router 解析（命令模式 / 自然语言 fallback v0.1 不做）
  3. 构造 agora 中央 dispatch payload：
     {
       target: 'dsh:node-a:default',    // opaque to agora
       prompt: 'ask REMOTE_OK',
       actor: '@user:agent-hub.local',  // opaque string, agora 不解析
       threadKey: 'mx_' + sha256(roomId).slice(0,16)  // connector 自己算
     }
  4. POST /api/dispatch → dispatch_id
  5. 立即回房间："🤖 thinking... (dispatch_id=abc123)"
  6. 在 thread registry 注册：
     threadKey 'mx_xxxxx' → roomId '!roomId:homeserver'
     placehodlerMsgId 'msg_xxx'
```

### 出站：DSH Agent → matrix room
```
DSH Agent 完成
  1. agora 中央事件流产生 { task_state_changed, threadKey, state, result }
  2. dsh-matrix-connector polling 收到（5s 间隔）
  3. 查 thread registry → roomId + placeholderMsgId
  4. matrix client editMessage(roomId, placeholderMsgId, formatted_result)
  5. format = 'org.matrix.custom.html'（markdown → HTML）
```

### 失败路径
```
- matrix-js-sdk /sync 断连：matrix-js-sdk 内置指数退避
- agora 中央 5xx：matrix 房间回 "agora unavailable"
- agent dispatch 超时：agora 中央 lease 机制处理（dsh-agora 0.4+）
- matrix 上传 mxc 失败：connector 内部 outbox 持久化
```

## §1 红线验证

| §1 要求 | C 方案是否通过 |
|---|---|
| 三层口径明确 | ✅ connector 是 entry adapter |
| packages/core 不写死 IM 名 | ✅ agora 中央 / core 不动 |
| provider-specific 数据只能 adapter 状态 | ✅ mxid/roomId 只在 connector 内存 |
| apps/server 不承载核心业务 | ✅ server 不变 |

## §1.5 第一性原理验证

| §1.5 要求 | C 方案是否通过 |
|---|---|
| 不允许兼容性补丁 | ✅ 干净起步 |
| 不允许过度设计 | ✅ v0.1 最小范围 |
| 不允许扩展到用户未要求 | ✅ voice/卡片/E2EE 全在 v0.1 外 |
