# task_created 自动通知链路补全

- 日期: 2026-08-30
- 分支: `feat/task-create-notify` → develop `9c37655`（worktree: .dsh/workspaces/task-notify, 已清理）
- 背景: Phase 6 E2E 收尾时发现 `im.*.notify_on_task_create` 在 config schema 有声明（default true），但 server 端**没有任何消费者**——"建任务自动通知房间"的真实用户路径从未工作过，此前所有推送都是手动 seed outbox + 手动 POST /api/notifications/scan。

## 发现的两个 gap

1. **无消费者**: config 字段声明了意图，server composition/app 没接。
2. **无周期扫描**: outbox 只能手动 POST scan 触发；dispatcher 对无 binding 的通知一律 `resolveTarget→null→markDelivered` 静默丢弃，而 task_created 天然无 binding（binding 是建任务后才由 provisioning 建立）。

## 实现（最短路径, 三环）

| 环 | 位置 | 内容 |
|---|---|---|
| ① 兜底目标 | `packages/core/notification-dispatcher.ts` | options 加 `defaultTargetRef`；resolveTarget 无 binding 时回退（平台无关, Core Constitution ✅） |
| ② composition | `apps/server/composition.ts` | 按 provider 解析默认目标: matrix→`im.matrix.default_room_id`, discord→`im.discord.default_channel_id` |
| ③ 触发 | `apps/server/app.ts` + `runtime.ts` + `index.ts` | REST create 成功后写 `task_created` outbox 行（`notify-<task_id>`, target_binding_id=null, payload 含 title/creator/project_id, 失败不阻塞建任务）；scheduler 周期 tick 旁路 fire-and-forget `dispatcher.scan()`（沿用 scheduler.scan_interval_sec=60s, 不新增平行配置） |

开关: `im.matrix.notify_on_task_create` / `im.discord.notify_on_task_create`（index.ts 组装 taskCreatedNotify.enabled, 测试 stub 的 runtime.config 缺失时 optional-chain 安全为 false）。

## TDD 与回归

- 新测试: dispatcher defaultTargetRef 兜底/跳过 2 例（packages/core）
- 全量: 225 文件 **1418/1418** ✅ + core-architecture / barrel-governance 双 gate ✅
- 波及修复: ObservationSchedulerTickResult 曾尝试把 notifications 并入 tick result → async tick 破坏 fake-timers 语义（runtime.test 3 例红）→ 回退同步 tick + 独立异步旁路。

## 真实冒烟

1. **隔离实例**（HOME=临时目录, scan_interval_sec=5, node-a matrix 凭据）: REST create → 7s 内房间回读 `Task OC-1788010370266 — task_created` ✅
2. **live 现网**: rebuild → `sudo systemctl restart agora.service` → 生产 token REST create `OC-1788010645691` → 45s 自动送达 Synapse `!uFTXBPVMUCSBCakAxi` ✅

## 教训

- **dist 不随 git**: merge 后主仓必须 `npm run build` 再重启 live——首次 live 冒烟 65s 无消息，outbox 表空，根因是 live 跑的还是旧 dist（与此前 wrapper SyntaxError 同根因, 再次确认）。
- bash 工具 `cmd &` 子进程随 job shell 退出被杀: 常驻进程用 `run_in_background: true` + `exec`。
- bwrap pid 隔离下 systemctl 连不上真 pid1: 重启 systemd 服务需 danger-full-access 全权限执行。

## 未决（undecided）

- **CLI 直写本地 db 的 create 不触发 server 通知**: CLI 进程内没有 dispatcher/扫描者；通知挂 REST（server 常驻才有意义）。agent 主入口是 CLI 的场景下，若 CLI 与 server 共享中央 db，可由 server 周期扫描兜底（后续若需要再设计, 不做超前开发）。
- 通知 body 目前是最小 payload（title/creator/project_id），展示格式由 MatrixIMMessagingAdapter 现有规则渲染（`Task <id> — task_created`）。
