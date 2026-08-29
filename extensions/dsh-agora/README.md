# dsh-agora

> **npm 分发名：`dsh-agora-plugin`**（本插件的安装包名）。npm 上的裸名 `dsh-agora` 被 AgoraIO-Community 的 RTC skill 包占用，与本项目无关；安装请使用 `dsh plugin add dsh-agora-plugin`。插件运行身份（dsh.plugin.json id）保持 `dsh-agora` 不变。

`dsh-agora` 是 Agora 的 DeepSeek Harness（DSH）原生适配器。它把每个 DSH 实例注册成可派发的运行时节点，同时保持以下边界：

- Agora Server 是任务、流程、审批、节点租约、派发队列和 Session 绑定的唯一事实来源；
- DSH 继续负责模型、Agent、Session 和工具执行；
- dsh-im 继续负责 Discord/Telegram 等 IM 连接，`dsh-agora` 不保存 Bot Token，也不创建第二条 Gateway 连接；
- 具体 IM 和 DSH 实现都只是 adapter，不进入 Agora Core。

本文档从空白环境开始，给出一套可复制的中央服务器、多节点、Web 界面和 Discord 配置流程。

## 部署拓扑

一套协同网络只需要一个中央 Agora Server。每个参与执行的 DSH 安装一个 `dsh-agora`；只有需要登录 IM Bot 的节点才安装 dsh-im：

```text
Discord 用户
   │
   ▼
dsh-im + dsh-agora（节点 A） ─┐
                              ├─ Agora Server + SQLite ─ durable dispatch
dsh-agora（无 Bot 节点 B） ───┤
dsh-im + dsh-agora（节点 C） ─┘
```

机器人之间不读取彼此消息，也不依赖 Discord 的 bot-to-bot 触发。源 Agent 把工作写入中央派发队列，目标节点通过租约 claim，创建或恢复自己的 DSH Session，完成后可由目标节点上的 Bot 主动回到原 conversation/thread。

## 安装前检查

| 组件 | 要求 | 用途 |
| --- | --- | --- |
| Agora Server | Node.js 22+、npm 10+ | 中央编排和持久化 |
| DSH 节点 | 可工作的 `dsh` CLI 和 `web` profile | Agent 运行时 |
| `dsh-better-sidebar` | 可选但推荐 | 显示“Agora 协同”Web 面板 |
| `@xmanrui/dsh-im` | 可选、第三方 | Discord 等 IM Bot |
| `dsh-im.bridge/v1` patch | 仅在需要跨节点主动 IM 回帖时安装 | Bot 发现、Session 路由、幂等发送 |

先确认 DSH 可独立启动：

```bash
dsh --version
dsh web --host 127.0.0.1 --port 3080 --no-open
```

以下示例使用 `web` profile。其他 profile 把命令和路径中的 `web` 替换为实际名称。

## 第一步：部署中央 Agora Server

在一台稳定服务器上执行：

```bash
git clone https://github.com/txc-link/dsh-agora.git
cd dsh-agora
./scripts/bootstrap-local.sh
./agora init
./agora start
```

默认地址：

- API：`http://127.0.0.1:18008`
- 健康检查：`http://127.0.0.1:18008/api/health`
- Dashboard：`http://127.0.0.1:33173/dashboard/`

验证：

```bash
curl -fsS http://127.0.0.1:18008/api/health
```

其他机器上的 DSH 必须能够访问 Agora API。推荐使用私网、VPN 或带 TLS 的反向代理；也可以使用 FRP/SSH 隧道。传给插件的 `serverUrl` 是 API origin，例如 `https://agora.example.com` 或 `http://10.0.0.10:18008`，不要追加 `/api`。

只要 API 能被 loopback 之外的机器访问（包括 FRP 映射），就必须在 `~/.agora/agora.json` 启用 bearer auth：

```json
{
  "api_auth": {
    "enabled": true,
    "token": "replace-with-a-long-random-token"
  }
}
```

重启 Agora Server，并把同一个 token 通过各 DSH 节点的 `AGORA_API_TOKEN` 环境变量注入。不要把 token、Bot Token 或模型密钥提交到 Git。

