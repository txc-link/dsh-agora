# 记忆总结、角色例行与 Matrix 协同 Walkthrough

## 1. 先创建一个角色例行

```text
agora routine create --id research-daily --owner org:austin-agent-company \
  --agent agent:research-lead --role role:research-lead \
  --name "研究日报" --prompt "汇总在办研究任务、阻塞和新的可验证结论" \
  --first-run-at 2026-09-02T18:00:00+08:00 --interval-seconds 86400 \
  --domain work --delivery-binding matrix:room:research-briefing
```

`routine claim` 是执行器的租约入口。拿到 run 后，worker 使用 routine 的 `prompt` 和 `role_ref` 执行，再提交 succeeded/failed；Core 只保存调度与回执，不把 provider 命令写进模型。

## 2. 终态任务记忆

配置 `AGORA_MEM0_URL`（可选 `AGORA_MEM0_TOKEN`）后，server 的 observation tick 会扫描已完成/取消任务：

```text
POST /api/memory-summaries/scan
GET  /api/tasks/<task_id>/memory-summaries
```

同一任务内容不变时第二次扫描返回 `already_summarized`；出现新的 progress 或 conversation 时会产生新的 fingerprint 和新的记忆版本。原始对话仍在 Core，不会被 Matrix connector 私自复制。

## 3. 在 Element 房间里协同

任务创建后，将任务房间作为人类和 agent 的共同工作面：

```text
/agora task collab OC-123
```

示例输出结构：

```text
🤝 task `OC-123` — 对比长期记忆方案
state=running  stage=research  type=research
creator=@ceo:agent-hub.local
team: lead=agent:research-lead, worker=agent:writer
timeline (3/3):
- ... progress @agent:research-lead: 完成 Mem0/Obsidian/Git 对比
conversation (2 latest):
- CEO: 重点看隐私和版本化
- Agent A: 我会补充迁移风险
next: agents should post progress here; the room timeline is the shared source of truth.
```

`timeline` 是同一命令的短别名，`context` 也兼容为 `collab`。如果旧 server 尚未部署 timeline 或 conversation route，命令会报告具体 unavailable 错误，而不是显示误导性的空列表。

## 4. 角色长期成长的闭环

人格改动走 `RelationshipProfile` 新版本；例行执行后写 progress/artifact；终态任务进入记忆总结；下一次任务通过 Core Brain/Mem0 检索历史。这样人格、任务、文档、记忆和 Matrix 展示各有 SSoT，同时保留审计与人工 Gate。

## 5. 本阶段验证

- Agora workspace build：通过。
- Core memory/routine tests：3/3 通过。
- DB routine repository test：通过（SQLite 内存库）。
- Server memory/routine route test：通过。
- Matrix connector build：通过。
- Matrix connector tests：292/292 通过。

完整 Agora DB 测试在 Windows 仍会触发仓库既有 SQLite 临时目录 `EPERM` 清理问题；迁移期望已更新到 `050_memory_summaries_routines.sql`，该环境问题不属于本阶段功能回归。
