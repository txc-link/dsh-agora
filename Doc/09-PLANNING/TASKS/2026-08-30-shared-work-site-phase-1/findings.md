# Phase 1 — WorkSite 抽象 + URI 协议 (Findings / 调研现状)

> 任务ID: `2026-08-30-shared-work-site-phase-1`
> 调研日期: 2026-08-30
> 调研人: turn 60 主线

---

## 0. 调研目的

按 turn 45-46 lesson "FIRST investigate Core state before claiming something needs Core changes" — Phase 1 在改 Core 之前必须搞清楚:

1. Core 真实路径在哪
2. Core 现有抽象模式 (service / port)
3. Task 模型在 Core 怎么表达
4. URI / identifier 现有惯例
5. §1 边界当前是否过红线

---

## 1. 仓库真实结构

| 路径 | 角色 |
|---|---|
| `agora-ts/` | TS monorepo (npm workspaces) |
| `agora-ts/packages/core/` | **Core 真实路径** (我之前 task_plan 写 "packages/core" 不精确) |
| `agora-ts/packages/contracts/` | DTOs / interfaces / 数据契约 |
| `agora-ts/packages/{config,db,testing}/` | 横切关注点 |
| `agora-ts/packages/adapters-*/` | 9 个 adapter (brain, cc-connect, craftsman, discord, host, materialization, obsidian, openclaw, runtime) |
| `agora-ts/apps/{cli,server}/` | composition root |
| `agora-ts/scripts/core-boundary-gate.ts` | **§1 边界自动化 gate!** |
| `dashboard/` | 前端 (另一个仓) |
| `extensions/agora-plugin/` | plugin/bridge |
| `agora-ai-brain/` | 旧 Python legacy (§7 不动) |

**Phase 1 改动范围**: `agora-ts/packages/core/src/worksite/` (新增)

---

## 2. Core 抽象模式 (port + service)

### 2.1 文件组织

- `src/*.ts` — service / port / 抽象
- `src/*.test.ts` — 测试 (跟 source 同目录, **co-location**)
- `src/enums.ts` — 公共枚举 (TaskState 等)
- `src/index.ts` — barrel 导出所有 public API

### 2.2 Port 模式

Core 通过 Port 接口抽象外部依赖, 不直接持有 adapter 实现:

```ts
// 已有 ports
IMMessagingPort + IMProvisioningPort  ← IM 抽象
AgentRuntimePort                       ← Runtime 抽象
CraftsmanInputPort + ProbePort + TailPort  ← Craftsman 抽象
RuntimeRecoveryPort + RuntimeThreadMessageRouter
HostResourcePort + LiveSessionStore
TaskBrainWorkspacePort + TaskBrainBindingService
```

**对 Phase 1 影响**: WorkSiteResolver 应该**也是** Core 内的 port 模式
- `WorksiteResolver` (interface)
- `TaskResolver implements WorksiteResolver` (唯一具体实现)
- 5 个 stub resolver (thread / commit / watch / workspace / session) — Phase 1 只暴露 interface

### 2.3 Service 模式

每个 service 一个文件, 通过 `Options` 注入依赖:

```ts
export interface TaskServiceOptions {
  repositories: { task, flowLog, ... };
  imMessagingPort?: IMMessagingPort;
  ...
}
```

**对 Phase 1 影响**: Phase 1 不开 service (太重), 只暴露 type + resolver interface + Task resolver。Service 留给 Phase 4 真项目跑通时再加。

---

## 3. Task 模型现状

### 3.1 数据契约 (在 contracts)

- `TaskRecord` — Task 完整数据模型
- `CreateTaskRequestDto` — 创建入参
- `ITaskRepository` — 仓储接口 (`get` / `create` / `update`)
- `TaskLocaleDto`

### 3.2 Core service (15+)

