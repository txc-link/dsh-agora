# 05 — v1.0 范围：matrix 房间 = agent 组织作战室

## 1. 一句话定义

v1.0 让 matrix 房间成为 **agent 组织的作战室**——多 agent 在同一房间协同，context 上下文自动流入，资源状态实时面板，人类审批门嵌入 room。

## 2. v1.0 能力清单（v0.2 基础上增量）

### 2.1 多 agent 协同（A2A in room）

- 每个 citizen 是房间的虚拟"成员"（visual representation）
- A2A message 在 room 里可见（agent 互相通信，room 围观）
- coordination run 在 room 里实时进度
- controller agent 调度 → room 看到调度决策

### 2.2 Attention routing 进 room

- room 顶部固定"project_map" widget（来自 AttentionRoutingService）
- task 创建时自动调用 `buildPlanAsync` → room 显示 focus references
- context 流随 task 推进变化（project_map → focus → supporting）

### 2.3 Host resource 实时面板

- 房间侧边栏 / 顶部面板显示：
  - 当前节点 CPU / 内存使用
  - 每个 citizen 当前任务数
  - 每个 citizen 资源占用（runtime_usage）

### 2.4 Merge proposal 审批

- matrix room 收到 merge proposal 通知
- matrix room 显示 approve / reject 按钮（widget / button callback）
- **必须 Dashboard 登录态才能批准**（§2 红线）→ matrix 只发起 / 通知，不能 fake reviewer

### 2.5 matrix widget / interactive button

- matrix widget URL registration（Element 支持）
- 房间内按钮触发回调 → agora 中央 REST
- 回调结果回房间

### 2.6 长期任务状态订阅

- context harvest 跨任务聚合 → 房间侧栏
- 长任务（>1h）房间固定面板显示进度

## 3. v1.0 严格不做

| 不做 | 推到 |
|---|---|
| voice / STT | 不做（matrix 不适合） |
| E2EE | 评估中 |
| matrix 中央联邦 | 不做（单 homeserver） |
| 跨 homeserver message | 不做 |

## 4. v1.0 工作量估算

| 任务 | 工作日 |
|---|---|
| 多 bot 同房间协调（每个 citizen 一个 bot） | 4 |
| A2A 消息在 room 可见 | 3 |
| attention routing widget | 3 |
| host resource 面板 | 2 |
| merge proposal 审批（matrix widget + Dashboard 联动） | 4 |
| matrix widget URL + button callback | 3 |
| 长期任务订阅 | 2 |
| 单测 + smoke + e2e | 6 |
| README + walkthrough + 培训视频 | 3 |
| 总计 | **30 工作日 ≈ 16 周（v0.2 之后）** |

## 5. v1.0 验收

1. 多 agent 协同 smoke 跑通
2. attention routing 在房间可见
3. host resource 面板实时
4. merge proposal 从发起 → Dashboard 审批 → 落地全程在 room 可见
5. README 含完整使用手册

## 6. v1.0 风险

| 风险 | 缓解 |
|---|---|
| 多 bot 同步问题 | bot 之间通过 agora 中央协调，不直接通信 |
| matrix widget 安全 | widget URL 白名单 + state token |
| human approval 漏洞 | §2 红线强制 Dashboard 登录态 |
| 性能（room 消息风暴） | 流速控制 + 聚合显示 |

---

**v1.0 暂未详细讨论，本节为 outline**，完整设计在 v0.2 跑通后启动。

## 7. 与最终目标的对应

| 用户最终目标 | v1.0 实现 |
|---|---|
| agent 有组织 | ✅ 多公民同一房间（房间即组织） |
| 有架构 | ✅ controller / craftsman / citizen 角色在房间可见 |
| 有计划 | ✅ attention routing widget |
| 主动协同 | ✅ A2A + coordination run 在房间 |
| 受控 | ✅ merge proposal 审批门 |
| 完成长期工作 | ✅ 长期任务订阅 + context harvest 聚合 |
| 管理资源 | ✅ host resource 面板 |