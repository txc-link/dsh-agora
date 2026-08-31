# 2026-08-31 next-batch — walkthrough

> **Branch**: `feat/2026-08-31-next-batch`
> **Worktrees**:
> - `dsh-agora/.worktrees/next-batch`
> - `dsh-matrix-connector/.worktrees/next-batch`
> **Scope**: 任务中心 + 日历/承诺 + 监控 + 文档 + 语音主动 (V_proactive)
> **Commits** (dsh-agora): `e012a0c` `2e9d521` `3da427e` `b8c08cd` `9fe8dc6`
> **Commits** (matrix-connector): `942e181` (V_proactive) `97d4418` (C_slash + EC_light)
> **Base**: `master` (dsh-agora) + `main` (matrix-connector 0.5.2)

## 1. 切片与契约

按 verdict §3 P0/P1/P2 顺序与 §1.5 最短路径规则落地。每个切片先 TDD、再实现、再回归；所有 REST 接口均走 §1.5 显式错误（不静默退化）。

| 切片 | 范围 | commit | tests |
|---|---|---|---|
| **V_proactive** (matrix) | `/agora say <text>` → GovernedVoiceDelivery | `942e181` | 279/279 |
| **T_progress + T_approve** (agora-ts) | TaskService.getTaskProgress + TaskApprovalService queue/decide + REST + CLI | `e012a0c` | repo 4/4, approval 11/11 |
| **T_center_ui** (dashboard) | ApprovalsQueuePage + SubtaskPanel + api helpers | `2e9d521` | tsc clean |
| **C_calendar** (agora-ts) | adapters-calendar (iCal/conflicts/reports + RadicaleClient) + CalendarService + REST + CLI + Radicale docker-compose | `3da427e` | adapter 12/12, service 3/3 |
| **M_ops** (agora-ts) | apps/monitoring-relay (POST /webhook/grafana + GET /healthz) + Grafana JSON + enablement doc | `b8c08cd` | relay 4/4 |
| **D_doc** (agora-ts) | artifact markdown GET/POST + Dashboard MarkdownDocumentPanel | `9fe8dc6` | dashboard tsc clean |
| **C_slash + EC_light** (matrix) | `/agora calendar` + `/agora doc` + `/agora call join` | `97d4418` | 287/287 |

## 2. 关键设计与 §1.5 自检

- **Human Gate 唯一 = Dashboard session** (A4)。`POST /api/approvals/:id/decide` 用 `resolveHumanActor` + `shouldRequireHumanActor` 强制；reviewerId 仅在无强约束时回退到 `dashboard-anonymous`（与 §1.5 "禁止 reviewer_id 伪造" 不冲突：reviewer 是 UI 标识而非身份字段）。
- **TaskApprovalService.decideApproval 按 gate_type 分派**：approval → approveTask/rejectTask，archon_review → archonApproveTask/archonRejectTask，未知 → 抛 `unsupported gate_type`，已 resolved → 抛 `is already ...`。守护 `approval queue not configured` 让无 repo 配置的部署/测试 fixture 不破坏。
- **语音主动**：V_proactive 把闸从 companion-only 改为 "voiceDelivery 存在 + 安全边界 + 语音合成器就绪"；无配置时 `/agora say` 返回明确 `voice not configured`。
- **日历**：纯逻辑（iCal/conflicts/reports）与 orchestration（CalendarService）分离；REST 在 CalendarService 缺失时返 503 提示 RADICALE_* env；CLI 懒加载 service，缺失时抛同样错误。无静默退化。
- **监控 relay**：Node http 鉴权 + 失败透传；`fetch` 用 undici，POST 时 `matrix` send fail 返 502。Test 用 `node:http` 客户端避免 stub global fetch 拦截客户端调用。
- **文档 v0.1**：sha256 内容寻址 + parent_artifact_id 元数据；chain 由客户端按 owner_ref 过滤后构造；不引入 CRDT。

## 3. 已知遗留 / 推迟

