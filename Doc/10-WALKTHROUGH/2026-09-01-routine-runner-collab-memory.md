# RoutineRunner、群内回合控制与结构化记忆演练

## 目标

本阶段将长期角色从“只有计划记录”推进到可恢复执行闭环，并让 Matrix 房间能承载人类与多个 agent 的受控协作，同时把终态任务沉淀成可检索且经过脱敏的结构化记忆。

## 1. 创建并执行一条例行任务

创建例行：

```text
agora routine create --id ea-morning --owner org:acme --agent dsh:node-home-linux:assistant \
  --role role:executive-assistant --name "晨报" \
  --prompt "汇总今天任务、日历冲突和需要 CEO 决策的事项" \
  --first-run-at 2026-09-02T07:30:00+08:00 --interval-seconds 86400 \
  --domain domain:company --delivery-binding !company-briefing:agent-hub.local
```

开启 server runner（未部署环境）：

```text
AGORA_ROUTINE_RUNNER_ENABLED=true
AGORA_ROUTINE_CONSUMER=agora:routine-runner
AGORA_ROUTINE_RUNNER_INTERVAL_MS=5000
```

每一轮的可审计链为：`claimDue → create runtime dispatch → attach dispatch → reconcile → mark succeeded/failed → create Markdown artifact → deliver`。如果 Matrix 投递失败，下一轮只重试投递，不重复调用 agent；`GET /api/routines/runs?delivery_status=failed` 可定位积压。

手动触发：

```text
POST /api/routines/run
```

## 2. Matrix 群内协同

绑定任务的房间中，普通人类消息会进入 Core conversation。要唤醒指定协作者，使用明确点名：

```text
@researcher 请核对论文来源，并把冲突列成三条
@writer 根据 researcher 的结论写一页摘要
```

connector 默认执行：同一 room/task 最多 4 轮；每轮最多一个 agent 自动继续；agent 再次发言必须带 `@role`；重复 event 被丢弃，短时间内触发会进入 cooldown。这样多个 bot 可以读到同一个房间上下文，但不会因为普通 bot 消息无限互相唤醒。任务权威状态仍在 Core，房间只是投影和入口。

## 3. 结构化记忆

终态任务由 observation scan 或 `POST /api/tasks/:taskId/memory-summary` 触发。写入 GroupMemoryPort 的文本包含：

- `## 事实`
- `## 决策`
- `## 经验`
- `## 未决`
- `## 原始摘要`

metadata 增加 `summary_schema=agora.task-memory/v2`、四类数组、`confidence`、`redacted` 和 `redaction_patterns`。SHA-256 fingerprint 仍基于原始 task/conversation/progress，确保重复扫描幂等；脱敏只作用于写入记忆的副本，原始 conversation 仍留在 Core 审计链。

## 验收结果

- Agora RoutineRunner/Core memory：7/7 focused tests；DB routine：2/2；Server memory/routine route：1/1；workspace build 通过。
- Matrix connector：295/295 tests，build 通过。
- Windows 全套 DB 测试仍会受到临时目录清理 `EPERM` 影响，这是环境问题，不是 migration 失败。
- 本阶段未部署、未修改 DSH/OpenClaw/Hermes 或其他 provider 源码。
