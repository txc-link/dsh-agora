# 2026-08-31 next batch — dsh-agora (agora-ts + dashboard)

> **Date**: 2026-08-31 (Asia/Shanghai)
> **Owner**: 总工 (agora-ts 后端 + dashboard 前端)
> **Branch / worktree**: `feat/2026-08-31-next-batch` @ `/home/ailink/dsh-agora/.worktrees/next-batch`
> **Trigger**: 用户 turn 1 — "更新 dsh-agora 和 dsh-matrix-connector, 拉取新代码, 然后继续 [六个缺口]"
> **Authority**: Doc/03-ARCHITECTURE/2026-08-30-expert-team/{01..04} 裁决 + AGENTS.md §1/§2/§3

## 0. 范围 (in / out)

### In (本批交付)
| Slice | 范围 | 对应缺口 | 验收 |
|---|---|---|---|
| **T_break** | (existing) `POST /api/tasks/:id/subtasks` 已存在; 本批仅补 CLI `agora task breakdown\|subtasks` + Dashboard SubtaskPanel 展示 | #1 拆解/进度展示 | CLI 单测; UI tsc |
| **T_transfer** | (deferred → follow-up) assignee transfer 触及 RuntimeBinding/Employment, 非纯增量, 需独立设计与用户拍板; 见 follow-up 列表 | #1 转派 | follow-up 设计 doc |
| **T_approve** | agora-ts: `GET /api/approvals/pending` + `POST /api/approvals/:id/decide`; 强制 Dashboard session (A4); 复用 ApprovalRequestRepo + TaskApprovalService | #1 审批 | session middleware; 单元 + REST |
| **T_progress** | agora-ts: `GET /api/tasks/:id/progress` (subtasks_total/done/percent + parent status); CLI `agora task progress` | #1 进度聚合 | 单元 (聚合逻辑) + REST |
| **T_center_ui** | dashboard: `/approvals` 审批队列页 (新) + TaskDetail 内 SubtaskPanel (新组件) + TransferReview 占位 (deferred, 显示 "coming soon") | #1 前端 | tsc 0 error; vitest 已有页面不回退 |
| **C_calendar** | agora-ts: 新包 `@agora-ts/adapters-calendar` (Radicale CalDAV client, work/life collection 隔离, read+conflict); `GET /api/calendar/{today,conflicts}?domain=`; `POST /api/calendar/reports/{morning,evening}` (返回 markdown); docker-compose snippet 起 Radicale | #3 日历/承诺 | 单测 (CalDAV 解析) + REST |
| **M_ops** | 新轻量 service `apps/monitoring-relay/` (Node + express, ~100 行): `POST /webhook/grafana` → Matrix `m.room.message` to ops room; Grafana dashboard JSON (system ops) + Element widget URL 白名单条目 | #4 监控 | relay 单测; dashboard JSON 校验; config 文档 |
| **D_doc** | agora-ts: artifact markdown endpoints (`GET/POST /api/artifacts/:id/markdown`, versioned single-writer); dashboard widget bundle (新 `dashboard/src/widgets/markdown/`, matrix-widget-api 握手, 只读+提交, 静态 build) | #5 协作文档 | artifact 单测; widget tsc |
| **EC_light** | dashboard: 系统运维/公司房间加 Element Call widget 允许 URL 配置 (livekit-or-jitsi URL 占位); `Doc/06-INTEGRATIONS/element-call.md` enablement 文档 | #6 Element Call | 仅 enablement + 文档 |

### Out (hand off)
- Element Call SFU + TURN 实际部署 (verdict P2)
- Widget cockpit W3-W4 完整 (dashboard 侧轻 ops + 全部 approve 跳 Dashboard; 已在 T_center_ui 落地)
- Grafana 完整 dashboard 抛光 + alert 策略 (M_ops 仅 relay + JSON 框架)
- CRDT / HedgeDoc 实时协同 (verdict P1 评估)
- 语音 GPU 显存调度与空闲卸载 (verdict §3 V4)
- agora-ts 自身大改 (SSoT Phase 3 默认不动; 本批严格限定为新端口与 DTO)

## 1. 依赖
- matrix connector 同步分支 (feat/2026-08-31-next-batch) 提供 slash 入口
- 既有 core / db / contracts / server / cli 包
- Radicale (C_calendar): 用户在主仓外起 (docker); adapters-calendar 用 URL + basic auth 接入
- Element Call: 由用户决定 SFU (LiveKit / Jitsi); EC_light 仅提供 widget 配置

## 2. TDD 顺序
1. T_break → T_transfer → T_approve (Core REST, 互依赖: transfer 落 approval; breakdown 独立)
2. C_calendar (adapters + REST + reports)
3. M_ops (relay service + dashboard JSON)
4. D_doc (artifact endpoints + widget scaffold)
5. T_center_ui (Dashboard 页面 + 模态; 依赖 T_break/T_transfer/T_approve 已落)
6. EC_light (文档 + widget config)
7. 全量 `pnpm test` + `pnpm -r typecheck` → commit

## 3. 不破坏的约束
- A1-A8 (Core 解耦 + Human Gate = Dashboard); reviewer/approver 仅 Dashboard session 注入
- SSoT Phase 3: agora-ts 不主动大改; 仅新增端口与 DTO
- Dashboard (D2) 不可被 agent 编排使用 → approval 路由强制 session 校验 (已有, 复用)

## 4. 回写
- `Doc/Agora-实施排期-Agora-TS.md` (本批入 Change Log)
- `Doc/Agora-实施排期-Dashboard.md` (T_center_ui 入 Status)
- `Doc/10-WALKTHROUGH/2026-08-31-next-batch.md`
- 新架构子目录 `Doc/03-ARCHITECTURE/2026-08-31-next-batch/` (T_break/T_transfer/T_approve/C_calendar/M_ops/D_doc/EC_light 各一节, README 索引)

## 5. 步骤追踪
- 见 `progress.md`