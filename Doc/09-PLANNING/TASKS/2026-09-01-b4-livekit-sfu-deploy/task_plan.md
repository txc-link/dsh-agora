# Task Plan — B4: LiveKit SFU Deployment (Element Call 真 JWT)

**Date**: 2026-09-01 (Asia/Shanghai)
**Source**: SSoT `Doc/Agora-实施排期-Agora-TS.md` §7 row "v0.1.1 slash command smoke closeout" + Backlog B4 (turn 24 closeout)
**Trigger**: CEO 收件箱实测 `/agora call join` → ⚠️ 返回 Element Call 加入链接但 **占位 token** (turn 23)
**Author**: 总工
**Status**: ⏳ **AWAITING USER DECISION**（B4 真实 scope 跨基础设施 + 跨仓 + 跨包，需拍板）

---

## 0. B4 真实调查结论

### 0.1 调研事实

| 探查 | 结果 |
|---|---|
| live `livekit-server` 二进制 | ❌ not in PATH |
| live `docker` | ✅ `/usr/bin/docker` |
| live LiveKit ports (7880/7881/7882) | ❌ 无 listen |
| probe `127.0.0.1:7880` | ❌ connection refused |
| connector `livekit` 引用 | ❌ grep 零结果（无任何 LiveKit 代码） |
| plugin `livekit` 引用 | ❌ 无 |
| server `livekit` 引用 | ❌ 无 |
| SSoT 关于 LiveKit | ⚠️ turn 23 标注 "可选部署"，turn 26 用户 "挨个做 B1-B4 全做" |

### 0.2 关键事实：B4 **不是 code gap**，是 0 代码 + 0 部署

- turn 23 报告 `/agora call join` 返回**占位 URL**（有 join link 但 token 无效）
- **connector 没有任何 LiveKit 代码** —— connector 没法"已 wire 但占位 token" 因为根本没有 wire
- 必须先**部署 LiveKit + connector 加 LiveKit JWT 生成 + connector 替换 join URL 生成**

## 1. B4 真实 scope（3 个独立大块工作）

### 1.1 In Scope（要做 3 块）

#### A. 基础设施部署（运维）
- `docker run livekit/livekit-server`（或 apt 安装）
- 配置 `config.yaml`：api_key + api_secret + node_ip + port 7880
- 防火墙/网络：1888 (HTTP) + 7881 (TCP/UDP) + 7882 (TURN) 开放
- 验证：浏览器访问 `http://8.136.15.147:7880/` → livekit banner

#### B. connector 跨仓改造（代码）
- 新 `dsh-matrix-connector/src/call/livekit-jwt.ts` —— LiveKit JWT 生成器（HS256，room + identity + ttl）
- `dsh-matrix-connector/src/call/element-call-url.ts` —— 用 livekit URL + jwt 生成 Element Call join URL（替代占位）
- `index.ts` 加 `case 'call'` switch：调 jwt + url 生成器 → matrix.sendText 回 join URL
- `message-router.ts` 加 `call` verb + HELP_TEXT entry

#### C. connector 配置 + deployment
- `MatrixConnectorConfig` 加 `livekitUrl?` + `livekitApiKey?` + `livekitApiSecret?`
- env: `LIVEKIT_URL` `LIVEKIT_API_KEY` `LIVEKIT_API_SECRET`（默认 localhost:7880）
- live 部署 connector 新版本（master 含 B4 commit）

### 1.2 Out of Scope

- ❌ Element Call UI 改造（Element Call 是 hosted service，只用 join URL）
- ❌ LiveKit 录制（v0.1 不需要）
- ❌ LiveKit 多人会议 webhook / 持久化（v0.2+）
- ❌ TURN 服务器部署（生产需 STUN/TURN；v0.1 假设 LAN 或不需要 NAT traversal）

## 2. 部署契约（B4 完成后）

```bash
# 1. live server 部署 LiveKit
docker run -d --name livekit \
  -p 7880:7880 -p 7881:7881 -p 7882:7882/udp \
  -e LIVEKIT_KEYS="devkey: secret" \
  livekit/livekit-server:latest

# 2. 部署 connector 新版本
# env: LIVEKIT_URL=ws://8.136.15.147:7880 LIVEKIT_API_KEY=devkey LIVEKIT_API_SECRET=secret

# 3. /agora call join 返回真 JWT 的 Element Call URL
# 部署后立即可通
```

## 3. 工作量估算（实测）

| 块 | 估计 |
|---|---|
| A. docker 部署 + 配置 + 验证 | 20-30 min（live 上需确认 7880/7881/7882 端口可访问）|
| B. connector 改造（4 文件 + tests） | 30-45 min（仿 B3 模式） |
| C. connector 部署 | 部署动作由 B1-B4 统一执行完成 |
| **总** | **约 1-2 小时**（沙盒内 + live） |

## 4. 风险

- **R1**：live 上 7880/7881/7882 端口可能被防火墙拦截 → 可能需要用户拍板开放
- **R2**：LiveKit JWT 生成用 HS256，需要 dev key + secret 在 connector env 注入（敏感凭据）→ live 部署时用户需提供或同意用 devkey
- **R3**：Element Call join URL 模板可能与 connector 现有占位不兼容 → 需查 Element Call URL schema
- **R4**：live 容器网络（livekit 在 docker 内，connector 在 dsh runtime 内）—— 网络可达性验证
- **R5**：B4 完成后还有"统一部署"动作（用户拍板 turn 26）—— **如果用户已决定先做 B4 然后部署，B4 完成 + 部署**

## 5. 用户拍板选项

### A. 接受 B4 不做（占位 token 现状）
- 当前 `/agora call join` 返占位 URL（click 进去会失败）
- "可选"（turn 23 标注）
- v0.1 跳过 / 推到 v0.2

### B. 做 B4（B + A，最小可能范围）
- A. docker 部署 LiveKit
- B. connector 加 LiveKit JWT + Element Call URL 生成
- 估 1-2 小时（含 live 端口/网络配置）

### C. 做 B4 + 同时统一部署 B1-B4
- 同 B + B1-B4 全部 live 部署
- 估 2-3 小时
- 风险：live 端口/网络可能阻塞

## 6. Backlog

| ID | 触发命令 | 状态 |
|---|---|---|
| **B1** | `/agora calendar today` | ✅ DONE (`d9f5c58`) |
| **B2** | `/agora doc show <id>` | ✅ DONE (code in master) |
| **B3** | `/agora say` | ✅ DONE (`69c2387`) |
| **B4** | `/agora call join` | ⏳ **AWAITING USER DECISION** |
