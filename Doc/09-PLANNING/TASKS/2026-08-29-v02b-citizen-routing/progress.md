# progress.md — v0.2b citizen routing

## 阶段 1 — 调查 + 设计（turn 43 step 1-9）
- 调查: agora `createTaskRequestSchema` 已含 `team_override` + `teamMemberSchema` 含 `agentId` / `member_kind`
- 调查: v0.1.1 smoke 没用 team_override — agora 默认派 `haiku`
- 决策: B 线**只改 plugin 端**, **零 schema 改动**
- 写 `task_plan.md` + `findings.md`

## 阶段 2 — Worktree (turn 43 step 18)
- `git worktree add .worktrees/feat-v02b-citizen-routing -b feat/v02b-citizen-routing feat/dsh-matrix-connector`
- master 分支上写 task_plan + findings (Doc/ 仓)

## 阶段 3 — RED tests (turn 43 step 19-22)
- 写 `tests/dispatch-bridge.test.mjs`: 5 个 parseDispatchArgs 测试
- 跑 `node --test` → 全部 fail (lib/dispatch-args.js 不存在) → 🟥 RED 确认

## 阶段 4 — GREEN (turn 43 step 23-30)
- 写 `src/dispatch-args.ts` — 修正 TS strict 2 次 (noUncheckedIndexedAccess, exactOptionalPropertyTypes)
- build clean, 5/5 dispatch-args 测试通过
- ⚠️ 发现 v0.2 streamEvents mock missing → plugin-flow.test fail
- 加 streamEvents mock → 54/54 绿

## 阶段 5 — 集成 (turn 43 step 31-44)
- 改 bridges.ts DispatchBridge.dispatch() 用 parseDispatchArgs + team_override
- 改 agora-rest.ts CreateTaskInput 加 team_override? 字段
- ⚠️ 旧 bridges.test.mjs `['ask', 'REMOTE_OK']` 被 parse 成 citizen_id='ask'
- 修测试用 Chinese prompt + 加新测试 → 55/55 绿

## 阶段 6 — Smoke (turn 43 step 45)
- 写 `tests/smoke-v02b-citizen-routing.mjs`: 真 POST /api/tasks 带 team_override
- 跑通 — response.team.members[0].agentId 匹配请求的 citizen_id
- task_id OC-1787934650636 创建成功

## 阶段 7 — Commit + Merge + Cleanup (turn 43 step 47-49)
- commit `1e3354c` on feat/v02b-citizen-routing
- merge `c4bff9e` to master
- worktree remove + branch delete
- ff-merge master into feat/dsh-matrix-connector (now at c4bff9e)

## 阶段 8 — Walkthrough 落地 (turn 43 step 50)
- Doc/10-WALKTHROUGH/2026-08-29-dsh-matrix-connector-v02b-citizen-routing.md
- Doc/09-PLANNING/TASKS/2026-08-29-v02b-citizen-routing/progress.md (this file)

## 验收检查

- [x] §1 边界保持 — agora 中央 schema 不变, plugin 只填字段
- [x] §3 worktree-first — 用 feat/v02b-citizen-routing, 已合并已删
- [x] §4 TDD — RED (5 fail) → GREEN (5 pass) → 集成
- [x] §4 walkthrough 落地 — 此文件 + walkthrough.md
- [x] 55/55 unit tests green
- [x] smoke PASSED — 真 task_id OC-1787934650636, 真 team override 落地