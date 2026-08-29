# 部署交接清单 — org-aware-work-os（用户侧待办）

> 2026-08-30 · 代码侧 S1–S6 + Phase 6 全部完成并真机验证（develop `7432de8`）
> 本页是你（部署者）视角的唯一待办清单；每项完成后在对应 checklist 行打勾即可。

## 1. mem0 token（解锁 S4 真实全链）

- 你侧：mem0 dashboard 建 API key
- 我侧待验证链路：`agora experience add/query` → Mem0RestAdapter → :8888 → postgres
- 配置注入：`AGORA_MEM0_TOKEN=<key>`（server/cli env 或 `.env`）

## 2. live server 接入 matrix 通道（解锁 S5/S3 真实推送）

当前 live server（http://127.0.0.1:18008）`im={}` → 通知落 Stub。接入只需改 `/root/.agora/agora.json`（我无 /root 写权限）：

```json
"im": {
  "provider": "matrix",
  "matrix": {
    "homeserver_url": "http://localhost:8008",
    "access_token": "<deploy/node-a.env 的 MATRIX_ACCESS_TOKEN>",
    "user_id": "@dsh-bridge-node-a:agent-hub.local",
    "default_room_id": "<团队房间 !…:agent-hub.local>",
    "room_by_ref": { "agent:dl": "!dev-room:agent-hub.local" },
    "notify_on_task_create": true
  }
}
```

改完重启 server。E2E 验证方法（已完成同等冒烟，参考 `Doc/10-WALKTHROUGH/2026-08-30-phase6-e2e-obsidian.md`）：outbox 塞一行 → `POST /api/notifications/scan` → 房间回读。

## 3. 3 台机拓扑（U5 已默认方案 C）

- Linux home server（本机）：agora server :18008 + mem0 :8888 + Synapse :8008 —— 已就绪
- Win / Mac：装 DSH + dsh-matrix-connector，接入 Synapse；runbook = matrix 仓 `deploy/01-deploy-core.sh` → `02-provision-bots.sh` → `03-install-dsh-plugin.sh` → `04-verify.sh`
- 每台机 bridge 凭据：参照 `deploy/node-a.env` 生成 node-b/c.env（02 脚本自动）

## 4. Discord 环境（解锁积压 R-G 冒烟）

- 需 Discord bot token + 默认频道（config `im.provider='discord'` + `im.discord.bot_token/default_channel_id`）
- 提供后我可复用 matrix 通道同款冒烟链路（task → outbox → scan → Discord 频道回读）

## 5. 无需你的项（状态备忘）

| 项 | 状态 |
|---|---|
| federation P3（自动团队组建） | 设计未实现；依赖多 homeserver 环境（等你第二台机 Synapse 联邦后） |
| E2EE | 已决定 disabled by default（turn 118）；加密房间为后续增强 |
| obsidian 沉淀 | 已交付 `agora forum export --vault`；你侧只需指 vault 路径即可出笔记 |

## 回归与门禁基线（交接时点）

- agora-ts：packages+server **1239/1239**；apps/cli **172/172**；build clean；双 gate 过
- matrix 仓：smoke-real-homeserver PASS（Synapse :8008）
- 真机验证：matrix 发送/回读 ✅ · server 全链 dispatcher→matrix ✅ · obsidian 导出 ✅
