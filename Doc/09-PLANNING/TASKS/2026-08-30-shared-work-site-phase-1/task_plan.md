# Phase 1 — WorkSite 抽象 + URI 协议 (Core 内纯抽象)

> 任务ID: `2026-08-30-shared-work-site-phase-1`
> 父级规划: `Doc/03-ARCHITECTURE/2026-08-29-shared-work-site/`
> 锁定时间: turn 59 (用户: "全做, 想办法做好, 目标定死, 方案技术都可以调整")
> 起跑: turn 60 (用户: "开搞")

---

## 0. 起跑检查

| 项 | 状态 |
|---|---|
| master HEAD | `d8d5fce` (干净) |
| 现存 worktree | `feat/dsh-matrix-connector` (`e4863af`), 活跃 — 不动 |
| 现存 detached | `dsh-agora-p0-test` (`ea8b434`) — carry-over, 不在本任务范围 |
| 父级架构文档 | `Doc/03-ARCHITECTURE/2026-08-29-shared-work-site/{README,01-worksite-abstraction,02-uri-protocol,03-deep-reference-pull,04-agent-borrow,undecided}.md` |
| §1 / §1.5 / §2 / §3 / §4 约束 | 见各 § 节 (下文) |

---

## 1. Phase 1 目标 (锁定不变)

**Phase 1 唯一目标**: 在 `packages/core` 内加 **WorkSite 抽象** + **URI 协议**, 让任何 adapter (matrix / sentinel / git / 未来加的任何 IM) 都能挂上, 表达"一个 work surface 的引用"。

**效果目标**:
- `agora://<type>/<id>` URI 是 Core 内合法 token
- `WorkSite` 是 Core 内的 union type, 6 type 都是 projection
- `resolveWorksite(uri) → WorkSite` 是 Core 内可调用的接口
- 1 个 adapter (Task) 实现 + 演示挂载
- Phase 2/3/4 都能基于此扩展

**§1 边界 (硬约束)**:
- Core 内 WorkSite 不写 matrix / discord / sentinel 平台名
- Core 内 URI scheme **只** 是 `agora://`, 不暴露具体 IM 协议
- 任何 IM / Runtime / Craftsman **只是** Core 抽象的 adapter / projection
- 移除 matrix 不变 — §1 检验通过

---

## 2. §1.5 第一性原理约束

- ✅ 不引入兼容层, 不留旧字段 (按 §7 高频重构期)
- ✅ 不做 Phase 2/3/4 的事 — 串行, 严格
- ✅ 不写 dashboard UI (那是 Phase 3 / 另一个仓)
- ✅ 不改 matrix-connector 内部 (那是 Phase 2)
- ✅ 不"先实现 4 个 type 的 resolver" — 1 个 Task resolver 就够演示, 其余是 stub interface

**最短路径**: Core 内加 `type.ts` + `uri.ts` + `resolver.ts` 3 个文件 + Task resolver 1 个 + 测试。

---

## 3. §3 强制约束 (本任务适用)

### 3.1 Worktree 规则
- ✅ 必须开新 worktree: `feat-shared-work-site-phase-1`
- ✅ 不在 master 直接改 Core
- ✅ worktree 路径必须在 progress.md 记录

### 3.2 SSoT 规则
- SSoT 是 `docs/Agora-实施排期-Agora-TS.md` (本仓是 `Doc/Agora-实施排期-Agora-TS.md`)
- Phase 1 完成后必须回写 SSoT
- SSoT 与本 task_plan 双向绑定

### 3.3 讨论落地规则
- 父级架构文档已落 (turn 55-59) — 本 Phase 1 不新增 §1-5 子话题
- 但 Phase 1 实现中发现的新事实必须回写 `Doc/03-ARCHITECTURE/2026-08-29-shared-work-site/01-worksite-abstraction.md`

### 3.4 Hygiene
- ❌ 不动 `.worktrees/feat-dsh-matrix-connector/`
- ❌ 不动 `.worktrees/feat-dsh-agora/` (detached, carry-over)
- ❌ 不清理 `.audit/` (carry-over, 别的任务)

---

## 4. §2 Entry Surface 约束

- ❌ Phase 1 **不暴露** CLI 命令 — CLI 是 adapter 层的事
- ❌ Phase 1 **不暴露** REST 端点 — REST 是 composition root 的事
- ❌ Phase 1 **不暴露** Dashboard UI
- ✅ Phase 1 **只暴露**: Core 内部 `resolveWorksite(uri)` + WorkSite type union + URI parser
- ✅ 验证通过 `packages/core/src/__tests__/`

---

## 5. §4 Mandatory Completion Loop (TDD)

### 5.1 TDD 顺序 (red→green→smoke→walkthrough)
1. **RED**: 先写 failing test (URI parser + WorkSite resolver 测试)
2. **GREEN**: 最小实现让测试过
3. **REFACTOR**: 清理, 不引入兼容层
4. **SMOKE**: 跑 `packages/core` 全部现有测试, 不回归
5. **WALKTHROUGH**: 写 `Doc/10-WALKTHROUGH/2026-08-30-shared-work-site-phase-1.md`

### 5.2 测试要求
- ✅ URI parser unit test (合法 / 非法 scheme / 类型校验)
- ✅ WorkSite resolver unit test (6 个 type 各 1 case)
- ✅ Task resolver integration test (从 agora Task 拿)
- ✅ 现有 `packages/core` 测试**全部不回归**

