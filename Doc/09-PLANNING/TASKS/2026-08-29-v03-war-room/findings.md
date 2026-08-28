# findings.md — v0.3 war room

## 关键事实 (调研已确认)

### 1. task.state 只有 created/active — 没有 completed
- `sqlite3 ~/.agora/agora.db` 显示所有 OC-* task 永远 stuck at `active`
- quick 任务 controller 派完就停 — 没人推进状态机
- §1.5 — 不能假设有 `completed` 事件

### 2. 真正的"完成"在 subtasks 表
- table: `subtasks(id, task_id, stage_id, status, output, done_at)`
- 当 controller 派 executor, executor 完成后会写 `output` + `status='completed'` + `done_at`
- post-mortem 数据源 = subtasks[].output

### 3. TaskRecord schema (domain-types.ts:54)
```ts
export interface TaskRecord {
  id, version, title, description, type, priority, creator, locale,
  project_id, state, archive_status, current_stage, skill_policy,
  team: TaskTeamDto, workflow, control, scheduler, scheduler_snapshot,
  discord, metrics, error_detail, created_at, updated_at
}
```
- **无 result 字段**
- **无 conversation 字段**
- 有 `state` (string), `current_stage`, `error_detail`

### 4. Agora 中央完整 task 响应包含 subtasks
- smoke v0.2 测试: `task.team.members[0].agentId` 存在
- 但 `subtasks[]` 需要 GET `/api/tasks/{id}` 完整 — task record 不含 subtasks

### 5. Matrix `/rooms/{id}/joined_members` 端点
- 标准 Matrix API (client-server spec)
- 返回 `{ joined: { user_id: { display_name, avatar_url } } }`
- 每个成员的 `user_id` 形如 `@dsh-bridge-node-a:agent-hub.local`
- localpart (`dsh-bridge-node-a`) = agentId

### 6. SSE tick event 完整 schema (app.ts:5020)
```ts
const agoraEventSchema = z.object({
  seq: number,
  type: string,
  task_id: string,
  state: string.nullable,
  stage_id: string.nullable,
  from_state: string.nullable,
  to_state: string.nullable,
  actor: string.nullable,
  detail: unknown.nullable,
  progress_content: string.nullable,
  created_at: string,
});
```
- `to_state === 'completed'` 在 quick 任务**永远不会触发** — 现实必须看 subtasks

## 待澄清 (resolved by v0.3.1 design)

- ✅ 怎么判断 task "完成": subtasks 全 done 或任意 subtask 有 output
- ✅ post-mortem 数据: subtasks[].output + artifacts count
- ✅ room roster 来源: Matrix 标准 API
- ✅ status panel 持久化: 内存即可 (重启重建)

## 未决 (留给未来)

- ❌ 跨 room 共享 panel (v1.0+)
- ❌ panel 按 room title 命名 (cosmetic, 不重要)
- ❌ 持久化 panel eventId (重启会重建 panel)
- ❌ task artifact 内容预览 (artifact 太大, 只展示 count + size)
- ❌ agent 卡住超时机制 (orchestration 范畴, 不是 IM adapter)