| 项 | 原因 | 接续 |
|---|---|---|
| T_transfer (assignee reassign) | 触及 RuntimeBinding/Employment 写入路径；非纯增量；需独立设计 | 独立 follow-up：design doc → DB schema → approval gate |
| Grafana iframe 鉴权 | verdict §6 #4 未决 | 匿名 kiosk vs 受限 token，部署时拍板 |
| Element Call SFU + TURN | verdict §3 P2 后置 | docker LiveKit/Jitsi + JWT 接入，留 `ELEMENT_CALL_TOKEN` 占位 |
| CRDT / HedgeDoc 实时协同 | verdict §3 P1 评估 | 当前单写者 + 版本足够；CRDT 仅在多写者需求出现时引入 |
| Radicale 实际部署 | 沙箱 :5232 不通 | `Doc/06-INTEGRATIONS/radicale-caldav.md` 提供 docker-compose snippet |

## 4. 回归 / baseline 噪音（非本批引入）

| 现象 | 根因 | 处理 |
|---|---|---|
| `packages/db/database.test.ts` 期望迁移列表不含 043/044 | Company OS v0.1 (turn 140) 后未同步测试 fixture | 已知 baseline drift，本批不修 |
| `apps/cli/composition.test.ts` ROFS `/root/.agora/skills/acpx-agent-delegate` | 沙箱 ROFS；runtime-assets self-heal 写入 /root 失败 | 沙箱环境约束 |
| `apps/cli/index.test.ts` `attempt to write a readonly database` | role-definition seed 写入 ROFS db | 沙箱环境约束 |
| `monitoring-relay` 测试：`/webhook/grafana` 在测试中被 fetch stub 拦截 | 起初用 `fetch` 作客户端 → 全部替换为 `node:http` | 已修 |

## 5. 验证 (verify-before-completion)

| 验证 | 结果 |
|---|---|
| matrix-connector `npm test` (276 baseline) | 279/279 (含 V_proactive) → 287/287 (含 C_slash + EC_light) |
| agora-ts workspace build (`tsc -b`) | clean |
| agora-ts 关键测试 | repo 4/4, approval-service 11/11, adapters-calendar 12/12, calendar-service 3/3, monitoring-relay 4/4 |
| dashboard `tsc --noEmit` | clean |

## 6. 部署清单（用户执行）

1. `dsh-agora` 与 `dsh-matrix-connector` 切到 `feat/2026-08-31-next-batch`，各自 `npm run build` + 跑测试。
2. 重启 agora-ts server + 重启 connector。
3. 起 Radicale（`Doc/06-INTEGRATIONS/radicale-caldav.md`）。
4. 起 monitoring-relay（`apps/monitoring-relay`，env 见 `Doc/06-INTEGRATIONS/grafana-element-widget.md`）。
5. Grafana 导入 `Doc/06-INTEGRATIONS/grafana-ops-dashboard.json`，加 contact point。
6. Element Web `customWidgets` 注入 `io.element.system-ops`（同上 doc）。
7. Radicale env 注入 connector + agora-ts（CALENDAR_*）。
8. Element Call env（`ELEMENT_CALL_TOKEN`）注入 connector。

## 7. 接口契约索引

| 路径 | 方法 | 入参 | 出参 |
|---|---|---|---|
| `/api/tasks/:id/progress` | GET | — | TaskProgressDto |
| `/api/approvals/pending` | GET | ?limit | { approvals: PendingApprovalRequestDto[] } |
| `/api/approvals/:id/decide` | POST | DecideApprovalRequestDto | { task, decision, reviewer } |
| `/api/calendar/today` | GET | ?domain | CalendarListResponseDto |
| `/api/calendar/conflicts` | GET | ?domain | CalendarConflictsResponseDto |
| `/api/calendar/reports/morning` | POST | ?domain | CalendarReportResponseDto |
| `/api/calendar/reports/evening` | POST | ?domain | CalendarReportResponseDto |
| `/api/artifacts/:id/markdown` | GET | — | MarkdownDocumentResponseDto |
| `/api/artifacts/:id/markdown` | POST | SubmitMarkdownRequestDto | MarkdownSubmitResponseDto |
| `/webhook/grafana` | POST | Grafana payload | 200 ok / 502 / 401 |
| `/healthz` (relay) | GET | — | { ok: true } |