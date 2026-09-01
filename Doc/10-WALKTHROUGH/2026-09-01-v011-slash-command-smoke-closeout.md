# Walkthrough — v0.1.1 Slash Command Smoke Closeout

**Date**: 2026-09-01 (Asia/Shanghai)
**Branch**: master（本仓文档收口，不开 worktree，理由见 task_plan §0）
**Author**: 总工
**Status**: ✅ done（实测通过节点 + backlog 落地，3 个后端缺口转交后续 phase）

---

## 1. TL;DR

matrix-connector **v0.1.1** 在 CEO 收件箱 Matrix 房间的 slash command 冒烟实测：

- ✅ **5 个命令完全通过**：`/agora task <id>` / `task <id> artifacts` / 自然对话 / `task transfer`（占位明确）/ `call join`（占位 token）
- ❌ **3 个后端缺口**：`/agora calendar today` / `doc show <id>` / `say 语音测试`
- 🔑 **1 个设计澄清**：`securityBoundary` 白名单房间（9 个）— `node-home-linux` 不在白名单是设计意图，非 bug

**行动**：本次为**文档收口**（AGENTS.md §3 §4 closeout），把事实固化进 task_dir + walkthrough + SSoT；3 个后端缺口按 §6 流程排进后续 backlog。

---

## 2. 测试样本矩阵

| # | 命令 | 结果 | 指纹 / 备注 |
|---|---|---|---|
| 1 | `/agora task <id>` | ✅ | task 状态 JSON（done / creator / type）|
| 2 | `/agora task <id> artifacts` | ✅ | `441f2302…-executive-deliverable` 形式产物 |
| 3 | `/agora call join` | ⚠️ | Element Call URL（**占位 token**，等 LiveKit 部署）|
| 4 | `/agora task transfer <id>` | ✅ | "not implemented yet"（**T_transfer 推迟**，符合设计）|
| 5 | 自然对话 | ✅ | "Dispatch claimed by runtime node" |
| 6 | `/agora calendar today` | ❌ | 404 — `@agora-ts/adapters-calendar` 未 wire 到 server |
| 7 | `/agora doc show <id>` | ❌ | 404 — 缺 `/api/artifacts/:id/markdown` 路由 |
| 8 | `/agora say 语音测试` | ❌ | `information policy not found` |

**摘要**：5 ✅ / 1 ⚠️ / 3 ❌（3 ❌ 全是"接通但后端缺路由"模式）

---

## 3. 关键设计澄清：securityBoundary 白名单

**现象**：之前 `node-home-linux` 房间发 `/agora help` 无回应，被怀疑是 bug。

**实测验证**：
- ✅ CEO 收件箱（白名单内）：所有 slash 命令正常
- ❌ `node-home-linux`（不在白名单）：slash 命令无响应，但**自然对话能正常回**（"Dispatch claimed by runtime node"）

**设计意图**：
- 白名单房间 = 高频治理 / 任务入口 → slash 命令可用
- 非白名单房间 = 只读 / 监听 / 闲聊 → 不应触发 `agora` 编排
- 自然对话走 DSH 本地 agent 直处理路径，**不走 securityBoundary**

**Playbook**：用户报"X 房间 /agora Y 没响应" → 第一步查 9 个白名单清单，不是查 bug。

**9 房间部分清单**（来自实测报告，完整清单需从 connector 源码 `securityBoundary` 实现处获取）：
- CEO 收件箱 ✓ / 公司简报 ✓ / 虚拟女友 ✓ / ...（其余 6 个待补）

---

## 4. 3 个后端缺口的根因

| 命令 | 缺口 | 根因 | 修复路径 |
|---|---|---|---|
| `/agora calendar today` | `/api/calendar/today` 404 | `adapters-calendar` 已实现（SSoT §7 next batch：12/12 测试通过）但**未 wire 到 `apps/server` composition** | composition.ts 加 service + route 注册 + smoke |
| `/agora doc show <id>` | `/api/artifacts/:id/markdown` 404 | Markdown artifact 路由规划中（SSoT §7 next batch），backend 未落地 | core service + REST route + smoke |
| `/agora say 语音测试` | `information policy not found` | 语音投递需先建 information policy（Personal Office 治理）+ fish-speech :8080 可达性未确认 | 两步：① agora-ts 建 policy；② probe + 配 connector speech |

## 5. ⚠️ Element Call 占位 token

`/agora call join` 返回 URL 用了占位 token —— LiveKit SFU 未部署。

**修复路径**：LiveKit 部署（独立基础设施）+ connector 配 `livekit.url` / `api_key` / `api_secret` → 占位换真 JWT。

**优先级 P2**：不阻断主流程，但限制 `/agora call` 实际可用性。

---

## 6. Backlog（移交后续 phase）

| ID | 触发命令 | 范围 | 优先级 | 流程 |
|---|---|---|---|---|
| **B1** | `/agora calendar today` | agora-ts composition wire + REST `/api/calendar/today` + smoke | **P0** | §6 新 task_dir + worktree |
| **B2** | `/agora doc show <id>` | agora-ts core service + REST `/api/artifacts/:id/markdown` + smoke | **P0** | §6 新 task_dir + worktree |
| B3 | `/agora say` | agora-ts information policy + connector fish-speech 配置 + probe :8080 | P1 | §6 新 task_dir + worktree |
| B4 | `/agora call join` | LiveKit SFU 部署 + connector JWT 配置 | P2 | 独立基础设施 phase |

每项触发时按 AGENTS.md §6 流程新建独立 task_dir + worktree + SSoT 段。

---

## 7. Files Changed（本仓）

- ✅ `Doc/09-PLANNING/TASKS/2026-09-01-v011-slash-command-smoke-closeout/{task_plan,findings,progress}.md` — 新建 task_dir 三件套
- ✅ `Doc/10-WALKTHROUGH/2026-09-01-v011-slash-command-smoke-closeout.md` — 本 walkthrough
- ✅ `Doc/Agora-实施排期-Agora-TS.md` — §1 row 8 + §7 entry 回写

**未触碰**：
- ❌ `.repos/dsh-matrix-connector/` — connector 仓 SSoT 由 connector 仓主人维护
- ❌ 本仓 `agora-ts/` 源码 — 本次纯文档收口
- ❌ `dashboard/` / `extensions/` — 与本任务无关
- ❌ `.env` — 与本任务无关（上一轮 dashboard fix 留存，已 commit）

---

## 8. Lessons / 后续 Playbook

1. **白名单房间设计澄清**：下次报"某房间 slash 不响应" → 先确认房间是否在 9 个白名单内（不是 bug，是 `securityBoundary` 边界）。
2. **"接通但后端缺路由"模式**：当命令 → connector → agora 链路通但 backend 404 时，几乎都是 composition 未 wire 或 route 未落地，按 §6 流程补。
3. **T_transfer / LiveKit / 占位 token**：测试时遇到 "not implemented yet" / 占位 JWT 不一定是 bug，可能是**已知推迟**（SSoT §7 已记账）。
4. **文档收口时机**：测试通过节点（v0.1.1 smoke 通过）就应该固化 task_dir + walkthrough + SSoT，否则下一轮迭代上下文丢关键事实（"securityBoundary 澄清"这种）。

---

## 9. References

- task_dir: `Doc/09-PLANNING/TASKS/2026-09-01-v011-slash-command-smoke-closeout/`
- SSoT: `Doc/Agora-实施排期-Agora-TS.md` §1 row 8 + §7 entry
- 关联: SSoT §7 next batch（117行，日历 + 文档切片）+ §6 跨切片依赖提交流程
