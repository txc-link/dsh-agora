# 02 — dsh-matrix-connector 在组织化 OS 中的位置

## 1. 三层定位（按 §1）

**dsh-matrix-connector = Agora Core 之上的 entry adapter 层新成员**。

```
┌─────────────────────────────────────────────────┐
│ Entry Adapters (上层 IM / Channel)              │
│   Dashboard / Discord / Slack / cc-connect /... │
│   + dsh-matrix-connector (本次新增)              │
└─────────────────────────────────────────────────┘
                        ↑ REST 调用
┌─────────────────────────────────────────────────┐
│ Agora Core (中层 Orchestrator)                  │
│   Citizen / Membership / Team / Attention /     │
│   Coordination / A2A / Context / Brain /        │
│   Federation / RuntimeRegistry / Task /         │
│   Approval / Permission / Inbox / Notification  │
└─────────────────────────────────────────────────┘
                        ↑ Runtime Port
┌─────────────────────────────────────────────────┐
│ Runtime / Craftsman (下层)                      │
│   openclaw / host / craftsman / materialization │
└─────────────────────────────────────────────────┘
```

## 2. 与 cc-connect 的关系

| 维度 | cc-connect | dsh-matrix-connector |
|---|---|---|
| 语言 | Go | TypeScript（DSH 同栈） |
| 部署 | 独立进程（per machine） | 进程内嵌 DSH（per profile） |
| 入口 | Discord / Feishu / Slack / Telegram | Matrix（专一） |
| 在 Core 中的位置 | `CcConnectManagementService` + `IMPorts` | 新增 `MatrixConnectorManagementService`（mirror cc-connect 形态） |
| 与 agora 中央关系 | cc-connect REST + agora 中央 RPC | matrix-js-sdk + agora 中央 RPC |
| 互相替代 | ❌ 不替代 | ❌ 不替代 |
| 共同点 | 都是 Core IM abstraction 的实现 | 同上 |

**结论**：cc-connect 和 dsh-matrix-connector **是 sibling，不是替代**。

## 3. 与 dsh-agora 的关系

dsh-agora = Agora 中央 server 的 **Host adapter**（Node 进程跑 DSH + 调 agora 中央 REST）。

dsh-matrix-connector = **entry adapter**（Matrix IM 与 agora 中央之间的桥）。

```
Element 用户
   ↓ Matrix 协议
matrix-js-sdk
   ↓ (dsh-matrix-connector 内部)
agora 中央 REST API (18008)
   ↓
DSH Agent (ailink-web)
   ↑ task 状态变化 / 结果
agora 中央事件流
   ↑ (dsh-matrix-connector 内部订阅)
matrix-js-sdk editMessage
   ↓
Element 房间（结果可见）
```

**两条独立路径**：
- dsh-agora: DSH 节点 ↔ agora 中央
- dsh-matrix-connector: matrix room ↔ agora 中央

两条路径在 agora 中央**正交交汇**，互不感知。

## 4. 通讯协议边界（§1 红线）

### agora 中央看到的（不变化）

| 字段 | dsh-matrix-connector 怎么用 | agora 中央是否知道 matrix |
|---|---|---|
| threadKey | connector 自己算 `mx_<sha256(roomId).slice(0,16)>` | ❌ 不知道 |
| actor | connector 透传 mxid 原文（`@user:homeserver`） | ❌ 不解析 |
| target | `dsh:node-a:citizen-id` 或 `dsh:node-a:default` | ❌ 不解析 |
| result envelope | connector 传入 `format: 'text' \| 'html' \| 'card.v1'` | ❌ 不解析 |
| dispatch_id | connector 用作 placeholder 关联 | ❌ 不涉及 |

### matrix 中央看到的（不变化）

| 字段 | 是否含 agora 概念 |
|---|---|
| room_id | ❌ agora 看不到 |
| mxc | ❌ agora 看不到 |
| mxid | ❌ agora 看不到 |
| power level | ❌ agora 看不到 |
| threadKey 字符串 | ❌ connector 自己造，matrix 中央不知道 |

**核心约束**：明天把 matrix 换成飞书，agora 中央零改动；明天把 agora 换其他编排器，matrix 中央零改动。

## 5. 仓库与构建位置

**独立 npm 包**：仓名 `dsh-matrix-connector`。

**不在 agora 主仓内**（理由：dsh-agora 是 runtime host adapter，dsh-matrix-connector 是 entry adapter，两者正交不耦合）。但**仓结构 / 构建配置 / 测试标准 / 文档标准与 dsh-agora 一致**。

```
/home/ailink/dsh-matrix-connector/  # 新 git 仓
├── package.json
├── dsh.plugin.json
├── cordis.patch.yml
├── README.md
├── src/
│   ├── index.ts
│   ├── matrix-client.ts          # matrix-js-sdk 封装
│   ├── citizen-bridge.ts         # 调 agora 中央 citizen API
│   ├── task-bridge.ts            # 调 agora 中央 task API
│   ├── attention-bridge.ts       # 调 agora 中央 attention routing API
│   ├── message-router.ts         # 解析 matrix 消息
│   └── config.ts
├── lib/                          # tsc 产物
└── tests/
    ├── matrix-client.test.mjs
    ├── message-router.test.mjs
    ├── citizen-bridge.test.mjs
    ├── task-bridge.test.mjs
    ├── attention-bridge.test.mjs
    └── smoke-matrix.mjs          # 真 Synapse 冒烟
```

## 6. 与 Cordis Plugin SDK 的关系

按 dsh-agora 现有 Cordis 模式：

```yaml
# cordis.patch.yml
- id: matrix-connector
  config:
    homeserverUrl: 'http://8.136.15.147:8008'
    accessToken: '${MATRIX_ACCESS_TOKEN}'
    userId: '@dsh-bridge-node-a:agent-hub.local'
    deviceId: 'DSH-MATRIX-CONNECTOR-NODE-A'
    agoraServerUrl: 'http://127.0.0.1:18008'
    agoraApiToken: '${AGORA_API_TOKEN}'
    allowFrom: '*'
    autoJoin: true
    shareSessionInChannel: false
```

`dsh.plugin.json`：
```json
{
  "id": "dsh-matrix-connector",
  "version": "0.1.0",
  "entry": "lib/index.js",
  "platform": "host"
}
```

## 7. 与 §2 Entry Surface Rules 的关系

| §2 规则 | dsh-matrix-connector 是否遵守 |
|---|---|
| Dashboard 是人类操作入口 | ✅ 保持（matrix 只是另一入口） |
| 人类确认动作只 Dashboard | ✅ matrix 房间不绕过审批 |
| Core 只消费 actor / permission | ✅ agora 中央只看到 opaque actor |
| Agent 默认不通过 Dashboard | ✅ matrix 不强制 |
| 必须人类确认的必须 Dashboard | ✅ matrix 房间能触发但不绕过 |

具体来说：
- matrix 房间能创建 citizen / 派发任务 / 查任务状态（**轻量 create / 轻量 task action**，§2 允许）
- matrix 房间**不能**审批 merge proposal / 不能 fake reviewer_id（**必须 Dashboard 登录态**）

## 8. §1.5 第一性原理验证

| §1.5 要求 | 是否通过 |
|---|---|
| 不允许默认假设用户想清楚 | ✅ 三轮澄清后才动手 |
| 不允许兼容性补丁 | ✅ 干净起步 |
| 不允许过度设计 | ✅ v0.1 最小范围 |
| 不允许扩展到用户未要求 | ✅ voice/卡片/E2EE 全在 v0.1 外 |
| 必须主链路推演完整 | ✅ 见 03-v01-scope.md |