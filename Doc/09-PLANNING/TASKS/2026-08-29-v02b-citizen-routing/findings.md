# findings.md — v0.2b citizen routing (research log)

## 已发现的事实

### 1. agora 中央 createTask schema 已经支持 citizen 路由
**位置：** `agora-ts/packages/contracts/src/task-api.ts`

```ts
// line 489-503
export const createTaskRequestSchema = z.object({
  title: z.string().min(1),
  type: z.string().min(1),
  creator: z.string().min(1),
  description: z.string(),
  priority: taskPrioritySchema,
  locale: taskLocaleSchema.default('zh-CN'),
  project_id: z.string().min(1).nullable().optional(),
  team_override: teamSchema.optional(),        // ← line 497
  workflow_override: workflowSchema.optional(),
  skill_policy: taskSkillPolicySchema.optional(),
  authority: createTaskAuthoritySchema.optional(),
  im_target: createTaskImTargetSchema.optional(),
  control: taskControlSchema.optional(),
});

// line 98-106
export const teamMemberSchema = z.object({
  role: agentRoleSchema,
  agentId: z.string().min(1),
  member_kind: z.enum(['controller', 'citizen', 'craftsman']).optional(),
  ...
});
```

**结论**：plugin 只填 `team_override.members[0].agentId` 即可，**零 schema 改动**。

### 2. 之前 v0.1.1 smoke 已 POST 了 basic schema
参见 `tests/smoke-matrix.mjs.disabled`：
```js
{
  title, type, creator, description, priority
}
```
没传 `team_override`，所以 agora 中央自己挑 executor（haiku model）。

### 3. agora 中央 task 完整响应
参考 `app.ts:5108` 与 `task-api.ts`：
- POST 返 `{id, version, title, type, ..., team: {members: [...]}`
- `team.members[0].agentId` 即 agora 中央**实际派给**哪个 agent
- `team.members[0].role === 'executor'`（默认）

### 4. /api/citizens endpoint 已暴露
v0.1.1 (`ce78b83`) 已加 `GET /api/citizens?project_id=...` 返 citizen 列表。
plugin 已经能 list → 用户看 → `@<id>` dispatch。

### 5. v0.2 SSE 已 ship (turn 40 验证)
- server endpoint: `GET /api/events/stream` — `e044737` (merged `7f8391b`)
- client consumer: SSE loop 替代 polling — `3c0d32c` (feat/dsh-matrix-connector)
- smoke 验证：3 ticks pushed within 5s, seq=4,11,12

## 待澄清事项（resolved or undecided）

- ✅ citizen 解析格式：`@<id>` 前缀
- ✅ 找不到 citizen 行为：直接报错提示
- ❌ 未决：是否要支持多 agent team (team_override.members.length > 1) — v0.2b 不做
- ❌ 未决：是否要 fuzzy match "code reviewer" → 找 `code-reviewer` — 不做