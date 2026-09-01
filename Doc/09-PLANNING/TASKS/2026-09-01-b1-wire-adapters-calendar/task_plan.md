# Task Plan — B1: Wire @agora-ts/adapters-calendar to Server

**Date**: 2026-09-01 (Asia/Shanghai)
**Branch / Worktree**: `feat/agora-ts-wire-adapters-calendar` @ `/home/ailink/dsh-agora/.worktrees/agora-ts-wire-adapters-calendar`
**Source**: SSoT `Doc/Agora-实施排期-Agora-TS.md` §7 row "2026-08-31 next batch" + Backlog B1 (turn 24 closeout)
**Trigger**: CEO 收件箱实测 `/agora calendar today` → 404 (matrix-connector v0.1.1 smoke, turn 23)
**Author**: 总工
**Status**: ⏳ in_progress

---

## 0. Worktree 决策（AGENTS.md §3 §6）

- **Worktree path**: `/home/ailink/dsh-agora/.worktrees/agora-ts-wire-adapters-calendar`
- **Branch**: `feat/agora-ts-wire-adapters-calendar`
- **Base**: master @ `49992bc` (turn 25 closeout commit)
- **依据**: §6 流程 step 4 `feat/agora-ts-<能力名>` 命名；§3 默认 worktree first；主工作区干净，但跨仓事件触发的 agora-ts slice 必开 worktree

## 1. 目标

把已经在 next-batch (`e012a0c / 2e9d521 / 3da427e / b8c08cd / 9fe8dc6`) 实现并 12/12 测试通过的 `@agora-ts/adapters-calendar` + `CalendarService` **wire 到 `apps/server`**，让 `/api/calendar/today` 在公网 live agora-ts 上能返回 200。

## 2. 范围

### 2.1 In Scope（本轮做）

- ✅ `apps/server/src/composition.ts` 加 `CalendarService` + `RadicaleClient`（如果需要）+ adapter 注册
- ✅ REST routes: `GET /api/calendar/today`、`GET /api/calendar/conflicts`、`POST /api/calendar/reports/:kind`（按 next-batch §7 row 117 计划）
- ✅ Server route 单测（in-memory fake repo / service）
- ✅ 隔离 HOME 真实 smoke（隔离实例，curl `/api/calendar/today` 应返 200 而非 404）
- ✅ live 部署后冒烟
- ✅ SSoT §1 + §7 回写
- ✅ commit + merge + push

### 2.2 Out of Scope（本次不做）

- ❌ Markdown artifact route → B2
- ❌ Information policy + fish-speech 配置 → B3
- ❌ LiveKit 部署 → B4
- ❌ calendar-service 业务逻辑改动（next-batch 已完成 + 12/12 测试通过，**wire-only**）

## 3. 已知事实

### 3.1 现状（next-batch 已交付）

来源 SSoT §7 row 117:
- 包 `@agora-ts/adapters-calendar`（iCal 解析、冲突检测、晨报晚检生成器 + Radicale 客户端）
- `CalendarService`（listToday/conflicts/morningReport/eveningReport）
- 12/12 测试通过（next-batch 实测）
- **但未 wire 到 `apps/server`** ← B1 要补的 gap

### 3.2 已知缺口

- `apps/server/src/composition.ts` 可能没有 `CalendarService` 注册
- REST routes `/api/calendar/*` 可能没挂
- smoke 现状：公网 `/api/calendar/today` → 404

## 4. 执行步骤

1. ⏳ 探索 worktree 内现状（composition.ts + calendar-service.ts + adapters-calendar package + 现有 routes）
2. ⏳ 写 task_plan.md（本文件）→ 已完成
3. ⏳ 写 findings.md（探索发现）
4. ⏳ TDD 红：写 server route test（server composition inject CalendarService，expect `/api/calendar/today` 返 200 + JSON）
5. ⏳ 实现：composition wire + routes 注册
6. ⏳ TDD 绿：测试转绿
7. ⏳ 隔离 HOME 真实 smoke（隔离实例，curl 验证 3 个 endpoint）
8. ⏳ commit + merge to master + push
9. ⏳ SSoT 回写 §1 row 9 + §7 entry
10. ⏳ gm_record（wire pattern 如有可复用 SKILL）

## 5. Backlog 转交

| ID | 触发命令 | 范围 | 优先级 |
|---|---|---|---|
| B2 | `/agora doc show <id>` | Markdown artifact route `/api/artifacts/:id/markdown` | P0 |
| B3 | `/agora say` | information policy + fish-speech :8080 probe + connector 配置 | P1 |
| B4 | `/agora call join` | LiveKit SFU 部署 | P2 |

B1 完成后立刻接 B2（用户授权：挨个做，全部做完一次性部署）。

## 6. 双绑校验

- SSoT §7 entry 引用本 task_dir
- task_dir findings 引用 walkthrough
- walkthrough 引用本 task_dir

## 7. 风险 / 边界

- **R1**: CalendarService 可能依赖 Radicale server。如果 live agora-ts 没有 Radicale，calendar today 也会失败。 → smoke 时第一件事 probe Radicale 可达性；不可达则降级用 in-memory fixture（但这违反 §1.5 no-shim，先确认）。
- **R2**: composition wire 可能影响现有 route（拆 menu / 重启）。 → smoke 必须跑全套基础 endpoint 验证不退化。
- **R3**: dashboard 端 calendar UI 可能没接（next-batch §7 row 117 没明确 dashboard 实现）。 → 本轮只做 backend wire，dashboard UI 不在本范围。
