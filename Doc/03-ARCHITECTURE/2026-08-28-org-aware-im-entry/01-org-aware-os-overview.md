# 01 — Agora Core 组织化 OS 全貌

## 1. 核心论断

**Agora Core 在 agora-ts/packages/core/src/ + contracts/src/ 已经实现了组织化 agent 工作 OS 的核心抽象**。dsh-matrix-connector 是让人类用 Matrix IM 访问这些能力的入口——不是"再造一个组织化 OS"。

## 2. Core 已实现的组织化能力

### 2.1 Agent 身份层

| 服务 / 概念 | 文件 | 职责 |
|---|---|---|
| `CitizenService` | `core/src/citizen-service.ts` | 公民定义（display_name / persona / boundaries / skills_ref / channel_policies / runtime_projection） |
| `citizen-definition` | `contracts/src/citizen.ts` | zod schema，projection_target（adapter/auto_provision/metadata） |
| `citizen-projection-port` | `core/src/citizen-projection-port.ts` | 投影抽象（citizen → 各 runtime） |

**已能做的**：
- 创建 citizen
- 给 citizen 配 skills（agent 技能）
- 投影到具体 runtime（openclaw / 自定义）
- 启停 / 归档

### 2.2 组织层

| 服务 / 概念 | 文件 | 职责 |
|---|---|---|
| `ProjectMembershipService` | `core/src/project-membership-service.ts` | 项目成员关系（admin / member） |
| `ProjectAgentRosterService` | `core/src/project-agent-roster-service.ts` | agent_ref → kind (controller / craftsman) 注册 |
| `team-member-kind.ts` | `core/src/team-member-kind.ts` | controller / craftsman / citizen 分类 |
| `RolePackService` | `core/src/role-pack-service.ts` | role pack 管理 |
| `StageRosterService` | `core/src/stage-roster-service.ts` | 阶段名册 |
| `TaskParticipationService` | `core/src/task-participation-service.ts` | 任务参与关系 |

**已能做的**：
- 项目下分 admin / member
- agent 按 controller / craftsman 分类
- 任务绑定参与 agent

### 2.3 协同层

| 服务 / 概念 | 文件 | 职责 |
|---|---|---|
| `CoordinationService` | `core/src/coordination-service.ts` | coordination run / member / synthesis / scorecard / runtime_usage |
| `A2A` schemas | `contracts/src/a2a.ts` | agent-to-agent 协议（message / task / artifact / skills） |
| `TaskBroadcastService` | `core/src/task-broadcast-service.ts` | 任务广播 |
| `CraftsmanCallbackService` | `core/src/craftsman-callback-service.ts` | 工人回调 |

**已能做的**：
- 多个 citizen 在一个 coordination run 里协同
- agent 之间按 A2A 协议发送消息
- 任务广播到多个 worker
- 协同结果合成 + 评分

### 2.4 计划层

| 服务 / 概念 | 文件 | 职责 |
|---|---|---|
| `AttentionRoutingService` | `core/src/attention-routing-service.ts` | attention plan（project_map / focus / supporting） |
| `TaskStageService` | `core/src/task-stage-service.ts` | 任务阶段 |
| `TemplateGraphService` | `core/src/template-graph-service.ts` | 任务模板图（DAG / 阶段） |
| `TaskLifecycleService` | `core/src/task-lifecycle-service.ts` | 任务生命周期 |
| `TaskApprovalService` | `core/src/task-approval-service.ts` | 任务审批 |
| `ModeController` | `core/src/mode-controller.ts` | 模式控制 |

**已能做的**：
- 创建任务模板（DAG）
- 按 DAG 推进阶段
- 任务审批门（gate）
- 任务自动路由到合适 agent（attention routing）

### 2.5 上下文与知识层

