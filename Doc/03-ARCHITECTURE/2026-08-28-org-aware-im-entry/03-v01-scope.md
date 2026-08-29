# 03 — v0.1 范围：matrix 房间 = agora citizen 会议室

## 1. 一句话定义

**v0.1 让 matrix 房间成为 agora Core 的"会议室"**——人类在 Element 客户端能看见 citizen、能触发派发、能审阅工件。

## 2. 能力清单（v0.1 必须实现）

### 2.1 公民可见性

| 命令 | 行为 | 后端调用 |
|---|---|---|
| `/agora citizen list` | 显示房间可见的所有 citizen（display_name + role + status） | `GET /api/citizens?project_id=...` |
| `/agora citizen show <citizen_id>` | 显示单个 citizen 的完整 profile | `GET /api/citizens/:id` |
| 房间加入新成员自动推送 | 房间变更时推送当前活跃 citizen 列表 | webhook → matrix room |

### 2.2 任务派发

| 命令 | 行为 | 后端调用 |
|---|---|---|
| `/agora dispatch <citizen_id> <prompt>` | 创建 task 派发给指定 citizen | `POST /api/tasks` |
| `/agora dispatch <prompt>` | 默认 citizen 派发（v0.1 用 `dsh:node-a:default`） | 同上 |
| 房间自动占位消息 | 创建 task 立即回 🤖 "thinking... (task_id=abc123)" | — |
| 占位消息编辑 | task 状态变化时 edit | 订阅 `/api/events` |
| 最终结果编辑 | task 完成时 edit 占位为结果 | 同上 |
| 失败处理 | task 失败时 edit 占位为 ❌ "failed: <reason>"，不重试 | 同上 |

### 2.3 工件审阅

| 命令 | 行为 | 后端调用 |
|---|---|---|
| `/agora task <task_id>` | 显示 task 详情（status / stage / participation / artifacts） | `GET /api/tasks/:id` |
| `/agora task <task_id> artifacts` | 列出 task 关联的 artifacts | `GET /api/tasks/:id/artifacts` |
| `/agora artifact <artifact_id>` | 上传 artifact 到 matrix room（mxc） | `GET /api/artifacts/:id/content` → mxc |

### 2.4 上下文查阅

| 命令 | 行为 | 后端调用 |
|---|---|---|
| `/agora brain search <query>` | ProjectBrain 检索（返回 top 6 references） | `GET /api/projects/:id/brain?q=...` |
| 检索结果作为消息 | 把 top 1-3 reference 摘要发房间 | — |

### 2.5 跨房间策略

| 配置项 | 默认值 | 含义 |
|---|---|---|
| `shareSessionInChannel` | `false` | 每个 matrix 房间独立 threadKey（不共享 session） |
| `allowFrom` | `'*'` | 谁能触发（mxid 白名单） |
| `groupReplyAll` | `false` | 是否 @ 全体 |

## 3. 命令字解析（message-router.ts）

### 3.1 命令格式

```
/agora <verb> [args...]
```

| verb | 必填参数 | 可选参数 | 示例 |
|---|---|---|---|
| citizen | list \| show | `<citizen_id>` | `/agora citizen list` |
| dispatch | `<citizen_id> <prompt>` 或 `<prompt>` | — | `/agora dispatch ask REMOTE_OK` |
| task | `<task_id>` | `artifacts` | `/agora task abc123 artifacts` |
| artifact | `<artifact_id>` | — | `/agora artifact sha256-xxx` |
| brain | `search <query>` | — | `/agora brain search dispatch 协议` |
| im | `health \| help` | — | `/agora im help` |

### 3.2 解析失败处理

- 命令不识别 → 回房间 "❌ unknown command. type `/agora im help`"
- 参数缺失 → 回房间 "❌ missing arg. usage: ..."
- 命令格式错 → 回房间 "❌ invalid syntax. ..."

## 4. 数据流（v0.1 完整主链路）

### 4.1 入站：matrix 房间 → agora 任务

```
Element 用户输入 "/agora dispatch ask REMOTE_OK"
  1. matrix-js-sdk /sync 收到 m.room.message
  2. message-router 解析：verb='dispatch', args=['ask', 'REMOTE_OK']
  3. 校验 allowFrom 白名单
  4. 构造 agora 中央 dispatch payload：
     {
       target: 'dsh:node-a:default',
       prompt: 'ask REMOTE_OK',
       actor: '@user:agent-hub.local',  // opaque
       threadKey: 'mx_' + sha256(roomId).slice(0,16),
     }
  5. POST /api/tasks → task_id
  6. 在 thread registry 注册：
     threadKey 'mx_xxxxx' → { roomId, placeholderMsgId }
  7. 立即回房间："🤖 thinking... (task_id=abc123)"
```

