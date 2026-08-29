# Findings: Org-Aware Task Claiming

> 日期: 2026-08-30

## 调研发现

### 1. 现有任务状态机
- `TaskLifecycleService` 管理任务生命周期 (state 机)
- `TaskService` 任务 CRUD
- 任务 state 已有 pending/active/complete 等，但**没有 claim 状态**

### 2. 现有职责概念
- `RolePackService` — role pack 管理
- `CitizenService` — citizen 有 skills_ref (技能引用)
- `TeamMemberKind` — controller/craftsman/citizen 分类

### 3. 现有轮询/定时
- `TaskRecoveryService` 有 scan-stale 机制（可参考定时模式）
- `ContextHarvestService` 有定时采集

### 4. 现有 IM 广播
- `TaskBroadcastService` 已有事件广播 → 群发复用

## 关键设计决策

### D1: Claim 状态放哪
- 方案 A: 加到 TaskRecord 字段 (claim_status / claimed_by)
- 方案 B: 独立 TaskClaimRepository (task_id → claim)
- **选 B**: 不污染 Task 主状态机，claim 是"认领动作"不是任务状态；释放/超时可独立管理

### D2: 职责匹配基于什么
- 方案 A: role 字符串相等
- 方案 B: skills 交集
- **选 B**: citizen.skills_ref ↔ 任务要求的 skills (task.skills 或 template 的 required_skills)

### D3: 轮询放哪
- 方案 A: core 内 setInterval
- 方案 B: 外部 cron 调 CLI
- **选 A**: core 内 ResidentAgentPoller，可配置间隔；CLI 也可手动触发 `agora task claimable`

### D4 (实施中发现): claimable 的状态过滤
- 现实: `agora create` 新任务直接进 `active`（stage=discuss），不存在滞留的 `created`
- **修正**: claimable = state ∈ {created, active} 且无 claimed 记录
- tasks 表无 controller 列 → claim 记录即所有权标记（与 D1 自洽）
- 教训: 状态假设必须对着真实生命周期冒烟验证，不能只看 schema 枚举
