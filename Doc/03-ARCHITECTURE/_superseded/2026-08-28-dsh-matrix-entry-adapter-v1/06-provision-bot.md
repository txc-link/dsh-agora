# provision-bot 流程 — 新 DSH 节点接入必备

## 背景

Synapse 中央 `register` 已关闭（实测 403），新 DSH 节点**无法**通过普通 register 流程创建 bot 账号。

必须由 homeserver admin 通过 **server admin API** 创建。

## 流程

### 前置

admin 需要：
1. homeserver 管理员 access_token
2. 新节点的 nodeId（用于生成 mxid 和 device_id）
3. 新节点的 displayName（可选）

### 命令（草案）

```bash
# 在 admin 机器上跑
HOMESERVER=https://8.136.15.147:8008
ADMIN_TOKEN=<homeserver-admin-access-token>
NODE_ID=node-a

# 1. 注册新 bot 用户
curl -X POST "$HOMESERVER/_synapse/admin/v1/register" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"type\": \"m.login.application_service\",
    \"username\": \"dsh-bridge-$NODE_ID\"
  }"

# 期望响应：{ user_id, access_token, device_id, home_server }
# user_id 形如 @dsh-bridge-node-a:agent-hub.local
# access_token = syt_xxx_xxx（这就是 bot token）

# 2. 设置 display name（可选）
curl -X PUT "$HOMESERVER/_matrix/client/v3/profile/@dsh-bridge-$NODE_ID:agent-hub.local/displayname" \
  -H "Authorization: Bearer $BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "displayname": "DSH Bridge (Node A)" }'

# 3. 输出 connector 配置
echo "在 dsh-matrix-connector cordis.patch.yml 里填："
echo "  homeserverUrl: '$HOMESERVER'"
echo "  userId: '@dsh-bridge-$NODE_ID:agent-hub.local'"
echo "  accessToken: '$BOT_TOKEN'"
echo "  deviceId: 'DSH-MATRIX-CONNECTOR-$NODE_ID'"
```

### provision-bot.sh 脚本接口

```bash
./provision-bot.sh \
  --homeserver https://8.136.15.147:8008 \
  --admin-token <admin-token> \
  --node-id node-a \
  --display-name "DSH Bridge (Node A)" \
  --output /home/ailink/.dsh/profiles/web/matrix-connector.env
```

输出：env 文件含 `MATRIX_HOMESERVER_URL`, `MATRIX_USER_ID`, `MATRIX_ACCESS_TOKEN`, `MATRIX_DEVICE_ID`，cordis.patch.yml 用 env 占位符引用。

## 失败处理

| 失败模式 | 处理 |
|---|---|
| admin_token 失效 | 脚本 exit 1 + 明示 "admin token 无效" |
| username 冲突 | 脚本 exit 2 + 明示 "node_id 已存在，请换 id" |
| homeserver 不可达 | 脚本 exit 3 + 明示 "网络 / DNS 失败" |
| register 接口不存在 | 脚本 exit 4 + 明示 "Synapse 版本不支持 admin register"（v1.x 老版本可能） |

## 安全

- **admin token 不可写入配置文件 / 仓库**
- 脚本运行完立即丢弃 admin token（不写到磁盘 / env 文件）
- bot access_token 通过 stdin 管道传给 dsh-matrix-connector 配置流程
- bot token 仅由 DSH nodeId 持有，不共享

## v0.1 范围

v0.1 只做 **provision-bot.sh + 单测 + README 步骤**。
**不**做：
- 自动调度（admin 手动跑）
- 自动 rotate
- 自动 cleanup
- bot 配额管理

## v0.2 评估

如果将来节点数 ≥ 10，provision-bot 应：
- 支持批量开号（CSV input）
- 集成 homeserver 用户管理 API
- 自动写入 dsh 节点的 cordis 配置
