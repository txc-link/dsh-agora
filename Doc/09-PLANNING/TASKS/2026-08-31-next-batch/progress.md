# Progress — 2026-08-31 next batch (agora-ts + dashboard)

## 状态
- **current phase**: planning 完成 → T_break (next) → T_transfer → T_approve → C_calendar → M_ops → D_doc → T_center_ui → EC_light → verify → 回写
- **last update**: 2026-08-31 step 8

## 步骤
1. ✅ B_pre: 两仓拉取确认同步, worktree 建立, 0.5.2 合入 matrix main
2. ✅ planning: 两仓 batch task_plan / findings / progress 落盘
3. ✅ V_proactive (matrix): /agora say <text> → voiceDelivery.deliver; 279/279 tests green (commit 942e181)
4. ✅ T_progress + T_approve (agora-ts): getTaskProgress + listPendingApprovals + decideApproval + REST + CLI; build clean; 11/11 approval-service + 4/4 repo tests green (commit e012a0c)
5. ⏳ T_center_ui: Dashboard 审批队列页 + SubtaskPanel
6. ⏳ C_calendar: adapters-calendar 包 + Radicale 接入 + today/conflicts/reports
7. ⏳ M_ops: monitoring-relay + Grafana dashboard JSON + Element widget 配置
8. ⏳ D_doc: artifact markdown endpoints + dashboard widget scaffold
9. ⏳ C_slash: connector calendar/doc/call verb
10. ⏳ EC_light: Element Call enablement 文档 + widget config
11. ⏳ verify + SSoT + walkthrough 回写

## 验证记录
- 2026-08-31: matrix V_proactive commit 942e181 (279/279); agora-ts T_progress+T_approve commit e012a0c (workspace build clean, approval-service 11/11, repo 4/4)
- Pre-existing baseline (NOT introduced by this batch): packages/db/database.test.ts asserts migration list lacks 043/044 (Company OS v0.1 drift); apps/cli composition.test.ts ROFS /root/.agora/skills self-heal; apps/cli index.test.ts readonly-database write. None block this batch; logged as environment baseline.

## 偏差 / 待决
- T_transfer (assignee reassign) 推迟到独立 follow-up 设计 (触及 RuntimeBinding/Employment, 非纯增量); 见 task_plan §0 T_transfer
- Grafana iframe 鉴权 / Element Call SFU 部署 留给用户拍板 (verdict §6 未决事项)