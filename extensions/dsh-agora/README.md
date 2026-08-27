# dsh-agora

`dsh-agora` 是 Agora 的 DSH 原生适配器和运行时节点连接器。Agora Server/SQLite 继续持有任务、流程、审批、节点租约、派发队列和 Session 绑定的唯一真相；插件负责把每个 DeepSeek Harness 暴露成可派发节点，并可通过版本化 dsh-im 桥把结果送回 Discord。

## 部署拓扑

一套协同网络只部署一个中央 Agora Server，参与执行的每个 DeepSeek Harness 安装一个轻量 `dsh-agora`。只有需要实际登录 Discord/Telegram 等机器人的节点才安装 dsh-im：

```text
Discord 用户
   │
   ▼
dsh-im + dsh-agora（节点 A） ─┐
                              ├─ Agora Server + SQLite ─ durable dispatch
dsh-agora（无机器人节点 B） ──┤
dsh-im + dsh-agora（节点 C） ─┘
```

机器人之间不直接读取彼此消息，也不依赖 Discord 的 bot-to-bot 触发。源 Agent 把工作写入中央派发队列，目标节点以租约方式 claim，恢复或创建自己的 DSH Session，完成后由目标节点选定的机器人主动发回原 Discord thread。这样避免 Discord 默认忽略 bot 消息造成的循环、丢消息和重复执行。

## 安装

在仓库根目录先构建插件：

```bash
cd extensions/dsh-agora
npm install
npm test
dsh plugin --profile web add /home/ailink/dsh-agora/extensions/dsh-agora
```

默认连接 `http://127.0.0.1:18420`。可以编辑 profile 中 Agora 插件的配置，或在启动 DSH 前设置：

```bash
export AGORA_SERVER_URL=http://127.0.0.1:18420
export AGORA_API_TOKEN=replace-if-agora-requires-a-bearer-token
export DSH_AGORA_API_TOKEN=replace-to-allow-non-loopback-host-api-calls
```

不要把 token 写进 Git。`AGORA_API_TOKEN` 用于插件访问 Agora；`DSH_AGORA_API_TOKEN` 用于保护插件自己的 `/dsh-agora/api/*`。插件 API 在没有后者时只接受 loopback 请求。

每个节点需要稳定且唯一的 `nodeId`。推荐配置显式的 Agent 清单：

```yaml
- insert:
    - id: agora
      name: dsh-agora
      config:
        serverUrl: http://127.0.0.1:18420
        nodeEnabled: true
        nodeId: ailink-web
        maxConcurrent: 2
        runtimeAgents:
          - id: default
            displayName: Ailink General Agent
            workspace: /home/ailink
            roles: [general]
            capabilities: [research, coding]
```

其他服务器把 `serverUrl` 改成中央 Agora 地址，并使用不同 `nodeId`。`nodeId` 不应随重启变化；插件实例 ID 会在进程重启后变化，用来防止旧进程错误完成新进程 claim 的任务。

## 命令

```text
/agora health
/agora nodes
/agora agents
/agora list --state active
/agora show OC-123
/agora status OC-123
/agora create --type implementation --priority high "实现 DSH 适配器"
/agora dashboard
/agora im
```

插件故意不提供 `/agora approve` 或 `/agora reject`。人类审批必须经过 Agora 已认证并可审计的入口。

Agent 还可使用全局 `agora_task` 工具执行 `dispatch`、`dispatch_status` 和 `attach_session`。运行时目标格式是 `dsh:<nodeId>:<agentRef>`。派发必须携带稳定的 `idempotency_key`；重复请求只会得到原派发，不会重复执行。

## Session 连续性

连续性分三层保存：

- dsh-im 记录 Discord conversation/thread 到本机 DSH Session 的绑定。
- Agora 保存 task participant 到目标 runtime Session 的持久绑定。
- 派发记录保存目标节点、Agent、Session、结果和错误；claim 有过期租约，进程异常退出后任务可重新领取。

`attach_session` 可以把已有 Session 导入某个任务参与者，而不复制聊天历史。后续 dispatch 传入该 `session_id` 就会继续原上下文。重启 Discord Gateway、dsh-im、dsh-agora 或某个 Harness 节点不会丢失中央任务/派发/参与者绑定；节点重新心跳后恢复接单。

## dsh-im 协作

默认主通路仍保持解耦：dsh-im 把 IM 消息交给 DSH Session，Agent 在同一 Session 内调用全局 `agora_task`，普通结果照常返回 IM。用户可直接说“让 `dsh:node-b:reviewer` 审查这个任务并把结果发回本 thread”。dsh-agora 不保存 Discord token，也不创建 Gateway 连接。

`agora_task` 支持 `health`、`nodes`、`agents`、`list`、`show`、`status`、`create`、`dispatch`、`dispatch_status` 和 `attach_session`；不支持审批/驳回。

## DSH Web 界面

0.3.0 起插件会向 `dsh-better-sidebar` 注册“Agora 协同”页签。界面包含：

- 总览：中央服务、本机节点、dsh-im 桥、节点/Agent/Bot 数量和执行容量；
- 节点：每个 Harness 的心跳、Agent、能力标签、Bot 与在线状态；
- 任务：创建和查看中央 Agora 中的持久协作任务；
- 派发：选择运行目标、创建或续接 DSH Session，并查询本页派发状态。

界面只访问同源 `/dsh-agora/api`，Agora API Token 和 Discord Bot Token 始终留在 Host 进程。派发默认使用 `silent`，只有用户明确选择“由目标 Bot 回帖”时才请求主动呈现。没有安装 `dsh-better-sidebar` 时 Host、工具、API 与节点 Worker 仍正常运行，仅不显示侧边栏页签。

插件会发现 `dshImCommandGateway` 或 `dshImGateway` 服务，并要求协议：

```text
dsh-im.command-gateway/v1
```

这个网关只是增强项。存在时，IM 中的确定性 `/agora create` 会把 provider、conversation/thread ref 和 actor 一并传给 Agora 的 `im_target`，避免复制 IM 连接、去重、线程绑定和权限逻辑。

为异步主动推送和源 Session 路由，本部署给 dsh-im 2.1.0 应用了可重放的 pnpm patch，发布只读服务：

```text
dsh-im.bridge/v1
```

它只暴露安全的 bot identity/在线能力、`Session → provider/bot/conversation/thread` 路由，以及带幂等键的主动发送；不会暴露 bot token。dsh-agora 通过可选 Cordis 注入跟随服务的加载与热重载，并保留周期发现作为兼容路径，因此两个插件无论启动顺序如何都能自动接入。未安装 dsh-im 时可选子依赖只保持等待，任务协调、节点心跳和自然语言工具调用仍可用，只是无法自动选择 Discord bot 主动回帖。

## 插件的插件

第三方插件可以导入 `dsh-agora/sdk` 并注册 `dsh-agora.extension/v1` 扩展。当前内置 `runtime` 扩展实现 Agent 描述、Session 创建/恢复和 prompt 执行；后续 provider、策略、观察器可沿相同注册表扩展，不需要依赖 dsh-im 私有实现。

## 宿主 API

`POST /dsh-agora/api/{snapshot,health,nodes,agents,tasks,task,status,create,dispatch,dispatch-status,attach-session,command}` 返回统一 JSON envelope。它是给管理面板和其他本地适配器使用的薄代理，不保存 Agora 领域状态。

## 开发验证

```bash
npm run typecheck
npm test
npm pack --dry-run
```