### 5.3 不做的事
- ❌ 不写 e2e Discord 冒烟 — Phase 1 是 Core 内, 无 IM 接触
- ❌ 不写 scenario script — Phase 1 太底层, scenario 是 adapter 层

---

## 6. 实施步骤 (顺序, 串行)

### Step 0 — 准备工作 (本 task_plan + findings)
- [x] 父级架构文档落盘 (turn 55-59)
- [ ] `task_plan.md` 写完 (本步)
- [ ] `findings.md` 读 Core 现状
- [ ] `progress.md` 起骨架

### Step 1 — 开 worktree + 验证 baseline
- [ ] `git worktree add ../dsh-agora-shared-work-site-p1 -b feat/shared-work-site-phase-1`
- [ ] 跑 baseline: `cd packages/core && pnpm test` (确认现在全绿)
- [ ] baseline 绿 → 写 progress.md step 1 ✅

### Step 2 — RED: 写 failing tests
- [ ] `packages/core/src/worksite/__tests__/uri.test.ts` — URI parser 测试
- [ ] `packages/core/src/worksite/__tests__/resolver.test.ts` — resolver 测试
- [ ] `packages/core/src/worksite/__tests__/task-resolver.test.ts` — Task resolver 测试
- [ ] 跑 test → 全 RED
- [ ] 写 progress.md step 2 ✅

### Step 3 — GREEN: 最小实现
- [ ] `packages/core/src/worksite/uri.ts` — `parseWorksiteUri(s)` + `formatWorksiteUri(type, id)` + `isValidWorksiteUri(s)`
- [ ] `packages/core/src/worksite/types.ts` — `WorkSite` union type (6 个 type 都是 `{ type, id, refs }`)
- [ ] `packages/core/src/worksite/resolver.ts` — `resolveWorksite(uri, ctx)` 接口 + registry
- [ ] `packages/core/src/worksite/task-resolver.ts` — Task type 的 resolver (从 agora Task 拿)
- [ ] 跑 test → 全 GREEN
- [ ] 跑 baseline → 不回归
- [ ] 写 progress.md step 3 ✅

### Step 4 — REFACTOR + 文档
- [ ] 清理 URI parser 的边界 case
- [ ] 写 `Doc/10-WALKTHROUGH/2026-08-30-shared-work-site-phase-1.md`
- [ ] 回写 SSoT (`Doc/Agora-实施排期-Agora-TS.md` + 本 task_plan 双向绑定)
- [ ] 回写 `01-worksite-abstraction.md` 新增"已实现"小节
- [ ] 写 progress.md step 4 ✅

### Step 5 — Commit + PR
- [ ] `git commit -m "feat(core): add WorkSite abstraction + URI protocol (Phase 1)"`
- [ ] push to `feat/shared-work-site-phase-1`
- [ ] (可选) PR to master — 取决于你后续指示

---

## 7. 不做的事清单 (锁定)

- ❌ 不实现 6 个 type 的 resolver (Phase 1 只 Task 1 个)
- ❌ 不改 matrix-connector 内部 (Phase 2)
- ❌ 不加 Dashboard UI (Phase 3)
- ❌ 不加 borrow 协议 (Phase 3)
- ❌ 不加 @pull 解析 (Phase 2)
- ❌ 不加 CLI / REST 入口 (§2)
- ❌ 不写 Discord 冒烟 (无 IM 接触)
- ❌ 不清理 .audit / detached HEAD (别的任务)
- ❌ 不动 feat-dsh-matrix-connector worktree

---

## 8. 风险与缓解

| 风险 | 缓解 |
|---|---|
| Core 抽象写得太具体, 暴露平台名 | §1 检查: 移除 matrix 仍成立; review 时 grep `matrix` / `discord` / `sentinel` 在新文件必须为 0 命中 (除了注释) |
| URI scheme 设计错误 (后续要改) | §7 高频重构期: 允许改, 但改时同时更新所有引用 |
| Task resolver 跟现有 Task model 耦合太紧 | Task resolver 只读 `ctx.tasks.get(id)`, 不写 |
| WorkSite type union 太死, 加 type 难 | §1.5 接受加 type 时改 union; §7 不留 compat |

---

## 9. 验收口径

- [ ] `pnpm -C packages/core test` 全绿
- [ ] 新增测试覆盖 URI parser + resolver + Task resolver
- [ ] 6 个 WorkSite type 在 union 内 (即使其余 5 个是 stub)
- [ ] `agora://` 是唯一合法 scheme
- [ ] Walkthrough 文档落 `Doc/10-WALKTHROUGH/`
- [ ] SSoT 回写完成
- [ ] master 不污染 — 全部改动在 worktree 内

---

## 10. 后续 Phase 衔接 (备忘, 不在 Phase 1 实现)

- Phase 2: matrix-connector 改 1 个文件 (parseMessageContext), 加 `event.context.worksites` pull 字段
- Phase 3: Core 加 borrow_* type, Dashboard 加 approve UI
- Phase 4: 真项目跑通, end-to-end walkthrough

---

## 11. 关联

- 父级 architecture: `Doc/03-ARCHITECTURE/2026-08-29-shared-work-site/README.md`
- Tutti·VM brainstorm: `Doc/09-PLANNING/TASKS/2026-08-29-tutti-vm-paradigm-review/`
- Carry-over ecosystem probe: `Doc/09-PLANNING/TASKS/2026-08-29-dsh-ecosystem-probe/`
- SSoT: `Doc/Agora-实施排期-Agora-TS.md` (待回写)

---

> §3 — 每个阶段前读取本文件, 每个阶段后更新 progress.md
> §1.5 — 不做的事清单见 §7