# 02: URI 协议

## 目的

跨域引用 agora 内任何工作现场对象的标准 URI 协议。让 agent / 人能"@ 一个 URI, 自动拿到完整对象", 消除"中间人转述"。

## 设计原则

- §1: URI 是 Core 内的纯字符串约定, 不绑 IM/git/sentinel — 移除具体实现也不变
- §1.5: 最短实现, 不做兼容层
- 可解析: 任何 agent 收到 URI 都能本地解析
- 可 ACL: 解析时按 agora 现有 participant 权限

## URI scheme 设计 (草案)

### 单 scheme vs 多 scheme 决策

**候选 A: 单 scheme `agora://`** (推荐)
- 优势: 简单, 一个 namespace, agora 中央是 root
- 优势: ACL 统一在 agora 中央管
- 劣势: URI 不是"自描述" (看不出是 task 还是 thread)

**候选 B: 多 scheme `agora://` + `matrix://` + `git://`**
- 优势: URI 自描述
- 劣势: 跨 scheme 的 ref 需要 resolver 联邦 (复杂)
- 劣势: ACL 不能统一

**§1.5 决策**: 候选 A (单 scheme), 理由:
1. ACL 统一 (agora 中央管) — 受控核心
2. 最短路径
3. 跟 §1 "agora 中央是唯一 Core 语义" 对齐

### 单 scheme 协议

```
agora://<type>/<id>
```

types:
- `task` (agora Task)
- `thread` (matrix room / IM thread)
- `commit` (git commit)
- `watch` (sentinel watch)
- `workspace` (git worktree)
- `session` (DSH session)

完整列表见 [`01-worksite-abstraction.md`](./01-worksite-abstraction.md)

### URI 例子

```
agora://task/abc123
agora://thread/!EqHMFbmSZcoiIXEEKe:agent-hub.local
agora://commit/d8d5fce
agora://watch/sentinel-port-8008
agora://workspace/feat-v21-stuck-reassign
agora://session/turn-456
```

### URI 怎么解析

1. agent 收到 IM 消息, 发现含 `agora://<type>/<id>`
2. 调 `core.resolve(uri) -> WorkSite` (Core 内抽象接口)
3. Core 找到对应 type 的 adapter, fetch 完整 content
4. 返回 WorkSite 对象 (含 content + refs + acl + updated_at)
5. agent 拿到完整对象, 不需要再 fetch

### URI 错误处理

- 不存在的 URI: `404 WorkSiteNotFound`
- ACL 拒绝: `403 WorkSiteAccessDenied`
- URI 格式错误: `400 InvalidURI`

## ACL 跟 URI 的关系

- URI 本身**不**含权限信息
- ACL 由 agora 中央统一管, 解析时调用
- 每个 type 的 ACL 规则可以不同:
  - `task`: agora Task participant
  - `thread`: matrix room member
  - `commit`: 仓库 collaborator (从 git config 读)
  - `watch`: watch creator (sentinel 配置)
  - `workspace`: worktree owner
  - `session`: session creator + DSH 默认 private

## 跨 URI 引用 (refs)

WorkSite 之间可以互引, 形成工作现场的图:

```json
{
  "type": "task",
  "id": "abc123",
  "uri": "agora://task/abc123",
  "content": {...},
  "refs": [
    "agora://thread/!room:server",       // 讨论这个 task 的 thread
    "agora://commit/d8d5fce",            // 关联 commit
    "agora://workspace/feat-v21",        // 关联 worktree
    "agora://session/turn-456"           // 关联 session
  ]
}
```

agent 拿到一个 task, 通过 `refs` 看到它跟哪些 thread/commit/workspace/session 关联, 直接 pull 每个 ref 拿到完整上下文 — **不需要中间人转述**。

## URI 跟 IM 消息的集成 (Phase 2 入口)

详细见 [`03-deep-reference-pull.md`](./03-deep-reference-pull.md)

简短:
- matrix-connector 解析 IM 消息里的 `agora://` URI
- 在 emit SSE event 前, 自动 pull WorkSite
- 把 WorkSite embed 进 event payload

## 实施顺序

| Step | 内容 | 谁做 |
|---|---|---|
| 2.1 | Core 内 URI parser + validator | Core 开发 |
| 2.2 | URI 协议 spec 文档 + 测试 | Core 开发 |
| 2.3 | 单 scheme 决策确认 (候选 A) | 本 doc 已确认 |
| 2.4 | matrix-connector URI 解析 | matrix-connector 开发 |

## 验收