| 服务 / 概念 | 文件 | 职责 |
|---|---|---|
| `ContextHarvestService` | `core/src/context-harvest-service.ts` | 上下文采集 |
| `ContextMaterializationService` | `core/src/context-materialization-service.ts` | 上下文物化 |
| `ContextRetrievalService` | `core/src/context-retrieval-service.ts` | 上下文检索 |
| `ContextLifecycleEngine` | `core/src/context-lifecycle-engine.ts` | 上下文生命周期 |
| `ProjectBrainService` | `core/src/project-brain-service.ts` | 项目知识库 |
| `ProjectBrainRetrievalService` | `core/src/project-brain-retrieval-service.ts` | brain 检索 |
| `ProjectBrainEmbeddingPort` | `core/src/project-brain-embedding-port.ts` | embedding 抽象 |
| `ProjectBrainVectorIndexPort` | `core/src/project-brain-vector-index-port.ts` | 向量索引抽象 |
| `ProjectBrainChunkingPolicy` | `core/src/project-brain-chunking-policy.ts` | chunk 策略 |
| `ProjectBrainIndexService` + `IndexWorker` | `core/src/project-brain-index-service.ts` | 索引构建 |
| `ReferenceBundleService` + `ReferenceIndexService` | `core/src/reference-bundle-service.ts` | reference bundle |
| `ProjectContextWriter` + `ProjectContextDeliveryService` | `core/src/project-context-*.ts` | 上下文写入 / 分发 |

**已能做的**：
- 项目级知识库 + embedding + Qdrant 向量索引
- 任务上下文自动采集 / 物化 / 检索
- 项目 brain bootstrap / doctor / automation policy

### 2.6 资源层

| 服务 / 概念 | 文件 | 职责 |
|---|---|---|
| `HostResourcePort` | `core/src/host-resource-port.ts` | CPU / 内存 / swap / load 快照抽象 |
| `os-host-resource-port` | `adapters-host/src/os-host-resource-port.ts` | OS 实际读取 |
| `runtime-usage` | `contracts/src/coordination-*.ts` | runtime 用量上报 |
| `ResourceUtilization` (host-resource snapshot) | 同上 | 资源利用率 |

**已能做的**：
- 任何 runtime host 上报资源快照
- 任务运行时收集 usage
- coord scorecard 用 usage 评分

### 2.7 联邦与跨节点层

| 服务 / 概念 | 文件 | 职责 |
|---|---|---|
| `FederationServices` | `core/src/federation-services.ts` | 顶层聚合 |
| `ArtifactService` | 同上 | artifact（5MB 上限 / sha256 校验） |
| `MemoryService` | 同上 | 跨节点记忆 |
| `RuntimeNodeCredentialService` | 同上 | 节点凭证（token hash / scope / 旋转） |
| `MergeProposalService` | 同上 | merge 提议 |
| `RuntimeNodeRegistryService` | `core/src/runtime-node-registry-service.ts` | 节点注册 |
| `RuntimeTargetService` | `core/src/runtime-target-service.ts` | runtime target 解析 |

**已能做的**：
- artifact 上传 / 校验 / 共享
- 跨节点记忆查询
- 节点凭证签发 / 验证 / 旋转 / 撤销
- merge proposal 创建 / 审批 / 落地
- 跨节点任务派发

### 2.8 任务生命周期层

| 服务 / 概念 | 文件 | 职责 |
|---|---|---|
| `TaskService` | `core/src/task-service.ts` | 任务 CRUD |
| `TaskLifecycleService` | `core/src/task-lifecycle-service.ts` | 任务生命周期 |
| `TaskStageService` | `core/src/task-stage-service.ts` | 阶段 |
| `TaskApprovalService` | `core/src/task-approval-service.ts` | 审批 |
| `TaskConversationService` | `core/src/task-conversation-service.ts` | 任务-对话 |
| `TaskContextBindingService` | `core/src/task-context-binding-service.ts` | 任务-上下文绑定 |
| `TaskBrainBindingService` | `core/src/task-brain-binding-service.ts` | 任务-brain 绑定 |
| `TaskAuthorityService` | `core/src/task-authority-service.ts` | 任务授权 |
| `TaskCraftsmanService` | `core/src/task-craftsman-service.ts` | 任务-工人 |
| `TaskInboundService` | `core/src/task-inbound-service.ts` | 任务入站 |
| `TaskParticipationService` | `core/src/task-participation-service.ts` | 参与关系 |
| `TaskRecoveryService` | `core/src/task-recovery-service.ts` | 任务恢复 |
| `TaskWorktreeService` | `core/src/task-worktree-service.ts` | worktree 管理 |
| `TaskBroadcastService` | `core/src/task-broadcast-service.ts` | 广播 |
| `TaskCoreSupport` | `core/src/task-core-support.ts` | 支持工具 |
| `TaskLifecycleSupport` | `core/src/task-lifecycle-support.ts` | 生命周期支持 |
| `TaskStageSupport` | `core/src/task-stage-support.ts` | 阶段支持 |
| `TemplateAuthoringService` | `core/src/template-authoring-service.ts` | 模板创作 |
| `OrchestratorDirectCreateService` | `core/src/orchestrator-direct-create-service.ts` | 直创 |

