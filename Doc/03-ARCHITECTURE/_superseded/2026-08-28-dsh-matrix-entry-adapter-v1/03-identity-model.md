# 身份模型 — mxid 在 connector 内部

## 核心约束

**mxid（matrix user id）永远不进入 agora 中央**。

agora 中央的事件流里：
- `actor` = 不透明字符串 = `'<mxid>:<homeserver>'` 原文
- agora 中央**不解析**这个字符串
- agora 中央**不验证**这个字符串
- agora 中央**不映射**这个字符串到任何内部 user 表

## 三个身份域

```
┌─────────────────────────────┐
│ Matrix 中央                 │
│   identity = mxid           │
│   '@user:homeserver'        │
│   auth = access_token       │
└─────────────────────────────┘
         │ (connector 私有映射)
         ▼
┌─────────────────────────────┐
│ dsh-matrix-connector 内部   │
│   identity_table (sqlite?)  │
│   mxid → display_name       │
│   mxid → permission_level?  │
└─────────────────────────────┘
         │ (opaque actor 字符串)
         ▼
┌─────────────────────────────┐
│ Agora 中央                  │
│   identity = opaque actor   │
│   '@user:homeserver' 原文   │
│   agora 不解析               │
└─────────────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ DSH Agent                   │
│   identity = opaque actor   │
│   可在 prompt 里看到 actor  │
│   可选择性映射到 DSH session │
└─────────────────────────────┘
```

## 验证 / 鉴权流

### 入站消息鉴权
```
Element 用户发消息
  1. matrix 中央鉴权：用户带 access_token → matrix 中央验证 OK → /sync 推送事件
  2. dsh-matrix-connector 收到事件 → 读 mxid
  3. connector 内部白名单匹配（allowFrom 配置）：
     - '*' = 全部接受
     - '@user1:homeserver,@user2:homeserver' = 白名单
     - '@*:homeserver' = 通配 homeserver
  4. 接受 → 进入 message-router
  5. 拒绝 → 静默丢弃（不上报）
```

### agora 中央鉴权
```
agora 中央用 Bearer AGORA_API_TOKEN
  - 来自 agora 中央的 `~/.agora/agora.json` `api_auth.token`
  - 同一 token 分发给所有 DSH 节点
  - dsh-matrix-connector 用同一 token 调 /api/dispatch
```

### matrix 中央鉴权
```
dsh-matrix-connector 用 bot 的 access_token
  - 来自 Synapse admin 手动开（provision-bot 流程，06-provision-bot.md）
  - 每个 DSH 节点 = 一个独立 bot
  - token 失效 → connector 启动 fail-fast，不自动续期
```

## 权限 / 角色（v0.1 不做）

v0.1 范围内：
- ❌ 不做 mxid ↔ agora role 映射
- ❌ 不做房间级权限（admin / moderator）
- ❌ 不做 dispatch target 鉴权（依赖 agora 中央的 RBAC）

v1.0 评估：
- ⏳ mxid → agora role 映射（如果"组织化"真的要在 v1.0 做）

## §1 红线验证

| 要求 | 通过情况 |
|---|---|
| agora 中央无 mxid 字面字段 | ✅ |
| agora 中央无 matrix_room_id 字面字段 | ✅ |
| provider-specific 数据只能在 adapter | ✅ mxid 只在 connector |
| core 不知 IM 存在 | ✅ |

## 反模式（必须避免）

- ❌ agora 中央建 `mxid_mappings` 表
- ❌ agora 中央事件流加 `matrix_power_level` 字段
- ❌ dsh-matrix-connector 在 prompt 里把 mxid 解析成 display name 后再发给 agora
- ❌ DSH Agent 用 mxid 反查 agora user table
