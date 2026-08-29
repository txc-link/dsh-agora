# 部署交接清单 — org-aware-work-os（用户侧待办）

> 2026-08-30 · 代码侧 S1–S6 + Phase 6 全部完成并真机验证（develop `7432de8`）
> 本页是你（部署者）视角的唯一待办清单；每项完成后在对应 checklist 行打勾即可。

## 1. mem0 token ✅ 已解决（2026-08-30）

- 经你授权自建：mem0 admin 下创建 API key `agora-agent`（POST /api-keys 正门），已存 `.secrets/mem0.env`（gitignored）
- adapter 修复：mem0 真实约定 API key 走 `X-API-Key`（Bearer 仅 JWT）→ adapters-mem0 `m0sk_` 前缀自动切换
- 全链验证：`agora experience add` → mem0(:8888, Qwen2.5-0.5B + bge-m3) → `experience search` 语义回查命中
- 注入方式：`source .secrets/mem0.env`（AGORA_MEM0_TOKEN / AGORA_MEM0_URL）

## 2. live server matrix wiring ✅ 已完成（2026-08-30）

- `/root/.agora/agora.json` 已注入 im 段（provider=matrix, node-a 凭据, default_room_id=团队房间; 备份 agora.json.bak-pre-im）
- `agora.service` daemon-reload + restart 生效
- 终验: live db outbox → `POST /api/notifications/scan` → **{delivered:1, failed:0}** → Synapse 房间回读 "Task OC-1787983990771 — craftsman_completed" ✅
- Win/Mac 接入见第 3 节（你手动执行）

## 3. 3 台机拓扑（U5 方案 C）— Linux 侧已全部就绪，你只剩安装

- ✅ 预置完成（2026-08-30）：三台 bot 账号已建好并验证 —— `deploy/node-a.env`（Linux, 在用）、`node-b.env`（预分配 Windows）、`node-c.env`（预分配 Mac, whoami 200）；预填参数在 `.secrets/win-mac-onboarding.env`
- **你要跑的只剩**（每台机, 在各自 DSH 环境）：
  1. Windows: 装 DSH + `dsh-matrix-connector` 插件, 用 node-b.env 凭据
  2. Mac: 同上, 用 node-c.env 凭据
  3. 参考: matrix 仓 `deploy/03-install-dsh-plugin.sh --profile web --homeserver http://8.136.15.147:8008 --agora-url http://8.136.15.147:18008 --agora-token <api_token>`；验证 `deploy/04-verify.sh`
  4. 完成后告诉我 → 04-verify 三机回归 + checklist 收口

## 4. Discord R-G ✅ 已完成（2026-08-30）

- 三台 bot token 已入 `.secrets/discord.env`（gitignored; linux=austin_l 已用, win/mac 备用）
- linux bot → 「Austin的空间」#协作(1542068502012100660) 冒烟: REST 直发 + DiscordIMMessagingAdapter 真机落消息 ✅
- config 参考块: im.discord.bot_token / default_channel_id（如需 server 通道切换 Discord 同样可用）

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
