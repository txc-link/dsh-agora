# Element × Agora：公司、生活、健康与陪伴工作区样板

> 日期：2026-08-30<br>
> 目标：给 `@root:agent-hub.local` 一套可以照着创建的 Element 结构，以及
> Obsidian、Mem0、公司 Agent 和私人 Companion 的落位方法。<br>
> 线上结构已经按本文落地；2026-08-30 完成中文命名、全房间关闭 E2EE 和 connector
> 0.3.8 文本 Artifact 群内预览验证。

## 1. 先定清楚四个概念

| 概念 | 在本系统中的职责 | 不应该承担 |
|---|---|---|
| Matrix Space | 房间目录与成员入口，类似工作区 | 组织关系或信息授权 SSoT |
| Matrix Room | 聊天、附件、语音、Threads、任务回执 | 正式文档版本库与长期记忆库 |
| Obsidian Vault | Markdown 文档、决策、研究、复盘的可读 SSoT | 即时聊天与任务状态机 |
| Mem0 | 经筛选的偏好、事实、经验和关系记忆的语义召回 | 原始聊天全量归档、正式文档、授权记录 |

Element 官方将 Space 定义为组织人员和房间的容器，真正的交流发生在 Room；
房间支持附件、文件列表和 Threads。参考 [Element 左侧面板](https://docs.element.io/latest/element-support/quick-start-guide/the-left-panel/)、
[Element 中间面板](https://docs.element.io/latest/element-support/quick-start-guide/the-middle-panel/)
和 [Element 右侧面板](https://docs.element.io/latest/element-support/quick-start-guide/the-right-panel/)。

## 2. Element 中应创建的结构

四个 Space 必须都是**相互独立的顶层私密 Space**，不能把生活、健康或陪伴
挂到 Company Space 下面：

```text
@root:agent-hub.local
├─ 公司团队                                  [work / internal]
│  ├─ #company-ea-inbox:agent-hub.local        CEO 唯一公司入口
│  ├─ #company-briefing:agent-hub.local         晨报、晚检、跨团队汇总
│  ├─ #company-research:agent-hub.local         研究团队工作房间
│  ├─ #company-engineering:agent-hub.local      工程团队工作房间
│  ├─ #company-operations:agent-hub.local       运营与例行任务
│  ├─ #company-decisions:agent-hub.local        决策回执，不放草稿闲聊
│  ├─ #company-forum-feed:agent-hub.local       Agora Forum 帖子摘要投影
│  ├─ #company-node-ops:agent-hub.local         节点维护；不用作业务入口
│  └─ #company-audit:agent-hub.local            审计报告与告警
│
├─ 个人生活                                  [life / personal]
│  ├─ #life-inbox:agent-hub.local               生活请求入口
│  ├─ #life-schedule:agent-hub.local            日程、冲突、提醒
│  └─ #life-travel:agent-hub.local              行程研究与待确认清单
│
├─ 健康管理                                  [health / sensitive_personal]
│  ├─ #health-private:agent-hub.local           健康记录与健康管家
│  └─ #health-reminders:agent-hub.local         低内容提醒与摘要
│
└─ 陪伴助手                                  [companion / sensitive_personal]
   └─ #companion-private:agent-hub.local        小栀的文字、语音和关系记忆回执
```

### 首日最小版

先只建六个房间就够：

1. `公司团队`：`#company-ea-inbox`、`#company-briefing`、
   `#company-research`、`#company-decisions`。
2. `个人生活`：`#life-inbox`。
3. `陪伴助手`：`#companion-private`。
4. `健康管理`：`#health-private`、`#health-reminders`。

## 3. 在 Element Web/Desktop 里怎么点

### 3.1 创建顶层 Space

对四个 Space 分别执行：

1. 左侧最窄的一列点击 `+ Create a space`。
2. 选择 `Private space`。
3. 填名称和说明，例如 Company 的说明写：
   `公司任务、团队协同和工作文档入口；禁止写入生活、健康和陪伴原始数据。`
4. 只邀请 `@root:agent-hub.local`；后续再按房间邀请对应 bot。
5. 不要把 Personal Office、Health Vault、Companion 添加为 Company 的子 Space。

官方入口和 Space/Room 操作见 [Element 创建 Space/Room 指南](https://docs.element.io/latest/element-support/quick-start-guide/the-left-panel/)。

### 3.2 在 Space 中创建 Room

1. 选中 Space，点击 Space 首页的 `Add` → `New room`，或房间列表旁的 `+`。
2. 名称用上面的清单，Topic 写清“用途、允许的数据、禁止的数据”。
3. 选择 `Private room`。
4. `Security & Privacy` 设置为 `Private (invite only)`。
5. 历史建议设为 `Members since invited`；成员离开后不再继续获得新内容。
6. `Roles & Permissions` 中让 `root` 保持 Admin；普通 agent/bot 不授予改权限、
   改历史、邀请成员的能力。
7. 只邀请真正需要这个房间的 bot，不要把三个节点 bot 全部塞进每个房间。

Element 支持 invite-only、历史可见性和 power levels；历史可见性变更只影响未来
消息，不能追溯修正旧消息，见 [Element Room Settings](https://docs.element.io/latest/element-support/matrix-rooms/managing-a-room-room-settings/)。

### 3.3 把 Room 接给 connector

创建后打开 `Room settings` → `Advanced`，抄下 Space 和 Room 的 **Internal room
ID**（`!…:agent-hub.local`）。`#company-ea-inbox:…` 是便于人记的 alias，connector
配置必须使用 `!…` internal id。

Company 入口实例的配置样板：

```yaml
nodeId: node-home-linux
companyOrganization: austin-agent-company
allowFrom: '@root:agent-hub.local'
autoJoin: true

spaces:
  enabled: true
  rootSpaces:
    - '!COMPANY_SPACE_INTERNAL_ID:agent-hub.local'

securityBoundary:
  domainRef: domain:company
  boundaryKind: company
  rootSpaceId: '!COMPANY_SPACE_INTERNAL_ID:agent-hub.local'
  requireTopLevelRoot: true
  allowedRoomIds:
    - '!EA_INBOX_INTERNAL_ID:agent-hub.local'
    - '!BRIEFING_INTERNAL_ID:agent-hub.local'
    - '!RESEARCH_INTERNAL_ID:agent-hub.local'
    - '!DECISIONS_INTERNAL_ID:agent-hub.local'
```

Homeserver、bot token 和 Core token 继续从 DSH 的受保护配置注入，不要粘贴到
Element 或提交到 Git。每个业务入口 Room 只保留一个处理 `/agora` 的 ingress bot，
否则多个 node connector 可能重复响应同一命令。Mac/Windows 节点由 Core runtime
dispatch 接任务，不要求它们的 Matrix bot 全部加入 EA Inbox；各节点的维护命令用
单独 DM 或 `#company-node-ops`。节点显示名改成 `node-mac` 等，并不会自动改掉
历史 Matrix mxid，邀请时以每台 connector 当前 `userId` 为准。

### 3.4 当前无 E2EE 口径

- 本部署所有现存 Room 均无 `m.room.encryption`；Synapse 当前计数为 0。
- `/.well-known/matrix/client` 已设置 `io.element.e2ee.default=false` 和
  `force_disable=true`，Element 不再允许新房间启用加密。
- Matrix 加密对房间是不可逆状态。迁移时已先备份旧房间状态与时间线，再用同名、
  同 Topic、同 Space 关系的非加密房间替换，最后清理旧房间。
- “生活、健康、陪伴与公司分域”仍由独立顶层 Space、成员 ACL、独立 bot、Core
  DelegationPolicy、Vault 和 Mem0 namespace 保证；它们绝不能重新挂进 Company Space。
- 无 E2EE 意味着 homeserver 管理员和服务器侧组件在技术上可以读取消息。真实病历、
  密码、支付凭据等高敏原文仍不应发到 Matrix，只发送最小摘要或安全存储的引用。

Element 的 E2EE 默认与强制禁用选项见
[Element Web E2EE 配置](https://github.com/element-hq/element-web/blob/develop/docs/e2ee.md)；
Synapse 的默认加密设置只影响新房间，见
[Synapse 配置文档](https://matrix-org.github.io/synapse/latest/usage/configuration/config_documentation.html)。

## 4. 群里能保存文件、发帖子吗

### 文件：能，但把它当附件，不当文档库

- 桌面端可把文件拖进消息框，或点回形针上传。
- 房间右侧 `Room info` → `Files` 可以集中查看该房间附件。
- 文件和消息随房间历史保存在 Matrix homeserver；这适合交付和讨论。
- 正式研究、方案、决策和复盘仍应生成 Markdown Artifact 并进入 Obsidian；
  Matrix 只回投摘要、哈希、任务 id 和 Obsidian 路径。
- Element 本身不把 `.md` 附件渲染成文档页面；附件仍可下载。connector 0.3.8 会在
  `/agora artifact <id>` 时先发送经过 HTML 转义、最多 12,000 字符的群内源码预览，
  再发送原始文件，因此常见 Markdown 交付可以直接在群里阅读。

官方文件操作见 [Element Help](https://element.io/en/help) 和
[Element 右侧面板](https://docs.element.io/latest/element-support/quick-start-guide/the-right-panel/)。

### 帖子：Element 用 Thread，真正论坛用 Agora Forum

Element 没有本部署可依赖的 Discord Forum/Discourse 式“帖子频道”。当前做法：

1. 临时讨论：在 `#company-research` 发一条标题消息，选择 `Reply in thread`；
   所有回复留在同一 Thread。
2. 值得长期学习的内容：Agent 通过 `agora post create` 写入 Agora Forum。
3. `#company-forum-feed` 只展示帖子摘要、标签、作者、链接/ID。
4. 定期用 `agora forum export` 把 Forum 和评论写进 Obsidian。

Threads 的作用是把同一主题的回复收拢，官方说明见
[Element Threads](https://docs.element.io/latest/element-support/quick-start-guide/the-middle-panel/)。

建议首条 Thread 模板：

```markdown
【研究议题】AI Agent 长期记忆方案对比

- Owner：@景衡
- Due：2026-09-02 18:00 +08:00
- 验收：至少 3 个一手来源；区分事实/推断；列失效条件
- 输出：一页摘要 + 对比表 + 决策建议
- Agora task：待 EA 创建后回填
```

## 5. 连接 Obsidian

### 5.1 Vault 必须物理分开

```text
/srv/agora-vaults/
├─ company/       # 可做私有 Git 版本化
├─ life/          # 不进入 Company Git
├─ health/        # 加密磁盘、独立备份与严格 ACL
└─ companion/     # 独立 retention；不与 Company 索引合并
```

这些是建议路径，创建前按实际机器磁盘和备份位置调整。Obsidian 本地 Vault 本身不
自动加密；如果跨设备同步敏感 Vault，需要单独确认端到端加密和恢复口令策略。
参考 [Obsidian Sync 安全说明](https://help.obsidian.md/Obsidian%20Sync/Security%20and%20privacy)。

### 5.2 当前已经能跑的“Agora → Obsidian”

在拥有 Agora 数据库且能访问目标 Vault 路径的节点执行：

```bash
agora forum export \
  --vault /srv/agora-vaults/company \
  --project-id default \
  --base-folder Agora
```

结果目录是：

```text
<vault>/Agora/<project>/<category>/<date>-<slug>.md
```

Markdown frontmatter 包含 `agora_id/category/author/created/project/tags`，评论会跟着
帖子写入，`.agora-forum-index.json` 保证同一 post id 不重复导出。Obsidian 打开
该本地文件夹即可看到文件，无需 REST 插件。

建议把它做成 15 分钟一次的 Routine，但当前命令本身是显式导出，不要把“可以
手动运行”误解成“每条 Matrix 消息已经自动入库”。

### 5.3 “Obsidian → Agora 检索”是第二条链

仓库已有只读 `obsidian_rest` context-source adapter，协议期望：

```yaml
source_id: company-vault
scope: project
project_id: default
kind: obsidian_rest
label: Company Vault
location: https://127.0.0.1:27124
access: read_only
enabled: true
metadata:
  api_key: ${OBSIDIAN_REST_API_KEY}
  insecure_tls: false
  context_length: 160
```

它会调用 `/search/simple/` 和 `/vault/<path>`。这段是项目 context-source binding
结构示例；当前 CLI 没有一个“一键新增 Obsidian binding”的命令，因此建议首轮先
跑 5.2 的单向沉淀，等把 binding 管理入口补齐后再启用反向检索。API key 不写进
仓库或 Matrix。

## 6. 连接 Mem0（正确拼写是 Mem0）

中央 Linux 已有自托管 Mem0 REST；Agora 当前用以下环境变量：

```bash
export AGORA_MEM0_URL=http://127.0.0.1:8888
export AGORA_MEM0_TOKEN='<从 secrets 注入，不发到 Matrix>'
export AGORA_GROUP_SCOPE='group:company-research'
export AGORA_AGENT_REF='agent:zhi'
```

写入和召回示例：

```bash
agora experience add \
  --kind lesson \
  --text '对价格类结论必须记录查询日期与 30 天失效条件' \
  --metadata '{"domain":"work","source":"task:OC-123","confidence":0.9}'

agora experience search \
  --scope group:company-research \
  --query '比价报告应该怎样标失效条件' \
  --limit 5
```

当前 adapter 把 `scopeRef` 映射为 Mem0 的 `user_id`；自托管 Mem0 的 `m0sk_` key
通过 `X-API-Key` 发送。官方自托管 API 也使用无 `/v1` 前缀的 `/memories`、
`/search` 和 `X-API-Key`，见 [Mem0 REST API Server](https://docs.mem0.ai/open-source/features/rest-api)。

### 推荐 scope，不要只用一个全局 `group:default`

| 用途 | scopeRef 示例 | 谁可以读 |
|---|---|---|
| CEO 工作偏好 | `owner:root/domain:work` | EA + 明确授权的工作 Agent |
| 研究团队经验 | `group:company-research` | 研究团队 |
| 工程团队经验 | `group:company-engineering` | 工程团队 |
| 生活偏好 | `owner:root/domain:life` | root + 日程/生活管家 |
| 健康摘要 | `owner:root/domain:health` | root + 健康管家 |
| 陪伴关系记忆 | `owner:root/domain:companion` | root + companion |

现有 adapter 的隔离主键只有 `scopeRef/user_id`，因此必须把 domain 编进 scope，
metadata 不能替代安全隔离。健康和陪伴正式使用前还应在 Mem0 部署层使用独立
数据库/collection 或独立服务凭证；这部分不是当前 adapter 已完成的能力。

### 什么该记，什么不该记

写 Mem0：经确认的偏好、稳定事实、可复用 lesson/howto、已确认关系事件。<br>
不写 Mem0：密码/token、原始病历、整段聊天、未经确认的人格推断、正式合同或
决策全文。正式内容进 Core/Obsidian，只把可召回摘要和 provenance 写 Mem0。

## 7. Agent 设定怎么写

完整样板在 [agent-cards.example.yaml](../examples/element-agent-workspace/agent-cards.example.yaml)。
它是**运营设计清单，不是当前 CLI 可直接导入的 schema**。每个 Agent 至少写清：

1. 身份：`id/display_name/role`，不要把 `node-mac` 当成角色名。
2. 组织：Position、Employment kind、汇报对象、职责和升级路径。
3. 行为：mission、persona、speaking style、禁止事项。
4. 权限：domain、Matrix rooms、sensitivity ceiling、tools。
5. 记忆：允许读写的 Mem0 scope、写入规则、来源和失效条件。
6. 主动性：Routine、quiet hours、每日上限、什么情况可以即时打扰。
7. 运行时：首选节点只是绑定，可迁移，不改变 Agent 的长期身份。

### 7.1 公司 Agent：用 Citizen + Position + Employment 落地

以下命令展示真实 CLI 形态；把尖括号替换为创建命令返回的 id：

```bash
# 1) 长期 Citizen 身份
agora citizens create \
  --id agent:lan \
  --project default \
  --role executive-assistant \
  --name 岚 \
  --persona '沉着、简洁、有判断力；先结论后依据；不把个人域数据带入工作域' \
  --boundary '不可批准高风险或不可逆动作' \
  --boundary '不可读取未授权的 life/health/companion 数据' \
  --skill executive-intake \
  --skill delegation \
  --skill synthesis \
  --adapter openclaw

# 2) 公司和岗位（organization id、unit id、position id 以返回值为准）
agora company create \
  --slug austin-agent-company \
  --name 'Austin Agent Company' \
  --owner human:ceo \
  --domain work

agora company unit add \
  --org <organization-id> \
  --name 'Executive Office' \
  --kind executive_office \
  --responsibility 'CEO intake and cross-team coordination'

agora company position add \
  --org <organization-id> \
  --unit <executive-office-unit-id> \
  --title 'Executive Assistant' \
  --kind executive_assistant \
  --responsibility 'triage, delegate, synthesize, reconcile' \
  --skill executive-intake \
  --skill delegation

agora company employment add \
  --org <organization-id> \
  --position <ea-position-id> \
  --subject agent:lan \
  --subject-kind agent \
  --kind resident
```

其余研究 Lead、研究员、工程师、审计员重复这个模式。Agent 的“人设”和“职责”
不是一回事：persona 决定怎么说和怎么判断，Position/Employment 决定在组织里能做
什么，Matrix membership 决定能看到哪里，runtime binding 决定在哪台机器执行。

### 7.2 Companion：用版本化 RelationshipProfile 落地

可直接作为 `--payload-file` 使用的有效 JSON 在
[companion-profile-v1.json](../examples/element-agent-workspace/companion-profile-v1.json)。

```bash
agora relationship create \
  --profile relationship:root-xiaozhi \
  --owner human:ceo \
  --agent agent:xiaozhi \
  --kind companion \
  --name 小栀 \
  --payload-file Doc/examples/element-agent-workspace/companion-profile-v1.json \
  --by human:ceo \
  --note 'v1：温柔、俏皮、平衡型监督，每日最多两次主动关心'
```

以后改性格或经历不要覆盖 v1，而是复制 JSON、修改后追加版本：

```bash
agora relationship revise \
  --profile relationship:root-xiaozhi \
  --expected-version 1 \
  --payload-file /secure/path/companion-profile-v2.json \
  --by human:ceo \
  --note 'v2：说话更直接，保留原有边界和主动上限'
```

## 8. 三台节点怎么分工

| 节点 | 建议职责 | 原因 |
|---|---|---|
| `node-home-linux` | Core、EA、scheduler、Mem0、Vault export、审计 | 长期在线、中央状态与例行任务 |
| `node-mac` | 研究 Lead、交互式研究与工程审阅 | 适合日常主工作流 |
| `node-work-windows` | on-demand worker、Companion TTS | 已有 Windows SAPI 语音链 |

这是 runtime 偏好，不是固定组织身份。`agent:zhi` 从 Windows 迁移到 Mac，不会改变
其 Position、Employment、记忆 scope 或 Matrix 权限。

## 9. 两条完整示例

### 9.1 公司调研

1. root 在 `#company-ea-inbox` 发：
   `/agora assistant ask --capability research 调研 2026 年 agent memory 方案，周三前给建议`。
2. 岚登记 request/commitment，路由给研究 Lead 景衡。
3. 景衡在 `#company-research` 建一个 Thread；知微和临时 worker 在里面交证据。
4. 结果生成 Artifact；可复用教训写 `group:company-research`；正式研究进入 Forum。
5. `agora forum export --vault /srv/agora-vaults/company` 写入 Obsidian。
6. 岚在 `#company-briefing` 交一页总结，在 `#company-decisions` 留决策回执。

### 9.2 杭州出行 + 牙医 + 陪伴提醒

1. root 在 `#life-inbox` 发“下周五六去杭州，顺路约牙医复诊”。
2. EA 只在 Core 做授权路由：行程进入 Life，牙医进入 Health；Company 不出现原文。
3. 日程管家发现冲突，给两个可选日期；on-demand worker 只拿脱敏约束做比价。
4. 订票、预约、支付都停在 Human Gate。
5. Life Obsidian 保存行程文档；Health Vault 保存复诊材料；两边使用不同 Mem0 scope。
6. 如果 root 明确授权，Companion 只收到 `CareSignal: 明早有重要安排，可温和提醒`，
   而不是牙科记录；小栀在 quiet hours 外发送一条文字或语音。

## 9.3 群聊中人类与 Agent 如何协同

当前 connector 采用 `command_only`：它读取 `/agora ...` 命令和已绑定任务 Thread
中的回复，但会忽略普通群聊消息。这能防止多个 bot 互相触发、重复建任务或无限对话。

推荐的协同链是：

1. 人类在共同房间讨论，用 `/agora assistant ask ...` 明确创建任务。
2. EA 在 Core 内拆解、授权、分派给个人或团队；Agent 间状态以 Core Event 为准。
3. 里程碑、问题、产物预览和完成回执投影回原房间或 Thread。
4. 人类在 Thread 补充约束；connector 把回复追加到绑定任务，而不是新建重复任务。
5. 后续若接普通消息，优先新增 `mention_and_assignment`：只有 `@Agent`、明确指派或
   已绑定 Thread 才触发。全量环境监听 `ambient_observer` 只能在房间级显式授权，且
   默认只摘要不主动回复。

不要让 Agent 直接在 Matrix 里无限互聊。需要圆桌讨论时由 Core 创建有参与者上限、
轮次上限、预算和冷却时间的 coordination run，再把结论投影到群里。

## 9.4 Element 可扩展能力

Element 使用 Widget、Bot 和 Bridge，不是浏览器式扩展商店。当前优先级：

1. Element Call/Jitsi：群内会议。
2. Agora Dashboard custom widget：在房间侧栏看任务、Gate 和节点状态。
3. Matrix Hookshot：连接 GitHub、GitLab、Jira、通用 Webhook 和 Feed。
4. 按需部署 Telegram、Teams、Slack、Discord、IRC、XMPP 或 Signal Bridge。

房间右侧 `Room info` → `Add apps, bridges & bots` 是已配置集成的入口。自托管实例要先
部署对应 Integration Manager/Bridge，app.element.io 不会自动给私有 homeserver
安装后端。参考 [Element 集成入口](https://docs.element.io/latest/element-cloud-documentation/integrations/create-a-conference-call-in-a-room/)
和 [Element 文档索引](https://docs.element.io/latest/)。

## 10. 当前可用与仍需补齐

| 能力 | 状态 |
|---|---|
| Element 创建私密 Space/Room、附件、Files、Threads | 已可用 |
| 全部房间无 E2EE + 新房间强制禁用 E2EE | 已上线并验证 |
| Company Organization/Position/Employment/EA/Commitment | 已可用 |
| Matrix `/agora company`、`/agora assistant` 薄入口 | 已可用 |
| Markdown/text Artifact 群内安全预览 + 原文件下载 | connector 0.3.8 已上线 |
| Mem0 `experience add/search/list` | 已可用，显式调用 |
| Agora Forum → Obsidian Markdown | 已可用，显式导出 |
| Companion profile 版本、initiative、语音投递模型 | 已实现 |
| 普通 Matrix 消息自动分类并写 Mem0 | 未接通 |
| Matrix 附件自动归档 Obsidian + 回投 URI | 未接通 |
| Agora Forum 帖子完整投影成 Element 帖子 UI | 未接通；先用 Thread/feed |
| 普通群聊按 @mention/指派触发 Agent | 未接通；当前为 command_only |
| Life/Health/Companion 独立 bot + 数据域 ACL | 部分接通；需继续收紧成员和存储权限 |

## 11. 推荐下一步

先按“首日最小版”手工创建 4 个顶层 Space 和 6 个 Room，并记录每个 Space/Room
的 Matrix room id。随后按优先级接三条自动化：

1. EA intake 的普通消息入口与房间→domain 分类。
2. Artifact/Forum 自动写对应 Vault，并向原 Thread 回投收据。
3. 经治理的 memory distillation：任务结束时生成候选记忆，确认后写入对应 Mem0 scope。

Health/Companion 的 dedicated bot、数据最小化、独立存储和访问审计必须先于真实
敏感内容上线；本部署明确不依赖 E2EE 作为边界。
