# Progress — 2026-08-31 next batch (agora-ts + dashboard)

## 状态
- **current phase**: planning 完成 → T_break (next) → T_transfer → T_approve → C_calendar → M_ops → D_doc → T_center_ui → EC_light → verify → 回写
- **last update**: 2026-08-31 step 8

## 步骤
1. ✅ B_pre: 两仓拉取确认同步, worktree 建立, 0.5.2 合入 matrix main
2. ✅ planning: 两仓 batch task_plan / findings / progress 落盘
3. ⏳ T_break: POST /api/tasks/:id/subtasks + CLI + 聚合
4. ⏳ T_transfer: POST /api/tasks/:id/transfer (approval 中介)
5. ⏳ T_approve: GET /api/approvals/pending + decide (Dashboard session 强制)
6. ⏳ C_calendar: adapters-calendar 包 + Radicale 接入 + today/conflicts/reports
7. ⏳ M_ops: monitoring-relay + Grafana dashboard JSON + Element widget 配置
8. ⏳ D_doc: artifact markdown endpoints + dashboard widget scaffold
9. ⏳ T_center_ui: 审批队列页 + TransferReview 模态 + SubtaskPanel
10. ⏳ EC_light: Element Call enablement 文档 + widget config
11. ⏳ verify + SSoT + walkthrough 回写

## 验证记录
- (待开始)

## 偏差 / 待决
- (无)