- `task-service.ts` — 主 service
- `task-approval-service.ts` — approval flow
- `task-authority-service.ts` — 权限
- `task-brain-binding-service.ts` — brain 绑定
- `task-broadcast-service.ts` — 事件广播
- `task-context-binding-service.ts` — context 绑定
- `task-conversation-service.ts` — 对话流
- `task-craftsman-service.ts` — craftsman 调度
- `task-inbound-service.ts` — 入站
- `task-lifecycle-service.ts` — 生命周期 (state machine)
- `task-participant-sync-service.ts` — 参与人同步
- `task-recovery-service.ts` — 恢复
- `task-service-runtime.ts` — runtime 交互
- `task-service-types.ts` — Options DTO
- `task-stage-service.ts` — stage 推进 (state transitions)

### 3.3 状态机

- `TaskState` enum 在 `enums.ts`
- 转换在 `task-stage-service.ts`, 通过 `validateTransition(from, to)` 控制
- `inactiveTaskProbe` + `observeCraftsmanExecutions` — stuck 检测 (turn 25/35 提到的核心能力, 已经在 Core)

### 3.4 Task ID 现状

```ts
export function defaultTaskIdGenerator() {
  return `OC-${Date.now()}`;
}
```

**对 Phase 1 影响**:
- 现在 Task ID 是 `OC-<timestamp>`, 不是 URI
- Phase 1 加 URI: `agora://task/OC-<timestamp>` 是 wrapper, 不是替代 — ID 内部仍然是 OC-, URI 只是引用层
- §7 高频重构期: 不改 OC- 格式, 只加 URI 引用层

---

## 4. URI / Identifier 现有惯例

| 现有 | 类型 | 字段 |
|---|---|---|
| `OC-1234567890` | Task ID | `OC-${Date.now()}` |
| `!EqHMFbmSZcoiIXEEKe:agent-hub.local` | Matrix Room ID | 第三方协议 |
| `@dsh-bridge-node-a:agent-hub.local` | Matrix User ID | 第三方协议 |
| `OC-${Date.now()}` | Craftsman Session ID | 内部 |
| `${type}.${shortid}` | Artifact ID | 内部 |

**没有任何 `agora://` URI scheme 现状** — Phase 1 是新设计。

**对 Phase 1 影响**:
- Phase 1 设计 URI = 新加, 不破坏现有
- WorkSite 抽象的 `id` 字段是 string — 可以装任何现有 ID (OC-..., !room:server, @user:server)
- §7 不留 compat, 直接加新

---

## 5. §1 边界当前状态 — 自动化 gate

### 5.1 `gate:core-architecture` 脚本

`agora-ts/scripts/core-boundary-gate.ts` — 已经**自动化**检查 §1 边界:

```bash
gate:core-db-boundary        # 检查 core 不直接 import db
gate:core-no-legacy-fallback # 检查没有 legacy fallback
gate:core-architecture       # 跑全部
gate:barrel-governance       # 检查 barrel 导出合规
check (CI)                   # gate + lint + build + typecheck + test
```

**对 Phase 1 影响**:
- Phase 1 完成后**必须** `npm run gate:core-architecture` 全绿
- WorkSite 抽象在 `packages/core/src/worksite/` — 不 import db, 不写 fallback
- Barrel export 走 `packages/core/src/index.ts` 加 `export ... from './worksite/...'`

### 5.2 现有 Core 边界观察

- ✅ `IMMessagingPort` / `IMProvisioningPort` — IM 抽象, adapter 在 `adapters-cc-connect/`, `adapters-discord/`, `adapters-openclaw/` — §1 OK
- ✅ `AgentRuntimePort` — Runtime 抽象, implementation 在 `adapters-runtime/`
- ✅ `CraftsmanInputPort` / `ProbePort` / `TailPort` — Craftsman 抽象, implementation 在 `adapters-craftsman/`
- 🟡 `task-participation-service-cc-connect.test.ts` — **test 文件**, 文件名含 cc-connect 是测试**引用** cc-connect 行为, **不违反** §1 (test 是 cross-cutting 验证, 不是 Core 业务规则)
- ✅ Core 整体**符合** §1, Phase 1 不会突破

