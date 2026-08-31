# Findings — 2026-08-31 next batch (agora-ts + dashboard)

## F1. agora-ts 现状
- Core 已具备 Task / Context / Participant / RuntimeBinding / Execution / Event / Notification
- REST(18008) + CLI + Dashboard; pause/resume/cancel/unblock 在 0.4.0 已落地 (turn 117)
- contracts (zod) 是前后端事实单一源 (D4); 新增 DTO 必须先扩 contracts
- 0.4.0 已部署 pause/resume/cancel/unblock + reassign action; approval 显式留给 Dashboard (A4)

## F2. 缺口拆解 → 切片
- 任务中心缺口 (用户 #1) = ① 拆解 (subtasks) ② 进度 (progress view) ③ 转派 (transfer 走 approval) ④ 审批 (Dashboard Human Gate)
- **既有覆盖** (F2.1): `POST/GET /api/tasks/:id/subtasks` + `completeSubtask|archiveSubtask|cancelSubtask` + `approve|reject|archon-approve|archon-reject` + pause/resume/cancel/unblock (0.4.0) + `approval_requests` 表 + ApprovalRequestRepo + TaskApprovalService
- **真实缺口** (F2.2): ① 全局 `GET /api/approvals/pending` 队列 (repo 只有 `listByTask` / `getLatestPending`) ② `POST /api/approvals/:id/decide` 统一入口 (TaskApprovalService 有 approveTask 但缺通用 decide by approval_id) ③ 任务进度聚合 `GET /api/tasks/:id/progress` (无 aggregate) ⑤ assignee transfer (触及 RuntimeBinding/Employment, 非纯增量 → follow-up) ⑥ CLI `task breakdown|subtasks|transfer|progress|approvals` ⑦ Dashboard 审批队列页 + SubtaskPanel + TransferReview
- 拆解 = 子任务 CRUD (已有) + CLI 补齐 + UI 展示; 进度 = 聚合子任务 + 父状态 (新 endpoint); 审批 = 全局队列 + decide 入口 (新 endpoints)

## F3. 日历/承诺缺口 (用户 #3)
- 服务器现状: Radicale 未起 (:5232 不通)
- 裁决 §3: Radicale + work/life collection 隔离; Human Gate 走 Dashboard
- Agora commitment 为主账, CalDAV 是投影; 反向 CalDAV → commitment 由 user 手动确认
- morning report = today 工作/生活事件 + 即将到期 commitment; evening = 今日完成 + 明日预告 + 冲突

## F4. 监控缺口 (用户 #4)
- Grafana :3001 已在跑; 告警 webhook 接 relay
- relay = 小 HTTP 服务 (POST /webhook/grafana), 鉴权用 shared secret, 转 Matrix m.room.message
- Element widget URL 白名单加 system-ops dashboard URL; 匿名 iframe 用 token embed

## F5. 协作文档缺口 (用户 #5)
- 现在只有读 (artifact preview); v0.1 = 只读 + 提交 (单写者 + 版本号, 符合裁决 §4 v0.1)
- artifact markdown 是 SHA-256 内容寻址, POST 新 version = 新 content_hash + parent_hash
- widget bundle 走 Vite library mode, 静态托管, 房间 widget URL 注册

## F6. Element Call 缺口 (用户 #6)
- 裁决 P2 后置; 本批严格仅 enablement
- Element Web v1.12 已内置 Element Call widget; MSC3401/3898 状态事件 + LiveKit/Jitsi SFU
- LiveKit 与 TURN 部署由用户决定; 本批给配置文档 + dashboard widget URL

## F7. 与 SSoT 的关系
- `Doc/Agora-实施排期-Agora-TS.md` Phase 3 原则维持; 本批按 §6 例外流程 (REST/数据模型新增, 非 Core 语义大改)
- Dashboard SSoT 新增 T_center_ui (Dashboard 现有 thread 详情 + 审批页 + 转派模态)
- 所有新包 (adapters-calendar) 仍属 adapter 层, 不进 core