重启后 `/api/health` 仍可匿名访问，但下面的无 token 探针必须返回 `401`：

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://agora.example.com/api/runtime-nodes
```

### 0.4 运行时安全升级

`dsh-agora` 0.4 起，派发带 fencing token，执行期间自动续租；过期或已被替换的 worker 不能再写入旧结果。Agent 结果与通用 delivery intent 在中央事务中一起提交，Discord/IM 发送从持久 outbox 单独 claim，失败后使用相同消息幂等键重试。因此 IM 故障不会阻塞或回滚 Agent 结果。

这是一次中央 Server 与节点插件需要同步升级的协议变更。升级时先停止新派发并等待 active 归零，再升级中央 Server、迁移数据库、升级所有 DSH 节点并重启。旧插件不能完成新的 fenced dispatch。

### 0.5 进度账本与证据化结果

`dsh-agora` 0.5 把“worker 仍持有租约”和“Agent 有实际工作进展”拆成两种信号：

- `claim_renewed_at` 只表示 worker 仍存活并持有 fencing token；
- `latest_progress` / `progress_updated_at` 表示最近一个实际执行阶段；
- `/api/runtime-dispatches/:dispatchId/progress` 保存按 `attempt + sequence` 排序的追加式历史；
- `result_envelope` 将自然语言答案、可核验主张、证据、置信度和执行环境分开保存。

内置 DSH runtime 会报告 `claimed`、`session_ready`、`prompt_accepted`、`response_started`、`response_completed`、`finalizing`。被重新领取的 dispatch 会开始新的 attempt，旧 attempt 的进度仍可审计，但不会冒充新 worker 的当前进度。证据块格式错误或 Agent 没有提供证据时，答案仍会正常完成，信封中的 claims/evidence 为空。

升级顺序是：先升级中央 Agora Server 并执行数据库迁移，再升级各 DSH 节点到 0.6.0。0.4 节点仍可连接升级后的 Server，只是不会产生新进度、证据和协同字段；不要先把 0.6 节点连接到尚未升级的严格旧 Server。

### 0.6 协同运行与联邦能力

`dsh-agora` 0.6 在可靠派发之上增加持久 `coordination_run`，支持 `single`、`fanout`、`review`、`debate`、`council` 五种策略。每次运行可限制 Agent 数、派发数、wall-clock、token、工具调用和成本。结果会检测无证据主张、同类数值冲突及 worker revision 漂移，并据此形成 Agent Scorecard。低于 `min_information_gain` 时不会继续创建新的验证轮次；未报告的用量保持 `null`，不会误算成零。只有 verifier 的受支持主张覆盖对应冲突时才会标为 `verified`；单纯完成验证派发不会把冲突伪装成已解决。

同一版本还提供 A2A 1.0 HTTP+JSON gateway、SHA-256 制品仓库、分层有来源 memory、每节点最小权限凭据、人工审批后的 worktree merge coordinator，以及带 Ed25519 签名、权限声明和一致性检查的插件 manifest。数据库迁移为 `032_coordination_federation.sql`，升级仍采用“中央服务先、节点插件后”的顺序。

## 第二步：在每个 DSH 节点安装插件

在每一台 DSH 机器上取得本仓库，然后构建和测试：

```bash
git clone https://github.com/txc-link/dsh-agora.git
cd dsh-agora/extensions/dsh-agora
npm install
npm run typecheck
npm test
```

Linux/macOS 安装：

```bash
dsh plugin --profile web add "$PWD"
```

PowerShell 安装：

```powershell
dsh plugin --profile web add (Get-Location).Path
```

需要 Web 面板时再安装 sidebar：

```bash
dsh plugin --profile web add dsh-better-sidebar
```

安装完成后，`package.json` 的 `dsh.profile.bundles` 应同时包含 `dsh-agora`；需要界面时还应包含 `dsh-better-sidebar`。如果 pnpm 因构建脚本策略退出，先按下文“pnpm 构建脚本被阻止”处理，再重新执行 `dsh plugin add`，否则包可能已经下载但 bundle 尚未挂载。

## 第三步：配置每个节点

默认 profile 路径：

- Linux/macOS：`${DSH_HOME:-$HOME/.dsh}/profiles/web`
- Windows：`$env:DSH_HOME\profiles\web`；未设置 `DSH_HOME` 时通常是 `$HOME\.dsh\profiles\web`

编辑该目录下的 `cordis.patch.yml`。如果文件已有其他插件配置，合并下面的 `id: agora` 行，不要覆盖整个文件：

```yaml
- id: agora
  config:
    serverUrl: 'https://agora.example.com'
    requestTimeoutMs: 10000
    defaultCreator: 'dsh'
    commandName: 'agora'
    nodeEnabled: true
    nodeId: 'node-a'
    maxConcurrent: 2
    runtimeAgents:
      - id: 'default'
        displayName: 'Node A General Agent'
        workspace: '/absolute/path/to/workspace'
        roles: ['general']
        capabilities: ['research', 'coding']
