# Deploy checklist — 2026-08-31 next-batch (用户执行)

> 配套 walkthrough §6。本文件是用户手动勾选清单，不依赖自动化。
> 按 §1.5 短路径原则：只列真要做的事，不加兜底。

## A. 仓切换 + 构建

- [ ] `cd /home/ailink/dsh-agora && git fetch && git checkout feat/2026-08-31-next-batch`
- [ ] `cd /home/ailink/dsh-matrix-connector && git fetch && git checkout feat/2026-08-31-next-batch`
- [ ] **dsh-agora**: 在 worktree `dsh-agora/.worktrees/next-batch` 内重建 node_modules（参考 findings F8.1）。
- [ ] **dsh-agora**: `npm install` → `npm run build` → `npm test` (workspace 关键测试)
- [ ] **matrix-connector**: `npm install` → `npm test` → `npm run typecheck`

## B. 重启运行时（按部署顺序）

- [ ] agora-ts server 重启（带新 REST 路由 + adapters-calendar/monitoring-relay 不需要 server 启动）
- [ ] connector 重启（带新 verbs：calendar / doc / call / say）
- [ ] Radicale（`Doc/06-INTEGRATIONS/radicale-caldav.md` §Deploy）
  - [ ] `docker compose up -d radicale`
  - [ ] htpasswd bootstrap：`htpasswd -nbB alice 'change-me-now' > radicale-data/users.htpasswd`
  - [ ] auth 切换：`type=htpasswd`（当前配置用 plain；切 htpasswd 必改）
  - [ ] 健康检查：`curl -fsSL http://127.0.0.1:5232/` 返 401
- [ ] monitoring-relay（`Doc/06-INTEGRATIONS/grafana-element-widget.md`）
  - [ ] `cd apps/monitoring-relay && npm install && npm run build`
  - [ ] 配置 MATRIX_HOMES_URL / MATRIX_ACCESS_TOKEN / MATRIX_OPS_ROOM_ID / MATRIX_RELAY_TOKEN（用 `openssl rand -hex 32` 生成 relay token）
  - [ ] `node dist/server.js`（或 systemd）

## C. Grafana

- [ ] 导入 `Doc/06-INTEGRATIONS/grafana-ops-dashboard.json`
- [ ] Contact point: Webhook, URL=`http://127.0.0.1:8089/webhook/grafana`, Authorization=`Bearer ${MATRIX_RELAY_TOKEN}`
- [ ] Alerting rules 启用（verdict 推荐 5 条：agora_rest_down / blocked_task_storm / connector_heartbeat_lost / gpu_memory_critical / media_disk_high）

## D. Element Web

- [ ] `customWidgets` 注入 `io.element.system-ops`（详见 grafana-element-widget.md）
- [ ] 在 ops 房间 `!widget add io.element.system-ops`
- [ ] Grafana dashboard URL = `${grafUrl}/d/agora-system-ops/system-ops?kiosk`（匿名 kiosk token）

## E. 环境变量（注入 agora-ts + connector）

- [ ] `RADICALE_URL=http://127.0.0.1:5232`
- [ ] `RADICALE_USER=alice`
- [ ] `RADICALE_PASSWORD=change-me-now`
- [ ] `RADICALE_WORK_COLLECTION=/alice/work/`
- [ ] `RADICALE_LIFE_COLLECTION=/alice/life/`
- [ ] `RADICALE_TIMEZONE_OFFSET_MINUTES=480`（Asia/Shanghai）
- [ ] `ELEMENT_CALL_WIDGET_URL=https://call.element.io`（或自托管 LiveKit/Jitsi）
- [ ] `ELEMENT_CALL_TOKEN=<LiveKit/Jitsi JWT>`（生产前替换 `LIVEKIT_JWT_PLACEHOLDER`）

## F. 发布 connector npm（用户授权后）

- [ ] `npm login`（用户手动）
- [ ] `npm publish --access public --tag next-batch`（待用户授权 tag / registry）

## G. 端到端冒烟（用户执行，列在 walkthrough §6）

- [ ] Discord/Matrix: `/agora say <text>` 收到 m.audio（需要 homeserver）
- [ ] `/agora calendar morning` 返 markdown（含今天的 events）
- [ ] `/agora doc edit <artifactId> <content>` 返新 artifact id + sha
- [ ] `/agora call join` 房间内出现 widget URL
- [ ] Grafana 触发触发器 → 监控房间出现 m.room.message
- [ ] Dashboard `/approvals` 看到 pending 列表 → 点击 approve 后 task 推进

## H. 推迟项（不动，等用户拍板）

- T_transfer（assignee reassign）→ 见 `Doc/09-PLANNING/TASKS/2026-08-31-next-batch/follow-up-T-transfer-design.md` §9
- Grafana iframe 鉴权 (verdict §6 #4)
- Element Call SFU + TURN 部署 (verdict §3 P2)
- CRDT / HedgeDoc 实时协同 (verdict §3.4 P1)