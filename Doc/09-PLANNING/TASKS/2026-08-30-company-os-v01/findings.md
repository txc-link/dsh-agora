# Findings: Company OS v0.1

## 现状审计

- `TeamService` 的既有语义是“每项目一个组织”；可表达 lead、members、responsibilities、parent，但不能表达跨项目公司、空缺岗位、任职历史和转岗。
- 现有 `CitizenService` 可复用为 Agent 身份；`ProjectMembership` 继续表达项目访问，不应代替 Employment。
- `TaskClaimService`、`ResidentAgentPoller`、`DelegateRouter`、`AgentQuestionService`、`ForumService`、ProjectBrain、Artifact 与 Mem0 adapter 已存在。
- `AgentQuestionService.assistantRef` 只是路由缝，不是第一等 EA，也没有统一 Inbox、承诺账本或请求闭环。
- Matrix connector 当前 v0.1 verbs 为 citizen/dispatch/task/artifact/brain/im/help，没有 org/team/assistant 入口。
- `apps/server` 未组合 TeamService、DelegateRouter、AgentQuestionService 或 ForumService 的 REST 路由。

## 线上证据（2026-08-30，只读）

- 中央库: projects=0、citizens=0、org_teams=0、task_claims=0、agent_questions=0、forum_posts=0、artifacts=0、tasks=12。
- node-b 仅配置一个 `default` runtime agent（general；research/coding）。
- 因而已有 S1-S6 “完成”只能解释为代码切片与冒烟完成，不能解释为公司已经运营。

## 初始设计判断

### D1: Organization 独立于 Project

公司是长期主体，项目是工作容器。`Organization` 不持有 `project_id`；项目通过后续 assignment/ownership 关联组织。

### D2: Position 与 Employment 分离

岗位先于员工存在，允许 vacancy；Employment 是 Citizen 对 Position 的有时效任职。这样才能保留组织图和历史，而不是把 agent id 写死在 Team lead/member 数组。

### D3: Team 不冒充 Company

既有 Team 保留为项目执行小组；正式 Unit/Position/Employment 成为公司 SSoT。委派路由后续以 Position 汇报链为主，Team 作为项目态投影。

### D4: EA 是组织能力，不是硬编码角色名

Position 通过 `kind=executive-assistant` 标识；`ExecutiveAssistantService` 依赖组织仓储与 Task 创建端口。具体 Agent Runtime/IM 均在 composition root 绑定。

### D5: Personal 边界不是 Company Unit

Life/Health/Companion 复用同一套治理与编排基础设施，但使用独立安全域和顶层投影；不得以 Company 子部门绕过 Consent/InformationPolicy。

### D6: Employment 绑定通用 subject ref，不反向依赖项目 Citizen

现有 Citizen 本身带强制 `project_id`，因此不能作为跨项目长期员工的唯一身份根。Employment 使用 provider-neutral `subject_kind=human|agent` + `subject_ref`；Citizen/RuntimeBinding 是项目与运行时投影。Organization 固定 `information_domain`，Unit 不允许覆盖，从模型上避免把 life/health/companion 伪装成 Company 普通部门。

## 待代码核对

- TaskService 的最小创建输入、负责人/参与者绑定方式与完成事件接入点。
- Artifact 元数据能否直接承载 decision/retrospective 类型，还是需要通用 DeliverablePolicy。
- server composition 的依赖注入形态与 CLI 命令拆分习惯。
- connector REST client 是否已有可复用通用调用方法。

## 实施后发现

- `createAssignedTask` 必须把 task template 的全部 role 绑定到 Employment 的 runtime target；只写 TaskClaim 不会使该员工进入任务 team。
- live registry 有三个不同且当前在线的初始 resident targets：`dsh:node-b:default`、`dsh:node-c:default`、`dsh:ailink-web:default`。
- Auditor 保持 vacancy，避免用兼任 Agent 伪造职责分离。
- npm registry 凭据在 Windows 与 Core host 都不存在/失效。相同 dry-run-verified 0.3.0 tarball 已从 `~/.dsh/packages/` 安装到 node-b，实际运行不被 registry 阻塞。