```

推荐让管理请求与 worker 使用不同凭据。管理员使用 `apiToken`；每个节点通过中央 CLI 获得只属于自己的 worker token：

```bash
agora node-credentials issue node-a \
  --scope heartbeat --scope dispatch --scope delivery \
  --label 'node-a worker'
```

该命令只在签发时返回一次明文 token，中央数据库只保存哈希。把它安全注入节点的 `AGORA_NODE_API_TOKEN`，或写入该节点插件配置的 `nodeApiToken`。`nodeApiToken` 只能访问自身 nodeId 对应的 heartbeat/dispatch/delivery 路由，不能读取任务、签发凭据或调用管理接口。轮换使用 `agora node-credentials rotate <node-id> <credential-id>`；确认新 token 生效后撤销旧凭据。

Windows 的 `workspace` 可以写成：

```yaml
workspace: 'C:/Users/example/workspace'
```

配置规则：

- `serverUrl`：中央 Agora API origin，不是 Dashboard 地址，也不要带 `/api`；
- `nodeId`：整个 Agora 网络内稳定且唯一，重启后不要变化；省略时使用主机名；
- `runtimeAgents[].id`：节点内唯一；完整目标格式为 `dsh:<nodeId>:<agentId>`；
- `workspace`：目标 DSH 可以访问的绝对路径；省略 Agent 清单时使用一个 `default` Agent 和当前工作目录；
- `maxConcurrent`：该节点允许同时执行的派发数；
- `dispatchLeaseSeconds`：默认 120 秒；worker 会在约三分之一租约时自动续租；用 `claim_renewed_at` 判断租约存活，用 `latest_progress` 判断实际工作推进，不要再用 dispatch `updated_at` 混淆两者；
- profile config 的优先级高于同名环境变量。

也可使用环境变量。只有在 profile 没有写死相应字段时，它们才会生效：

```bash
export AGORA_SERVER_URL=https://agora.example.com
export AGORA_API_TOKEN=replace-with-server-bearer-token
export AGORA_NODE_API_TOKEN=replace-with-scoped-node-token
export DSH_AGORA_NODE_ID=node-a
export DSH_AGORA_API_TOKEN=replace-if-non-loopback-callers-need-the-local-host-api
```

`AGORA_API_TOKEN` 用于插件的管理/查询请求；`AGORA_NODE_API_TOKEN` 只用于 worker 心跳、claim、续租、进度、完成和 delivery；`DSH_AGORA_API_TOKEN` 保护插件自己的 `/dsh-agora/api/*`。没有设置后者时，本地 Host API 只接受 loopback 请求。

检查最终合成配置：

```bash
dsh --profile web --dump-config
```

## 第四步：启动并验证 DSH 节点

```bash
dsh web --host 127.0.0.1 --port 3080 --no-open
```

打开 `http://127.0.0.1:3080`。安装了 `dsh-better-sidebar` 时，页面右上角会出现“Agora”按钮；点击后可看到总览、节点、任务和派发页面。

Loopback API 冒烟：

```bash
curl -fsS -X POST http://127.0.0.1:3080/dsh-agora/api/snapshot \
  -H 'content-type: application/json' \
  -d '{}'
```

PowerShell：

```powershell
Invoke-RestMethod -Method Post `
  -Uri 'http://127.0.0.1:3080/dsh-agora/api/snapshot' `
  -ContentType 'application/json' `
  -Body '{}'
```

成功快照至少应满足：

- `node.state` 为 `online`；
- `serverUrl` 指向预期中央服务；
- 多节点部署后，Agora 面板“节点”页能看到其他节点；
- 安装 bridge patch 后，`imBridge.state` 为 `connected`。

## 可选：安装 dsh-im 和主动回帖 bridge

不需要 Discord/IM 的节点可以跳过本节。`@xmanrui/dsh-im` 是第三方插件，先固定到仓库提供补丁的精确版本：

```bash
dsh plugin --profile web add @xmanrui/dsh-im@2.3.0
```

仓库当前提供：

| dsh-im 版本 | patch 文件 |
| --- | --- |
| `2.1.0` | `patches/dsh-im/@xmanrui__dsh-im@2.1.0.patch` |
| `2.3.0` | `patches/dsh-im/@xmanrui__dsh-im@2.3.0.patch` |

补丁只能用于文件名中的精确版本。升级 dsh-im 后必须重新生成、审查和测试，不能继续套用旧 patch。

以 Linux 和 `2.3.0` 为例：

```bash
PROFILE="${DSH_HOME:-$HOME/.dsh}/profiles/web"
mkdir -p "$PROFILE/patches"
cp patches/dsh-im/@xmanrui__dsh-im@2.3.0.patch "$PROFILE/patches/"
```

在 `$PROFILE/pnpm-workspace.yaml` 中保留原有内容并合并：

```yaml
packages:
  - .

nodeLinker: hoisted
autoInstallPeers: false

patchedDependencies:
  '@xmanrui/dsh-im@2.3.0': patches/@xmanrui__dsh-im@2.3.0.patch
```

首次应用补丁时更新 lockfile，随后验证冻结安装可复现：

```bash
pnpm --dir "$PROFILE" install
pnpm --dir "$PROFILE" install --frozen-lockfile
```

重启 DSH 后检查 `/dsh-agora/api/snapshot`。bridge 提供：

- 安全的 Bot identity、在线状态和发送能力；
- DSH Session 到 provider/bot/conversation/thread 的路由；
- 带幂等键的主动发送；
- Discord outbound 发送，但不会接受 Bot 自己发出的消息作为新任务。

bridge 不暴露 Bot Token。

### 关于 command gateway

`dsh-im.command-gateway/v1` 是 `dsh-agora` 定义的可选增强协议，不是第三方 dsh-im 当前自带的接口。即使 bridge 正常，快照仍可能显示：

```text
im: unavailable — no dsh-im.command-gateway/v1 provider is installed
imBridge: connected — dsh-im.bridge/v1
```

0.6 起快照还会同时显示 `commandAdapter.state: ready`。这是 `dsh-agora.command-adapter/v1` 第一方规范化入口，平台适配器可以直接投递带幂等键的命令事件；它不要求 dsh-im 实现私有 command gateway。第三方 gateway 仍显示 unavailable 是预期状态，不影响：

- 节点心跳、claim 和跨 Agent 派发；
- DSH Web 中的 `/agora` 命令；
- Discord 自然语言进入 DSH Session 后由 Agent 调用 `agora_task`；
- 通过 bridge 主动回帖。

它只影响 IM 内确定性解析 `/agora ...` 并直接绑定 actor/conversation/thread。该适配目前暂缓，不要把 `unavailable` 误判成 Discord 网络或 Bot 登录失败。

## 使用方式

### DSH 命令

```text
/agora health
/agora nodes
/agora agents
/agora list --state active
/agora show <task-id>
/agora status <task-id>
/agora dispatch-status <dispatch-id>
/agora runs
/agora run-status <run-id>
/agora scorecards [task-type]
/agora run --mode council --agents dsh:node-a:default,dsh:node-b:default --max-agents 2 --max-dispatches 3 --max-seconds 600 "核验仓库并给出证据"
/agora create --type implementation --priority high "实现 DSH 适配器"
/agora dashboard
/agora im
```

插件不提供 `/agora approve` 或 `/agora reject`。人类审批必须经过 Agora 已认证并可审计的入口。

### Agent 工具

全局 `agora_task` 支持：

- `health`、`nodes`、`agents`；
- `list`、`show`、`status`、`create`；
- `dispatch`、`dispatch_status`；
- `attach_session`。

目标格式为 `dsh:<nodeId>:<agentId>`。重试派发时应复用稳定的 `idempotency_key`，避免重复执行。

### Web 面板

“Agora 协同”面板包含：

- 总览：中央服务、本机节点、bridge、节点/Agent/Bot 数量和容量；
- 节点：心跳、Agent、能力标签、Bot 在线状态；
- 任务：创建和查看持久任务；
- 派发：选择目标、创建或续接 DSH Session、选择结果呈现方式，并分别显示租约心跳、实际工作阶段、证据数量和最终结果。
- 协同：选择策略和多个 Agent，创建预算化运行，查看成员完成度、证据、冲突、token 用量、停止原因与 Agent Scorecard。

界面只访问同源 `/dsh-agora/api`，Agora API Token 和 Discord Bot Token 始终留在 Host。派发默认 `silent`；只有明确选择“由目标 Bot 回帖”时才请求主动呈现。没有 sidebar 时 Host、工具、API 和节点 Worker 仍正常运行，只是不显示面板。

## 两节点验收流程

假设有两个在线目标：

- `dsh:node-a:default`
- `dsh:node-b:default`

先在 Web 面板选择 `dsh:node-b:default`，结果呈现选择 `silent`，输入：

```text
这是 Agora 跨节点测试。请只回复：REMOTE_AGORA_OK
```

记录 dispatch ID，再执行：

```text
/agora dispatch-status <dispatch-id>
```

验收标准：状态最终为 `completed`，工作进度至少经过 `prompt_accepted` 和 `response_completed`，结果包含 `REMOTE_AGORA_OK`，执行目标为 `dsh:node-b:default`。如果回答包含可核验事实，`dispatch-status` 还应显示 claims/evidence 数量。

需要测试 Discord 回帖时，不要依赖尚未实现的 IM `/agora` command gateway。向源 Bot 发送自然语言：

```text
请调用 agora_task，把任务派发给 dsh:node-b:default。
任务内容：只回复 REMOTE_DISCORD_OK。
presentation_mode 使用 destination_bot，等待 120 秒。
```

验收标准：目标节点完成派发，并由目标节点上的已连接 Bot 将结果发回对应 conversation/thread。

## Session 连续性

连续性分三层保存：

- dsh-im 记录 IM conversation/thread 到本机 DSH Session 的绑定；
- Agora 保存 task participant 到目标 runtime Session 的持久绑定；
- 派发记录保存目标节点、Agent、Session、结果和错误；claim 具有自动续租和 fencing，进程异常退出后可安全重新领取；进度按 attempt 单独留痕；
- 主动 IM 呈现保存在中央 delivery outbox，发送失败不会改变 dispatch 的完成状态，并会以相同幂等键重试。

`attach_session` 可以把已有 Session 绑定到任务参与者，而不复制聊天历史。后续 dispatch 传入该 `session_id` 即可继续上下文。重启 Discord Gateway、dsh-im、dsh-agora 或某个 DSH 节点不会删除中央任务和派发记录；节点恢复心跳后继续接单。

## 常见问题

### `404 page not found`

依次检查：

1. `serverUrl` 是否使用 Agora API 端口 `18008`，而不是 Dashboard 端口；
2. 地址是否只包含 origin，没有错误追加模型 API 路径或 `/api`；
3. 在 DSH 节点上执行 `curl <serverUrl>/api/health` 是否成功；
4. `dsh --profile web --dump-config` 中的最终值是否被其他 patch 覆盖。

### `ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED` 或 `ERR_PNPM_IGNORED_BUILDS`

这是 pnpm 的构建脚本安全策略，不是网络错误。只允许已经审查并确实需要构建的精确依赖，不要全局关闭安全策略。例如 `dsh-better-sidebar` 需要可信的 `node-pty` 构建时：

```yaml
allowBuilds:
  node-pty: true
```

如果 pnpm 输出的是带 Git tarball URL 的精确 `allowBuilds` key，应原样复制该 key。修改后重新执行原来的 `dsh plugin add`，让 CLI 完成 bundle 挂载。

### 包已下载但没有 Agora 按钮

检查：

1. `dsh-better-sidebar` 是否在 profile 的 dependencies 和 `dsh.profile.bundles` 中；
2. `dsh-agora` 是否也在 bundles 中；
3. 是否在处理 pnpm 构建错误后重新执行过 `dsh plugin add`；
4. 是否已重启 DSH 并强制刷新浏览器。

### 节点显示 offline

检查中央 `/api/health`、`nodeEnabled`、唯一 `nodeId`、系统时间、网络/反向代理和 DSH 进程。节点租约过期后会自动离线；恢复心跳后自动上线。

### `imBridge` 显示 unavailable

确认：

- dsh-im 版本与 patch 文件名完全一致；
- `patchedDependencies` 已写入 profile 的 `pnpm-workspace.yaml`；
- `pnpm install --frozen-lockfile` 成功；
- DSH 已重启；
- 安装后的 `@xmanrui/dsh-im/lib/index.js` 包含 `dsh-im.bridge/v1`。

### 新版 DSH 报 `.credentials.yaml` 中 `version` 或 `refs` 不是字符串

这是 DSH 凭据文件格式升级，与 Agora 无关。新版格式是顶层扁平字符串映射：

```yaml
DEEPSEEK_API_KEY: '...'
MINIMAX_CN_API_KEY: '...'
```

旧版 `version:` / `refs:` 外壳需要迁移。迁移前备份文件，保持密钥值不变，并确保文件权限不被放宽。

## 插件扩展和 Host API

第三方插件可以导入 `dsh-agora/sdk` 并注册 `dsh-agora.extension/v1`。当前内置 `runtime` 扩展负责 Agent 描述、Session 创建/恢复和 prompt 执行；新的 runtime adapter 应实现 `supportsTarget(runtimeTargetRef)`，注册表会显式选择支持目标的 adapter，并在没有第三方匹配时回退到内置 DSH runtime。新的 provider、策略或观察器应沿注册表扩展，不依赖 dsh-im 私有实现。生产环境建议启用 `extensionSecurity.requireSignedThirdParty` 并在 `trustedPublicKeys` 中配置 `publisher-id:key-id` 对应的 PEM 公钥。

严格模式下，第三方扩展必须提供 `dsh-agora.extension-manifest/v1`、Ed25519 签名和与 `integrity_sha256` 匹配的 package bytes；manifest 必须逐项声明 capability、permission 和 resource。安装前可调用 `runExtensionConformance()` 检查能力唯一性、runtime 协议、Agent 描述确定性和 manifest 权限对齐。

`POST /dsh-agora/api/{snapshot,health,nodes,agents,tasks,task,status,create,dispatch,dispatch-status,dispatch-progress,coordination-create,coordination-runs,coordination-run,scorecards,attach-session,command,command-event}` 返回统一 JSON envelope。`command-event` 接受 `dsh-agora.command-adapter/v1`；所有事件必须有稳定 `idempotency_key`。该 Host API 只是面板和本地 adapter 的薄代理，不保存 Agora 领域状态。

## 中央 CLI、REST 和 A2A

中央 `agora` CLI 提供 agent-first 操作面：

```bash
agora coordination create --mode fanout \
  --agent dsh:node-a:default --agent dsh:node-b:default \
  --max-agents 2 --max-dispatches 2 --max-seconds 600 \
  '独立检查仓库并附可核验证据'
agora coordination list
agora coordination show <run-id>
agora coordination reconcile <run-id>
agora coordination scorecards

agora artifacts put --file validation.json --name validation.json \
  --kind validation --media-type application/json \
  --owner-kind coordination_run --owner-ref <run-id>
agora memory add --scope project_shared --owner human --visibility project \
  --project-id <project-id> '已验证的项目约束'
agora memory query --scope project_shared --project-id <project-id>
agora merge propose --task-id <task-id> --project-id <project-id> \
  --base <base-revision> --head <head-revision> --worktree <path> \
  --summary 'validated changes' --validation-artifact <artifact-id> --requested-by <agent-ref>
```

Agent 只能提出 merge proposal；批准/拒绝必须在已认证 Dashboard 完成。`agora merge execute <proposal-id>` 仅执行已经存在人类审批者的 proposal，并会重新核对干净工作区、固定 base/head revision 以及 validation artifact 的实际 SHA-256 内容。节点凭据的签发、列举、轮换和撤销只接受中央全局 bearer 或 Dashboard admin 会话，普通 member 无权管理凭据。

A2A 1.0 HTTP+JSON 入口：

- `GET /.well-known/agent-card.json`：公开发现，不包含密钥、workspace 路径或私有 metadata；
- `POST /a2a/message:send`：创建异步 runtime dispatch；
- `GET /a2a/tasks/:id`：查询状态和结构化结果；
- `POST /a2a/tasks/:id:cancel`：取消任务。

除 Agent Card 外，A2A 路由使用中央 bearer auth。v1 明确声明 `streaming=false`、`pushNotifications=false`，调用者应轮询 task；`metadata.runtimeTargetRef` 在存在多个目标时必填。

## 开发验证

```bash
npm run typecheck
npm test
npm pack --dry-run
```

更高层的英文集成说明见 [`../../Doc/dsh-integration.md`](../../Doc/dsh-integration.md)。
