# Progress — 2026-08-31 next batch (agora-ts + dashboard)

## 状态
- **current phase**: planning 完成 → T_break (next) → T_transfer → T_approve → C_calendar → M_ops → D_doc → T_center_ui → EC_light → verify → 回写
- **last update**: 2026-08-31 step 8

## 步骤
1. ✅ B_pre: 两仓拉取确认同步, worktree 建立, 0.5.2 合入 matrix main
2. ✅ planning: 两仓 batch task_plan / findings / progress 落盘
3. ✅ V_proactive (matrix): /agora say <text> → voiceDelivery.deliver; 279/279 tests green (commit 942e181)
4. ✅ T_progress + T_approve (agora-ts): getTaskProgress + listPendingApprovals + decideApproval + REST + CLI; build clean; 11/11 approval-service + 4/4 repo tests green (commit e012a0c)
5. ✅ T_center_ui: Dashboard ApprovalsQueuePage + SubtaskPanel + api helpers (commit 2e9d521); tsc clean
6. ✅ C_calendar: adapters-calendar (12/12) + CalendarService (3/3) + REST + CLI + Radicale docker-compose snippet (commit 3da427e)
7. ✅ M_ops: apps/monitoring-relay (4/4) + Grafana dashboard JSON + Element widget enablement doc (commit b8c08cd)
8. ✅ D_doc: artifact markdown GET/POST + Dashboard MarkdownDocumentPanel (commit 9fe8dc6)
9. ✅ C_slash + EC_light (matrix): /agora calendar + /agora doc + /agora call join (commit 97d4418); 287/287
10. ✅ verify + SSoT + walkthrough 回写 (commits 7ec216a / c561536 / 1f45918)

## 验证记录
- matrix-connector: 287/287 tests green (276 baseline + 3 V_proactive + 8 C_slash/EC_light); typecheck clean
- agora-ts workspace build clean (tsc -b tsconfig.workspace.build.json)
- agora-ts 关键测试: repo 4/4, approval-service 11/11, adapters-calendar 12/12, calendar-service 3/3, monitoring-relay 4/4
- dashboard tsc --noEmit clean
- SSoT + walkthrough 回写: Doc/Agora-实施排期-Agora-TS.md (新条目), Doc/Agora-实施排期-Dashboard.md (row 8), Doc/10-WALKTHROUGH/2026-08-31-next-batch.md (agora-ts), docs/10-WALKTHROUGH/2026-08-31-next-batch.md (matrix)

## 偏差 / 待决（已落到 walkthrough §3）
- T_transfer (assignee reassign) 推迟到独立 follow-up 设计 (触及 RuntimeBinding/Employment, 非纯增量); 见 walkthrough
- Grafana iframe 鉴权 (verdict §6 #4) + Element Call SFU/TURN 部署 (verdict §3 P2) 留给用户拍板
- Radicale 实际部署需要 docker 起 :5232 (沙箱不可达); 启用方式在 Doc/06-INTEGRATIONS/radicale-caldav.md
- Pre-existing baseline (NOT introduced by this batch): packages/db/database.test.ts asserts migration list lacks 043/044 (Company OS v0.1 drift); apps/cli composition.test.ts ROFS /root/.agora/skills self-heal; apps/cli index.test.ts readonly-database write. None block this batch; logged as environment baseline.