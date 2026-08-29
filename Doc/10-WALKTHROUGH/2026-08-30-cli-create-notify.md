# CLI create 通知收口

- 日期: 2026-08-30 | commit: `7dc4d3a` | planning: Doc/09-PLANNING/TASKS/2026-08-30-cli-create-notify/

## 背景
task_created 自动通知原先只挂 server REST 入口；CLI `agora create` 直写共享中央 db 时不写公告行 → CLI 场景无通知（walkthrough 2026-08-30 task_created 留下的 undecided）。

## 方案（最短路径）
- CLI create 成功后按 `im.*.notify_on_task_create` 开关写 `notification_outbox` 行（`notify-<task_id>`，payload: title/creator/project_id）
- **单一扫描者原则**：CLI 只写行不自行推送——推送仍由常驻 server 周期扫描统一执行，避免 CLI/server 双端并发重复投递
- composition root 绑定（apps/cli），core 语义零改动

## 验证
- 测试 2 例：matrix notify_on=true → 有行且 payload 正确；provider=none → 无行
- 回归 1425/1425 + core/barrel 双 gate ✅
- **真实冒烟**：CLI 直连 /root/.agora 中央库 create（OC-1788013181798）→ 14:19:41 写行 → server 14:20:16 扫描标记 delivered（35s）→ 组织房间实测收到 "Task OC-1788013181798 — task_created" ✅

## 边界
独立本机 db 且无常驻 server 的 CLI 场景：公告行 pending、无人扫描（与 REST-only 时代同边界）；有 im 配置却无 server 的拓扑当前不存在于方案 C。
