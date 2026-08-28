# 03: @深度引用 = Pull 对象

## 目的

借鉴 Tutti·VM 的 `@ = 引用即上下文`, 让 IM 消息里的 `@agora://...` 引用**直接是完整对象**, 不是"通知字符串"。消除 agent 拿到消息后还要再 fetch 的中间环节。

## 设计原则

- §1: pull 是 Core 内的纯抽象, 不绑具体 IM — 移除 matrix 也不变
- §1.5: 最短实现, 不做兼容层
- pull 是**只读**, 不是订阅 (订阅是 §4 看门, 跟 pull 区分开)
- pull 一次拉完整, 不是流式 (流式是 SSE 增量, 跟 pull 区分开)

## 现状 — @ 只是通知字符串

```
[matrix room: !EqHMFbmSZcoiIXEEKe:agent-hub.local]
[14:23:05] user: @node-a 看下 agora://task/abc123 的进度
```

node-a 收到事件:
```json
{
  "type": "im.message",
  "text": "@node-a 看下 agora://task/abc123 的进度",
  "mentions": ["@node-a"]
}
```

node-a **还要** 调 `GET /api/tasks/abc123` 才能拿到 task 状态 — 这是"中间人转述"。

## 改进后 — @pull 直接含对象

### matrix-connector 解析层

```ts
// dsh-matrix-connector/inbound/parseMessageContext.ts
async function parseMessageContext(rawMessage: RawMatrixMessage): Promise<ParsedMessage> {
  const uris = extractAgoraURIs(rawMessage.body);
  const worksites = await Promise.all(uris.map(uri => resolveWorksite(uri)));
  
  return {
    type: 'im.message',
    text: rawMessage.body,
    mentions: extractMentions(rawMessage.body),
    context: {
      worksites: worksites,  // 完整对象!
    }
  };
}
```

### agent 收到的事件

```json
{
  "type": "im.message",
  "text": "@node-a 看下 agora://task/abc123 的进度",
  "mentions": ["@node-a"],
  "context": {
    "worksites": [
      {
        "type": "task",
        "id": "abc123",
        "uri": "agora://task/abc123",
        "content": {
          "state": "in_progress",
          "title": "v2.1 stuck auto-reassign",
          "assignee": "node-a",
          "history": [...]
        },
        "refs": [
          "agora://thread/!room:server",
          "agora://commit/d8d5fce",
          "agora://workspace/feat-v21"
        ]
      }
    ]
  }
}
```

**node-a 直接拿到完整 task**, 不需要再 fetch — 中间环节消失。

## 实施细节

### Pull 触发时机

matrix-connector 收到 inbound message 后, **emit SSE 前** 解析 URI + pull 对象。

不是:
- ❌ emit 后由 agent 拉 (恢复"中间人转述")
- ❌ 异步队列 (增加复杂度, 没有收益)

### Pull 失败的 fallback

按 §1.5 — 不做 fallback。但 ACL/404 是合法的"取不到":
- `404`: 事件 payload 含 `context.worksites[].error = "not_found"`, agent 自己决定
- `403`: 事件 payload 含 `context.worksites[].error = "access_denied"`, agent 自己决定

agent **不**会被 silent fail 阻塞。

### Pull 性能

- pull 是同步 fetch (Core 内 RPC), 不是网络调用
- 多个 URI 并行 `Promise.all`
- 大对象 (thread history 1000 条消息) — 不裁剪, agent 拿到完整内容, 自己决定怎么用
- 如果 thread > 10000 条 — 现在不优化, 等真出现再加分页

### Pull 的 ACL

pull 时 Core 检查:
- task: agora participant
- thread: matrix room member
- commit: git collaborator
- watch: watch creator
- workspace: worktree owner
- session: session creator + DSH 默认 private

## 跟 §1 的关系

- pull 接口在 Core 内 (§1) — 任何 IM adapter 实现这个接口
- matrix-connector 是**第一个**实现 (§1.5: 一个就够验证)
- 未来加 Discord adapter, 复用同一个 pull 接口
- 未来加 Slack adapter, 同样

## 实施顺序 (Phase 2 拆分)

| Step | 内容 | 谁做 |
|---|---|---|
| 2.1 | Core `resolveWorksite(uri) -> WorkSite` 接口 | Core 开发 |
| 2.2 | `parseMessageContext` 工具函数 | matrix-connector 开发 |
| 2.3 | matrix-connector inbound handler 接入 parseMessageContext | matrix-connector 开发 |
| 2.4 | 测试: 真实 matrix 房间发 `agora://task/...`, agent 收到完整对象 | 集成测试 |
| 2.5 | 跨 URI refs 自动 follow (可选, 复杂度高, 暂不做) | 待评估 |

## 验收

- [ ] matrix 房间发 `agora://task/abc123` → agent 事件 payload 含完整 task
- [ ] ACL 拒绝时, 事件 payload 含 `error: "access_denied"`, 不 silent fail
- [ ] 不存在的 URI, 事件 payload 含 `error: "not_found"`
- [ ] 多个 URI 并行 pull, 总延迟 = max(单个 pull), 不是 sum
- [ ] 没有"中间人转述"路径, agent 拿到事件就拿全上下文

## 不做的事

- ❌ 不做订阅/推送 (这是 §4 watch 的工作)
- ❌ 不做流式增量 (这是 SSE 的工作)
- ❌ 不做 URI 跟随 (refs 自动 follow 留待评估)
- ❌ 不做内容压缩 / 摘要 (Tutti 风格的) — agent 自己决定怎么用
- ❌ 不做"@all" 群发 (Tutti 风格的) — 我们是 ACL 受控