---

## 6. 测试现状

### 6.1 测试框架

- vitest, 配置在 `agora-ts/vitest.config.ts`
- Co-location: `*.test.ts` 跟 source 同目录
- 跑测试: `cd agora-ts && npm test` (单一入口, 串行)
- 或单 package: `cd agora-ts/packages/core && npx vitest run`

### 6.2 现有 Core 测试量

Co-located `.test.ts` 文件 70+ (services 几乎都有测试)

**对 Phase 1 影响**:
- Phase 1 必须 `*.test.ts` co-location
- TDD RED-GREEN 节奏
- 现有测试**全部不回归** — `npm test` 跑通

---

## 7. phase 1 设计调整 (基于现状)

### 7.1 task_plan 草案里要修的事实

| 我以为 | 实际 | 调整 |
|---|---|---|
| Core 简陋, 大量空缺 | Core 15+ service 完整 | Phase 1 不造轮子, 只加 WorkSite + URI |
| 需要新 service | 用现有 TaskRecord + ITaskRepository | Phase 1 不开新 service |
| URI scheme 新设计 | URI 全新, ID 内部不变 | URI 是 wrapper layer, ID 仍是 OC- |
| 6 个 resolver 都做 | 只 1 个 TaskResolver + 5 stub | Phase 1 只演示挂载 |

### 7.2 Phase 1 实际新增文件

```
packages/core/src/worksite/
├── uri.ts                       # parseWorksiteUri + formatWorksiteUri + isValidWorksiteUri
├── types.ts                     # WorkSite union (6 个 type 都是 stub)
├── resolver.ts                  # WorksiteResolver interface + registry
├── task-resolver.ts             # TaskWorksiteResolver (唯一具体实现)
├── uri.test.ts                  # URI parser unit test
├── resolver.test.ts             # registry unit test
├── task-resolver.test.ts        # Task resolver unit test
└── index.ts                     # barrel exports

# 加 export 在 packages/core/src/index.ts
```

### 7.3 关键决策

- **URI scheme**: `agora://<type>/<id>` (草案 U1 等确认)
- **WorkSite type union**: 6 个 type 都定义, 但只有 Task resolver 实现
- **Stub resolver**: 5 个 (Thread/Commit/Watch/Workspace/Session) — Phase 1 抛 `NotImplementedError`, Phase 2-4 接入
- **§1 检查点**:
  - `worksite/` 内 grep `matrix|discord|openclaw|sentinel` 必须 0 命中 (除注释)
  - 不 import db
  - 不写 fallback

---

## 8. 风险再评估

| 风险 | 缓解 |
|---|---|
| Core 抽象写死平台名 | grep 检查; review 时严格执行 |
| URI scheme 设计后续要改 | §7 允许改, 改时同时更新所有引用 |
| WorkSite union 6 type 加新 type 困难 | §1.5 接受改 union, §7 不留 compat |
| TaskResolver 跟 Task 模型耦合 | TaskResolver 只 `taskRepo.get(id)`, 不写 |
| 5 个 stub resolver 误导 | interface 文档明确写"Phase X 实现" |
| barrel export 漏了 gate 拦截 | 加 export 后跑 `gate:barrel-governance` |

---

## 9. 关联

- task_plan: `task_plan.md`
- 父级 architecture: `Doc/03-ARCHITECTURE/2026-08-29-shared-work-site/01-worksite-abstraction.md`
- Core gate: `agora-ts/scripts/core-boundary-gate.ts`
- 现有 Task 模型: `agora-ts/packages/core/src/task-service-types.ts`
- 现有 URI 惯例: `agora-ts/packages/core/src/task-service-types.ts:defaultTaskIdGenerator`

---

> §3 — 研究发现已落, 待开 worktree + 写代码
> §1.5 — 设计已按现状调整, 不重复造轮子