# 记忆总结、角色例行与 Matrix 群协同（2026-09-01）

## 结论

本阶段复用现有 Company OS / Personal Office 内核，新增三条 provider-neutral 主链：

1. 终态任务自动生成一条带来源指纹的群组记忆，重复扫描不会重复写入。
2. 角色继续使用现有 `RoleDefinition` / `RelationshipProfile` 版本化人格；长期主动行为使用通用 `Routine`、租约和投递绑定，不新增“生活角色”主体类型。
3. Matrix connector 只读取 Core 的任务、timeline 和 conversation，在房间内渲染协同快照；房间不是任务状态 SSoT。

本阶段 follow-up 已把三条主链接成可运行闭环：RoutineRunner 消费 durable run 并通过端口调用 runtime、artifact、IM；Matrix adapter 对显式点名实施回合预算；结构化摘要在写入 GroupMemoryPort 前统一脱敏。三者都保持“Core 规则 + adapter 副作用”的边界。

生活、健康和模拟伴侣仍是独立根信息域。Routine 的 `target_domain`、记忆 `scope_ref` 和 Matrix 安全边界必须显式绑定，不能因为角色或房间名称隐式跨域。

## 记忆自动总结

`TaskMemorySummaryService` 只处理 `done` / `cancelled` 任务：

- 汇总 task metadata、progress log、conversation，按内容计算 SHA-256 `fingerprint`。
- 以 `(task_id, fingerprint)` 唯一键落 `task_memory_summaries`，先写 `pending`，Mem0 成功后写 `succeeded` 和 `memory_id`，失败保留错误以便重试。
- 默认 scope 为 `project:<project_id>`，无项目时为 `task:<task_id>`；调用方可以显式传入更窄 scope。
- 记录 controller/团队成员和 task id 等 provenance metadata，Core 不实现向量检索或模型摘要。
- 当 `AGORA_MEM0_URL` 或 `AGORA_MEM0_TOKEN` 配置时，server observation tick 会扫描终态任务；未配置时不启动 Mem0 写入，避免无目标的失败循环。

REST：

- `POST /api/tasks/:taskId/memory-summary`
- `GET /api/tasks/:taskId/memory-summaries`
- `POST /api/memory-summaries/scan`

自动总结是“可重放的记忆写入”，不是把 Matrix 消息全量复制到记忆库。原始对话仍留在 Core conversation 表，敏感域应配置独立 Mem0 scope/vault。

## 人格与长期例行

- 人格事实继续存于现有 role/citizen scaffold 的 `soul`、`boundaries`、`heartbeat`、`recap_expectations`，以及 `RelationshipProfile` 的不可变版本；修改人格必须产生新版本。
- `Routine` 是通用的长期触发器：`owner_ref`、`agent_ref`、`role_ref`、prompt、interval/daily schedule、`target_domain`、`delivery_binding_ref` 均为显式字段。
- `RoutineService.claimDue()` 通过 `routine_runs` 租约认领，支持 succeeded/failed 回执；重复 worker 不会重复执行同一 `(routine_id, scheduled_for)`。`RoutineRunner` 再将 run 关联 `runtime_dispatch_id`，重启后根据 dispatch 状态 reconcile；完成结果可生成 Markdown artifact，投递状态（pending/delivered/failed/skipped）独立记录，投递失败只重试 IM，不重新运行 agent。
- 角色例行只表达“何时应调用什么角色指令”，不在 Core 内启动 provider 进程。执行器可由 server worker、CLI agent 或 Matrix adapter 消费 run，再通过 binding 投递。

REST：`POST/GET /api/routines`、`PATCH /api/routines/:routineId/status`、`POST /api/routines/claim`、`POST /api/routines/run`、`GET /api/routines/runs` 及 succeeded/failed 回执。

CLI 示例：

```text
agora routine create --id ea-morning --owner org:acme --agent agent:ea \
  --role role:executive-assistant --name "晨报" \
  --prompt "汇总今日任务、冲突和需要 CEO 决策的事项" \
  --first-run-at 2026-09-02T07:30:00+08:00 --interval-seconds 86400 \
  --domain work --delivery-binding matrix:room:briefing
agora routine claim --consumer worker:ea
agora routine run                 # 仅在注入 runner 的 CLI 组合中启用；server 推荐 POST /api/routines/run
agora routine runs --routine ea-morning
```

## Matrix 群协同

connector 新增只读协同命令：

```text
/agora task collab <task_id>
/agora task timeline <task_id>
/agora task context <task_id>       # collab 别名
```

输出包括任务状态/阶段、团队成员、最近 8 条 Core timeline 事件、最近 8 条 conversation 和下一步建议；timeline 或 conversation 暂不可用时会明确显示 unavailable，不伪造空结果。connector 不缓存权威状态，也不替代 Core 的人类 Gate。

成员协同约定：

1. CEO/人类在任务房间发送普通消息或回复；已有 thread binding 的回复会回流 Core conversation。
2. agent 在房间发布进展、阻塞和交接信息；周期性用 `collab` 回看共同上下文。
3. `/agora task pause|resume|unblock` 仍是显式生命周期动作；不可逆动作仍走 Dashboard Gate。
4. 任务完成后由 Core 自动总结，Matrix 只展示结果和 artifact 引用。

### 回合控制（connector adapter）

- 人类普通消息继续进入绑定任务的 conversation，但只有显式 `/agora` 命令或 `@role` 点名才会唤醒自然对话 runtime。
- agent 消息若没有显式 `@role` 目标不会再次唤醒；同一 room/task 维护 event 去重、agent 冷却（默认 1.5s）、每轮 agent 上限（默认 1）和最大轮次（默认 4）。
- 回合状态是 adapter 本地保护，不替代 Core 的 task/coordination 权威状态；跨进程重启后应由 Core conversation/coordination 重新决定是否继续。

## 安全和未决边界

- Company、Life、Health、Companion 继续独立根域；Routine 与记忆 scope 不得跨域隐式复用。
- Matrix 所有房间保持关闭 E2EE 的现有部署口径；这是当前用户选择，不代表健康/个人域可以省略独立身份、vault 或授权。
- 结构化摘要 provider 目前提供 deterministic fallback（facts/decisions/lessons/unresolved + confidence）；注入 LLM provider 时仍须复用同一 redactor 和 fingerprint 幂等链。
- 本阶段不提供 DST 完整日历语义、多房间 CRDT、跨进程回合状态持久化；RoutineRunner 定时器默认需要 `AGORA_ROUTINE_RUNNER_ENABLED=true`，生产部署应明确打开并监控 delivery_failed。