- [ ] URI 格式在 core 单元测试 100% 通过
- [ ] `agora://task/abc123` 解析后返回正确 WorkSite
- [ ] 不存在的 URI 返回 404, 不是 silent fail
- [ ] ACL 拒绝的 URI 返回 403, 不暴露 content
- [ ] refs 数组完整, agent 能递归 pull

## 不做的事

- 不做 URI 版本控制 (Tutti 风格的版本化)
- 不做 URI 实时编辑 (Tutti 风格的实时协作)
- 不做 URI 公开 URL (Tutti 的 share link) — 我们受控

---

## 5. matrix 多 Room 模拟 Discord Thread (t=59 方案调整)

### 背景

用户 (t=59): "matrix 可以类似 discord 线程隔离吗, 这是 agent 协同 discord 的优势"

**关键事实**:
- matrix 协议层**没有原生 thread**
- matrix 的隔离单位是 **Room** (matrix homeserver 的一等公民)
- Discord thread = Room scope 隔离 + 独立 ACL

**§1.5 决策**: 用 **多 Room 模拟 Thread**, 不用 message 标签模拟
- ✅ 真隔离 (Room 级 ACL)
- ✅ 跟 matrix 协议对齐
- ✅ 0 第三方插件成本
- ✅ ACL 干净 (borrow Agent 只进授权 Room)

### 现状 (turn 35)

- 只有 1 个 war room: `!EqHMFbmSZcoiIXEEKe:agent-hub.local`
- 所有 agent 讨论在 1 个 Room — 消息历史混在一起

### 改造后 (Phase 2 子能力)

**每个 agora Task 对应 1 个 matrix Room**:

```
Homeserver (agent-hub.local)
  ├── !war-room:agent-hub.local            (主战情室, 通知用)
  │     ├── "新 task abc123 创建, ↗ #task-abc123"
  │     ├── "stuck alert: task abc123"
  │     └── "..."
  ├── !task-abc123:agent-hub.local          (Task abc 的 Room, agent 跑这里)
  │     ├── "[14:23] user: @node-a 看 task"
  │     ├── "[14:24] node-a: 我开跑"
  │     └── "..."
  └── !task-xyz789:agent-hub.local          (Task xyz 的 Room)
        └── "..."
```

### 实现细节

**触发点**: agora Task `create` event
- 同步创建 matrix Room (`POST /_matrix/client/v3/createRoom`)
- Room name = `agora-task-<task_id>`
- Room topic = task title
- ACL = task participant (从 agora Task 拿)
- main war room 发 "新 task + 跳转" 通知

**`agora://task/<id>.refs` 自动包含 task Room URI**:
```json
{
  "type": "task",
  "id": "abc123",
  "uri": "agora://task/abc123",
  "refs": [
    "agora://thread/!task-abc123:agent-hub.local",
    ...
  ]
}
```

agent @pull task 时, 拿到 task Room URI, 直接进入 task Room 讨论 — **主战情室不污染**。

### Room 发现 (缓解 risk)

**风险**: Room 多起来后, dashboard 不知道现在有几个 active Room

**缓解** (Phase 2 加, 不复杂):
- agora 中央维护 `task → room_id` 映射表 (SQLite 加 1 张表)
- dashboard "Active Rooms" 视图 (前端复用现有 war room UI)
- matrix-connector `/agora rooms` slash (列出当前 user 加入的 task Rooms)

### 对 Phase 3 (Agent 借用) 的影响

**借用 Agent 进的是 task Room, 不是 main war room**:
- 借用过程的通知在 main war room (所有人可见)
- 借用 Agent 在 task Room 跑 (隔离)
- 借完退, 不污染 main war room

**这是 bonus**: Borrow + 多 Room 一起, 隔离效果 > Tutti 单 Room 内的 thread 隔离。

### §1 边界确认

- Core 内 `agora://thread/<key>` 的 key **不规定** 是 matrix room ID 还是 discord thread ID
- 每个 adapter 自己解释 key
- §1 自动满足 — 移除 matrix 也不变

### 验收

- [ ] agora Task create 同步创建 1 个 matrix Room
- [ ] main war room 发 "新 task" 通知含跳转
- [ ] task Room ACL = task participant
- [ ] agent @pull task 时, refs 含 task Room URI
- [ ] Room 列表可发现 (dashboard + slash command)
- [ ] borrow Agent 进 task Room, 不污染 main war room

### 不做的事

- ❌ 不做 message 标签模拟 thread (隔离不够)
- ❌ 不做 matrix-appservice 虚拟 thread (复杂, 无现成插件)
- ❌ 不做跨 homeserver Room 联邦 (Tutti 没这需求, 我们也没)