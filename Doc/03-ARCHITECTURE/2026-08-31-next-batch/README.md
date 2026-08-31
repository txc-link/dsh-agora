# 2026-08-31 next-batch — architecture index

> **Source**: 用户 turn 1 — "更新 dsh-agora 和 dsh-matrix-connector, 拉取新代码, 然后继续 [六个缺口]"
> **Status**: implementation landed; this index is the architecture landing
> for the batch per AGENTS.md §3 (讨论落地规则) and §1.5 (first-principles).

## 文档索引

| 文件 | 主题 | 状态 |
|---|---|---|
| `task-center.md` | 任务中心（拆解/进度/审批队列）三后端切片 + Dashboard 三组件 + connector slash 委托 | 已实现 |
| `calendar-commitment.md` | Radicale CalDAV 接入 + work/life collection 隔离 + 晨报晚检 + Human Gate 边界 | 已实现 |
| `monitoring-ops.md` | Grafana → Matrix relay + 运维面板 JSON + Element widget enablement | 已实现 |
| `collaborative-docs.md` | Markdown v0.1 单写者 + sha256 内容寻址 + 内容审核 placeholder | 已实现 |
| `element-call.md` | Element Call widget enablement（SFU/TURN 部署留给用户） | enablement only |
| `t-transfer-followup.md` | 任务 assignee 转派 deferred design（RuntimeBinding/Employment 触及 Core 语义；6 项用户拍板） | design draft |

## 与裁决/AGENTS 的对应

- 任务中心对应 verdict §0.1 + §3（Widget+REST 投影 + Human Gate 在 Dashboard）。
- 日历/承诺对应 verdict §3（Radicale + 隔离 + commitment 主账）。
- 监控对应 verdict §3（监控缺口 §C + Grafana iframe + relay）。
- 协作文档对应 verdict §3.4（v0.1 单写者 + 版本号）。
- Element Call 对应 verdict §3 P2（enablement only，SFU 部署推迟）。
- 转派 follow-up 对应 walkthrough §3 + §1.5（避免兼容性补丁）。

## 与 SSoT 的关系

- `Doc/Agora-实施排期-Agora-TS.md` §7 Change Log（commit e012a0c / 2e9d521 / 3da427e / b8c08cd / 9fe8dc6）
- `Doc/Agora-实施排期-Dashboard.md` row 8（commit 2e9d521 + 9fe8dc6）
- `Doc/10-WALKTHROUGH/2026-08-31-next-batch.md` walkthrough §3 follow-ups
- `docs/10-WALKTHROUGH/2026-08-31-next-batch.md`（matrix connector 同名）

## 验证 (verify-before-completion)

- `npm test` (matrix-connector) → 288/288 green
- workspace `tsc -b` → clean
- dashboard `tsc --noEmit` → clean
- smoke harnesses → radicale-adapter, monitoring-relay, task-center 全部 exit 0
- unit tests → adapters-calendar 12/12, calendar-service 3/3, monitoring-relay 4/4, approval-service 11/11