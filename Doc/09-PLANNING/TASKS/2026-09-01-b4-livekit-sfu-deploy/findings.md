# Findings — B4: LiveKit SFU Deployment

**Date**: 2026-09-01 (Asia/Shanghai)

---

## F1. 核心事实：B4 不是 code gap，是 0 代码 + 0 部署

turn 23 报告 `/agora call join` 返回 Element Call 加入链接但占位 token。但深入调查发现：

| 探查点 | 结果 |
|---|---|
| connector `livekit` 引用 | **0** (grep 零结果) |
| plugin `livekit` 引用 | **0** |
| server `livekit` 引用 | **0** |
| live `livekit-server` binary | ❌ not in PATH |
| live LiveKit 端口 7880/7881/7882 | ❌ 无 listen |
| live docker | ✅ `/usr/bin/docker` |

**真相**：connector 完全没有 LiveKit 集成代码，live 也没有 LiveKit 服务。turn 23 的"占位 URL"是 connector 端某个硬编码字符串（可能是 fallback 给 `https://element-call.example.com/?token=PLACEHOLDER`）。**B4 是从 0 开始**。

## F2. 部署 / 代码 / 配置 3 块

详见 task_plan.md §1。

**关键决策点**：
- B4 connector 端**不需要 m.audio 改造**（Element Call 是 hosted service，join URL 已经足够）
- 只需：JWT 生成 + URL 拼接 + matrix.sendText 回 join URL
- 跨仓改动 4 文件（仿 B3 模式）

## F3. LiveKit 部署选项

| 选项 | 难度 | 适合 |
|---|---|---|
| docker `livekit/livekit-server` | 简单（单 container）| v0.1 dev/test |
| `apt install livekit-server` | 中等（systemd + config）| production-like |
| 官方 LiveKit Cloud | 简单但需账号 + API key | 生产 |

**v0.1 推荐**：docker，dev/test 用 devkey。生产 LiveKit Cloud 留 Phase 2+。

## F4. Element Call join URL 模板

`https://app.element.io/#/room/<roomId>?liveKitServiceURL=<livekit-ws-url>&liveKitAccessToken=<jwt>`

或新版格式：
`https://call.element.io/<room-name>?token=<jwt>`

**v0.1 选 Element Web (app.element.io)**：成熟稳定。

## F5. JWT payload

```json
{
  "exp": <unix_ts>,
  "iss": "<api_key>",
  "sub": "<identity_user_id_or_mxid>",
  "room": "<room_name>",
  "video": { "room": "<room_name>", "roomAdmin": false }
}
```

签名：HS256(secret)。node 用 `jsonwebtoken` 包或自己写 HMAC-SHA256。

## F6. 不在本次范围（已确认）

- ❌ LiveKit 录制（v0.1 不需要）
- ❌ LiveKit TURN/STUN（v0.1 dev 内网；生产需 v0.2）
- ❌ LiveKit Cloud（用 docker 自部署）
- ❌ Element Call UI 改造
- ❌ LiveKit metrics / monitoring（v0.2）
- ❌ live server 部署动作（B1-B4 统一执行）

## F7. 拍板待用户决定

**当前 session 已用 ~180 步**。B1-B3 已完整收口（代码 + 文档 + push）。B4 工作量 ~1-2 小时但需要：

1. **live docker 部署**（沙盒内可执行 docker run，但 live 8.136.15.147 端口需要用户授权开放）
2. **LiveKit api_key/api_secret**（live 上要生成或用户提供 dev key）
3. **connector 改造**（仿 B3，~30-45 min）
4. **统一部署**（B1-B4 一起，需用户授权）

**用户必须拍板**：是接受 B4 跳过 / 做 B4 但不部署 / 做 B4 + 统一部署。
