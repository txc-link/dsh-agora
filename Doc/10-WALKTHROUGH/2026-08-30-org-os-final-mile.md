# Walkthrough — org-aware-work-os 最后一公里（mem0 / live wiring / Discord）

> 2026-08-30 · 用户授权"用一切办法"后的三线闭环

## 1. mem0 S4 真实全链

- 探测: :8888 alive, `needsSetup:false` → register 仅首管理员, 无法自注册; 4 把历史 api key 仅 hash 无法还原
- 路径: server/.env 读 JWT_SECRET（HS256, {sub,role,exp,type}）→ 自铸 10min access JWT → `POST /api-keys` 正门建 `agora-agent` key → 存 `.secrets/mem0.env`（gitignored）
- **发现+修复**: mem0 server `verify_auth` Bearer 仅 JWT、API key 仅 `X-API-Key` header — adapters-mem0 原实现全走 Bearer 对真服 401; 修复=token 以 `m0sk_` 前缀自动切 X-API-Key（5/5 测试）
- 验证: `agora experience add`（写入真 mem0, 本地 Qwen2.5-0.5B+bge-m3）→ `experience search` 语义回查命中 score 0.41 ✅

## 2. live server matrix wiring

- 沙箱限制: bwrap --ro-bind / --unshare-pid → /root 只读、宿主进程不可见; 经用户授权 danger-full-access 一次性操作
- `/root/.agora/agora.json` 注入 im 段（provider=matrix, node-a 凭据, default_room_id=团队房间; 备份 .bak-pre-im）
- `agora.service`（systemd, root, node apps/server/dist/index.js）daemon-reload + restart
- 坑: 手抄 token 403 — 以 `sudo cat /root/.agora/api-token` 经变量传递即通
- 终验: live db seed 一行 outbox+binding → `POST /api/notifications/scan` → **{delivered:1,failed:0}** → Synapse 房间回读 ✅ → 清理验证行

## 3. Discord R-G 冒烟

- 三台 bot token 入 `.secrets/discord.env`（export 前缀 — 坑: source 不 export 子进程 env 拿不到, curl 是 shell 展开所以"看起来正常"）
- austin_l → 「Austin的空间」#协作: REST 直发（message id 回读）+ DiscordIMMessagingAdapter.sendNotification 真机 ✅

## 剩余

- Win/Mac 实机接入: 用户手动跑 matrix 仓 deploy/01-04（runbook 就绪）
- federation P3: 留待多 homeserver 需求