**已能做的**：
- 任务从模板创建（DAG）
- 阶段推进 + 审批门
- 任务-上下文绑定（自动）
- 任务恢复（崩溃恢复）
- worktree 隔离
- 跨节点任务广播

### 2.9 用户 / 权限 / 通知

| 服务 / 概念 | 文件 | 职责 |
|---|---|---|
| `HumanAccountService` | `core/src/human-account-service.ts` | 人类账户 |
| `PermissionService` | `core/src/permission-service.ts` | 权限决策 |
| `InboxService` | `core/src/inbox-service.ts` | 收件箱 |
| `NotificationDispatcher` | `core/src/notification-dispatcher.ts` | 通知分发 |
| `LiveSessionStore` | `core/src/live-session-store.ts` | 实时 session |

**已能做的**：
- 人类账户 CRUD
- 权限策略决策
- inbox 通知收集
- 多渠道通知分发
- 实时 session 跟踪

### 2.10 现有 IM 入口（**部分**）

| 服务 / 概念 | 文件 | 职责 |
|---|---|---|
| `CcConnectManagementService` | `core/src/cc-connect-management-service.ts` | cc-connect 管理 |
| `CcConnectInspectionService` | `core/src/cc-connect-inspection-service.ts` | cc-connect 探查 |
| `IMPorts` | `core/src/im-ports.ts` | IM 抽象端口 |
| `TaskParticipationServiceCcConnect` | `core/src/task-participation-service-cc-connect.test.ts` | cc-connect 任务参与 |
| `DashboardQueryService` | `core/src/dashboard-query-service.ts` | Dashboard 查询 |
| `InboxService` | 同上 | 收件箱 |

**已能做的**：
- cc-connect bridge 启动 / 关闭 / 状态查询
- IM 抽象端口定义
- Dashboard 是 §2 红线规定的人类入口（除了人类确认动作）

## 3. dsh-matrix-connector 的真实位置

```
       上层（人类入口 / Entry Adapter）
┌────────────┬─────────────┬──────────────┬─────────────┐
│ Dashboard  │ cc-connect  │ REST / CLI   │ dsh-matrix- │
│ (web UI)   │ (Go bridge) │ (programmatic)│ connector  │ ← 本次
│ 人类直接 │  Discord    │  agent 主入口  │  Matrix     │
└────────────┴─────────────┴──────────────┴─────────────┘
                          ↓ ↓ ↓
┌──────────────────────────────────────────────────────────┐
│ Agora Core（组织化 OS 核心）                            │
│  citizen / membership / team / attention / coordination  │
│  a2a / context / brain / federation / runtime-registry  │
│  task / approval / stage / permission / inbox / notif    │
└──────────────────────────────────────────────────────────┘
                          ↓ ↓ ↓
┌──────────────────────────────────────────────────────────┐
│ Runtime / Craftsman adapters                            │
│  openclaw / host / craftsman / materialization / obsidian│
└──────────────────────────────────────────────────────────┘
```

## 4. 与旧版"dsh-matrix-entry-adapter-v1"的根本差异

| 维度 | 旧版（v1，已废弃） | 新版 |
|---|---|---|
| 前提 | "agora 对 matrix 零代码 = 空白画布" | "agora Core 已有 90% 能力，缺的是 IM 入口" |
| v0.1 范围 | "跑通一条消息 Element→agora→Agent→Element" | "matrix 房间看见 citizen / 触发派发 / 审阅工件" |
| cc-connect | "矩阵场景出局" | "矩阵场景与 cc-connect 平级，是第二个 IM 入口实现" |
| 双中央 | "agora 中央 + matrix 中央正交" | "对，但 agora 中央是 Core 组织化 OS，matrix 是入口" |

## 5. §1 红线验证

| §1 要求 | 通过情况 |
|---|---|
| 三层口径明确 | ✅ dsh-matrix-connector 是 entry adapter |
| packages/core 不写死 IM 名 | ✅ Core 不动，matrix 是新的 IM 入口实现 |
| provider-specific 数据只能 adapter 状态 | ✅ mxid 只在 connector 内部 |
| apps/server 不承载核心业务 | ✅ server 不变 |