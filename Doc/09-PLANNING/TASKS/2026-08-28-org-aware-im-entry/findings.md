# findings.md — Agora Core 调研结果（2026-08-28 turn 25）

## 重大发现：Agora Core 不是空白画布

我之前所有讨论基于错误前提——"agora-ts + dsh-agora 对 matrix 零代码，所以从零设计"。
**实测发现 agora-ts Core 已经建成组织化工作 OS 的完整骨架**。

## 已存在的核心抽象

### 1. Agent 身份与组织
- `CitizenService`（`packages/core/src/citizen-service.ts`）
  - 完整的 citizen definition：display_name / persona / boundaries / skills_ref / channel_policies / runtime_projection
  - 这是"agent 有身份"的实现
- `ProjectMembershipService`（`packages/core/src/project-membership-service.ts`）
  - 项目成员关系（admin / member 角色）
  - 这是"有组织"的实现
- `TeamMemberKind`（`packages/core/src/team-member-kind.ts`）
  - controller / craftsman / citizen 三种角色
  - 这是"有架构"的实现
- `ProjectAgentRosterService`（`packages/core/src/project-agent-roster-service.ts`）
  - agent_ref → kind (controller / craftsman) 的注册
  - 这是 controller agent 配置

### 2. 协同与注意力
- `CoordinationService`（`packages/core/src/coordination-service.ts`）
  - coordination run / member / synthesis / scorecard / runtime_usage
  - 这是"主动协同"的实现
- `AttentionRoutingService`（`packages/core/src/attention-routing-service.ts`）
  - attention routing plan（project_map / focus / supporting）
  - 这是"有计划"的实现
- A2A contracts（`packages/contracts/src/a2a.ts`）
  - Agent-to-Agent 消息 / 任务 / artifact / skills
  - 这是"agent 间通信"的实现

### 3. 上下文与记忆
- `ContextHarvestService` + `ContextMaterializationService` + `ContextRetrievalService`
  - 上下文采集 / 物化 / 检索
  - 这是"长期工作"的实现（持久化上下文）
- `ProjectBrainService` + retrieval（`packages/core/src/project-brain-*.ts`）
  - 项目级知识库 + embedding 检索 + chunking policy
  - 这是"受控"的实现（project brain 控制 agent 获取的知识）

### 4. 资源管理
- `HostResourcePort`（`packages/core/src/host-resource-port.ts`）
  - CPU / 内存 / swap / load 快照
- `os-host-resource-port`（`packages/adapters-host/src/`）
  - OS 实际读取实现
  - 这是"管理资源"的实现

### 5. 联邦与跨节点
- `FederationServices`（`packages/core/src/federation-services.ts`）
  - ArtifactService（5MB 上限 / sha256 校验）
  - MemoryService（跨节点记忆）
  - RuntimeNodeCredentialService（节点凭证）
  - MergeProposalService（merge 提议）
  - 这是"多节点协同"的实现
- `RuntimeNodeRegistryService`
  - 跨节点 runtime 注册

### 6. 任务生命周期
- `TaskService` + `TaskLifecycleService` + `TaskStageService` + `TaskApprovalService`
  - 任务创建 / 阶段 / 审批
- `TaskParticipationService`
  - 任务参与关系
- `TaskConversationService` + `TaskContextBindingService` + `TaskBrainBindingService`
  - 任务-对话 / 任务-上下文 / 任务-知识绑定

### 7. 用户/权限
- `HumanAccountService` + `PermissionService`
  - 人类账户 + 权限决策
- `InboxService`
  - 收件箱
- `NotificationDispatcher`
  - 通知分发

### 8. 现有 IM 入口（**部分**）
- `CcConnectManagementService` + `CcConnectInspectionService`
  - **已有 cc-connect 管理服务**——说明 core 想把 IM 入口做成核心服务
  - 但只是 cc-connect 桥接，**没有 matrix 桥接**
- `IMPorts`（`packages/core/src/im-ports.ts`）
  - IM 抽象端口定义
- `TaskParticipationServiceCcConnect`
  - cc-connect 任务参与
- `DashboardQueryService`
  - Dashboard 是人类入口（§2 红线）

## 关键推论

### 推论 1：dsh-matrix-connector 不是"从零设计"
它是 **Agora 组织化能力缺失的 IM 入口**。
Core 已具备身份 / 组织 / 协同 / 计划 / 上下文 / 资源 / 联邦；
**缺的是**：让人类在 IM 里访问这些能力。

### 推论 2：v0.1 必须重新定义
旧 v0.1："跑通一条消息 Element→agora→Agent→Element"
**新 v0.1**："matrix 房间能看见 agora citizen 状态 / 能触发 citizen 派发 / 能审阅 citizen 工件"

### 推论 3：v1.0 才是"组织化协作"的真正形态
v1.0 应包含：
- Agent 团队（多个 citizen + 1 个 controller）在 matrix room 里协同
- A2A 协议让 agent 间消息在 room 里可见
- ProjectBrain 检索结果作为 room 上下文
- HostResource 状态作为 room 实时面板
- MergeProposal 在 room 里发起 → 审批 → 落地

### 推论 4：cc-connect 在 Core 中的位置
`CcConnectManagementService` / `CcConnectInspectionService` 已经在 Core 里了。
意味着 cc-connect **不是被替换**——它是 Core 的 **IM abstraction 的第一个实现**。
dsh-matrix-connector 应作为**第二个实现**，与 cc-connect 平级。

## 关键文档与代码路径

```
agora-ts/packages/core/src/
  attention-routing-service.ts          # 注意力路由
  citizen-service.ts                    # 公民抽象
  project-membership-service.ts         # 项目成员
  project-agent-roster-service.ts       # agent 注册
  team-member-kind.ts                   # 角色分类
  coordination-service.ts               # 协同调度
  host-resource-port.ts                 # 宿主资源
  context-harvest-service.ts            # 上下文采集
  context-materialization-service.ts    # 上下文物化
  context-retrieval-service.ts          # 上下文检索
  project-brain-service.ts              # 项目知识库
  federation-services.ts                # 联邦（artifact/memory/credential/merge）
  runtime-node-registry-service.ts      # 节点注册
  task-service.ts                       # 任务服务
  task-approval-service.ts              # 任务审批
  cc-connect-management-service.ts      # IM 入口（cc-connect）
  im-ports.ts                           # IM 抽象端口
  inbox-service.ts                      # 收件箱
  notification-dispatcher.ts            # 通知分发

agora-ts/packages/contracts/src/
  citizen.ts                            # citizen zod schemas
  attention-routing.ts                  # attention routing zod schemas
  a2a.ts                                # agent-to-agent 协议
  ...
```

## 重新评估

| 我之前说 | 实际 |
|---|---|
| agora-ts 对 matrix 零代码 | agora-ts **对 matrix 零代码**，但 Core **已有完整的组织化抽象** |
| v0.1 = 跑通一条消息 | v0.1 = 把组织化能力用 matrix IM 让人类访问 |
| cc-connect 出局 | cc-connect **不出局**，它是第一个 IM 实现；dsh-matrix-connector 是第二个实现 |
| 双中央正交（agora 中央 + matrix 中央） | 拓扑对，但 agorats Core 是**组织化 OS**，matrix 只是 IM 入口之一 |