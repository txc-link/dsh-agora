# findings.md — v1.0 war room advanced

## 关键事实

### 1. v0.3 已有 war room 基础
- post-mortem (subtask output → 摘要)
- room roster resolver (dsh-bridge-<name>)
- per-room status panel
- ThreadRegistry 已记录 roomId → taskId 映射

### 2. artifact 现有能力
- `agora.getArtifactContent(artifactId)` 返 `{bytes, media_type, name}`
- `ArtifactBridge.fetchBytes(artifactId)` 包装
- `agora.getTask(taskId)` response 含 `artifacts[]` array

### 3. slash command 已有结构
- `message-router.ts` 的 `route(body, opts)` 返 `{verb, args, subVerb, errorCode}`
- 已有的 verb: `citizen`, `dispatch`, `task`, `artifact`, `brain`, `im`
- `decision.verb === 'rollup'` 是新加 — 改 router + 加 test

### 4. plugin 的 room 列表来源
- 没有现成 `joinedRooms` API
- 但 plugin 已经被 invite 到至少一个 room — roomId 来源是 incoming message.roomId
- §1.5 最短路径: "rollup" 只显示**当前 room 里**的 tasks + 其他 room 已知 tasks (via SSE events received by THIS plugin instance)

## turn 45 first-principles review 关键输出

| 块 | 在哪 | 状态 |
|---|---|---|
| 跨房间汇总 panel | plugin | ✅ v1.0.1 |
| artifact 摘要回投 | plugin | ✅ v1.0.2 |
| 卡住自动呼叫别的 agent | Core (orchestration) | ❌ **不在这** |
| 跨房间 push panel | hybrid | ❌ 需 new Core signal |

## §1 边界确认

- v1.0.1 rollup 是**只读视图** (从 ThreadRegistry + SSE events 拉的内存态) → 纯 plugin
- v1.0.2 summarize 是**只读 fetch** + **格式渲染** → 纯 plugin
- 都不动 task lifecycle, 都不发新 task — **0 orchestration**

## 待澄清 (resolved by plan)

- ✅ rollup 怎么知道其他 rooms? — 拉本地 ThreadRegistry + 历史上 SSE 出现的 roomId
- ✅ artifact 摘要多长? — 240 字符
- ✅ binary artifact 怎么处理? — "(binary, not shown)"

## 未决 (留给未来)

- ❌ v1.1: 跨房间 push panel (需 Core signal)
- ❌ v1.1: artifact 全文 upload
- ❌ v2.0: 卡住自动呼叫 (Core orchestration)
- ❌ v2.0: issue 总线