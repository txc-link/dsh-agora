# Task Plan — v0.1.1 Slash Command Smoke Closeout

**Date**: 2026-09-01 (Asia/Shanghai)
**Branch**: master (本仓不切 worktree — 纯文档收口，主工作区干净，见 §0 决策)
**Author**: 总工
**Status**: ⏳ in_progress → ✅ done (本次为 closeout)

---

## 0. Worktree 决策（AGENTS.md §3）

**不开新 worktree**。理由：
1. 本次仅做**文档收口**（task_dir 三件套 + walkthrough + SSoT 回写 + gm_record），**无代码改动**。
2. `git status` 主工作区干净，无未提交改动需要隔离。
3. AGENTS.md §3 "应开 worktree" 列表中的 smoke 范畴主要指 smoke harness / 回归脚本改造；本轮是把"已通过的 smoke 结果"沉淀进文档，属于 §3 例外情况"纯文档小修 / 收口"。
4. 任何后续 **backlog 实施**（adapters-calendar wire / Markdown artifact route / information policy / LiveKit）才走 §6 流程开独立 worktree。

---

## 1. 目标

固化 matrix-connector **v0.1.1** 在 CEO 收件箱 Matrix 房间的 slash command smoke 通过节点：
- 沉淀 ✅ 5 个命令、❌ 3 个后端缺口的事实清单
- 记录"假故障"澄清（`securityBoundary` 白名单房间设计意图）
- 把 3 个 ❌ 排进 agora-ts 后端 backlog
- 回写 agora-ts SSoT 与 walkthrough
- gm_record 一条 securityBoundary 设计澄清事件

## 2. 范围

### 2.1 In Scope（本次做）

- 建 task_dir 三件套（task_plan / findings / progress）
- 写 walkthrough `Doc/10-WALKTHROUGH/2026-09-01-v011-slash-command-smoke-closeout.md`
- 回写 `Doc/Agora-实施排期-Agora-TS.md` §1 + §7
- gm_record `securityBoundary` 设计意图事件

### 2.2 Out of Scope（本次不做）

- ❌ 不实施 adapters-calendar wire 到 server（需要 worktree + §6 流程）
- ❌ 不实施 Markdown artifact 路由（同上）
- ❌ 不创建 information policy（运维 + 后端混，需要单独决策）
- ❌ 不部署 LiveKit（独立大件）
- ❌ 不修改 `.repos/dsh-matrix-connector/`（connector 仓 SSoT 由 connector 仓主人维护）
- ❌ 不修改本仓代码（本次纯文档收口）

## 3. Backlog（移交到后续 phase）

| ID | 缺口 | 命令 | 涉及仓 | 优先级 |
|---|---|---|---|---|
| B1 | `/api/calendar/today` 404 | `/agora calendar today` | agora-ts (`@agora-ts/adapters-calendar` 未 wire) | P0 |
| B2 | `/api/artifacts/:id/markdown` 路由缺失 | `/agora doc show <id>` | agora-ts (artifact markdown endpoints 未落地) | P0 |
| B3 | information policy 未建 + fish-speech 8080 可达性未确认 | `/agora say 语音测试` | agora-ts + connector 运维 | P1 |
| B4 | LiveKit 部署（Element Call 占位 token → 真 JWT） | `/agora call join` | connector 部署 + 基础设施 | P2 |

每项触发时按 AGENTS.md §6 流程新建独立 task_dir + worktree + SSoT 段。

## 4. 执行步骤

1. ✅ 探索仓库 + SSoT（turn 24）
2. ⏳ 写 task_plan.md（本文件）
3. ⏳ 写 findings.md（事实清单）
4. ⏳ 写 progress.md（验证证据）
5. ⏳ 写 walkthrough
6. ⏳ 回写 SSoT §1 + §7
7. ⏳ gm_record
8. ⏳ 自检：task_dir 三件套齐全 + walkthrough 落位 + SSoT 双绑 + gm 节点成功

## 5. 双绑校验

- SSoT → task_dir：`Doc/Agora-实施排期-Agora-TS.md` §7 引用 `Doc/09-PLANNING/TASKS/2026-09-01-v011-slash-command-smoke-closeout/`
- task_dir → walkthrough：`progress.md` 引用 `Doc/10-WALKTHROUGH/2026-09-01-v011-slash-command-smoke-closeout.md`
- walkthrough → task_dir：walkthrough 头部引用 task_dir

## 6. 完成后回写

- ✅ SSoT §1 row 8 + §7 entry
- ✅ task_dir 三件套（plan / findings / progress）
- ✅ walkthrough
- ✅ gm_record EVENT（securityBoundary 房间白名单设计澄清）