### 4.2 出站：agora 任务 → matrix 房间

```
DSH Agent 执行 / 完成 / 失败
  1. agora 中央事件流产生 task_state_changed
  2. dsh-matrix-connector polling /api/events?since=<seq>（5s 间隔）
  3. 查 thread registry → roomId + placeholderMsgId
  4. matrix client editMessage(roomId, placeholderMsgId, formatted_result)
     format='org.matrix.custom.html'（markdown → HTML）
```

### 4.3 失败 / 降级路径

| 失败 | 处理 |
|---|---|
| matrix-js-sdk /sync 断连 | sdk 内置指数退避 |
| agora 中央 5xx | matrix 房间回 "agora unavailable" |
| task 超时（agora 中央 lease） | 中央处理，connector 被动接受结果 |
| matrix 上传 mxc 失败 | connector 内部 outbox 持久化（v0.2 完善） |
| bot token 失效 | 启动 fail-fast，DSH 报错 |

## 5. v0.1 严格不做

| 不做 | 原因 |
|---|---|
| voice / STT / TTS | v0.2 |
| 卡片 / 富交互 | v0.2 |
| E2EE | v0.2 |
| 多 bot 协作（一个房间多个 bot） | v1.0 |
| room 状态同步 / 历史拉取 | v1.0 |
| 自然语言 fallback（不认 `/agora` 前缀） | v0.1 只认 `/agora` |
| mxid 身份映射 / 权限决策 | v1.0 |
| MergeProposal 在 matrix 房间审批 | v1.0 |
| HostResource 实时面板 | v1.0 |
| agora 中央代码改造 | 永不做 |
| Synapse 代码改造 | 永不做 |
| cc-connect 代码改造 | v0.1 不动 |

## 6. v0.1 验收（按 §4 + Doc/reference/testing-standard.md）

### 6.1 自动化验收

1. `npm run typecheck` 0 错误
2. `npm test` 单测全绿：
   - `tests/matrix-client.test.mjs`：login/sync/send/edit/upload mxc（mock sdk）
   - `tests/message-router.test.mjs`：解析 + 路由（纯函数）
   - `tests/citizen-bridge.test.mjs`：调 agora 中央 citizen API（mock fetch）
   - `tests/task-bridge.test.mjs`：调 agora 中央 task API（mock fetch）
   - `tests/attention-bridge.test.mjs`：调 agora 中央 brain API（mock fetch）
3. `npm run smoke:matrix` 在真 Synapse 跑通

### 6.2 冒烟验收（手动）

- 用户在 Element 输入 `/agora citizen list` → 房间显示 citizen 列表
- 用户输入 `/agora dispatch ask REMOTE_OK` → 占位 → agent 响应 → 编辑结果
- 用户输入 `/agora task abc123 artifacts` → 房间显示 artifacts 列表

## 7. 工作量估算（按资深架构师 C 视角）

| 任务 | 工作日 |
|---|---|
| 新仓初始化 + cordis 接入 + 单测骨架 | 0.5 |
| matrix-client + 单测 | 2 |
| message-router + 单测 | 1 |
| citizen-bridge + 单测 | 1 |
| task-bridge + 单测 | 1 |
| attention-bridge + 单测 | 0.5 |
| provision-bot 脚本 | 1 |
| smoke-matrix + 真 Synapse 调试 | 1 |
| README + walkthrough | 1 |
| 总计 | **9 工作日 ≈ 4 周** |

## 8. 与 v0.2 / v1.0 的边界

| v0.1 范围 | v0.2 增量 | v1.0 增量 |
|---|---|---|
| citizen list / show / dispatch / task / artifact / brain search | 卡片（format='card.v1'）+ context 流 + inbox 通知 + 工件 mxc 预览 | 多 citizen 同房间协同 + A2A + attention routing + host resource 面板 + merge proposal 审批 |

## 9. v0.1 工作流（按 §3 + §4）

### 阶段

1. 开 worktree + 初始化 dsh-matrix-connector 仓
2. RED test 骨架（5 个测试文件 + smoke）
3. matrix-client 绿
4. message-router 绿
5. citizen-bridge 绿
6. task-bridge 绿
7. attention-bridge 绿
8. provision-bot 脚本
9. smoke-matrix 真 Synapse 调试
10. README + walkthrough + 11 份落盘文档回写

每个阶段前读 task_plan.md，后更新 progress.md。

### 工作树

按 §3 默认开 worktree：
```
/home/ailink/dsh-agora/.worktrees/feat-dsh-matrix-connector/
  dsh-matrix-connector/  # 新 git 仓
```