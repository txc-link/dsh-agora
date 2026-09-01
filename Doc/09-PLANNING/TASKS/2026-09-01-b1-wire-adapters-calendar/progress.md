# Progress — B1: Wire @agora-ts/adapters-calendar to Server

**Date**: 2026-09-01 (Asia/Shanghai)

---

## P1. 完成步骤

- [x] P1.1 探索 worktree 内结构 + 列出现状盘点（turn 26 step 6-7）
- [x] P1.2 task_plan.md 落地
- [x] P1.3 findings.md 落地（F1-F5 + 7 个 TDD 切口候选）
- [x] P1.4 评估 TDD 切口 → 发现 runtime 启动触发 asset sync 副作用阻塞 unit test → 改为隔离 HOME smoke 验证
- [x] P1.5 wire 代码改动（runtime.ts +5, index.ts +1）
- [x] P1.6 TypeScript build 0 errors
- [x] P1.7 apps/server 回归：195/201 通过，6 baseline 已知 sandbox EROFS 失败无关
- [x] P1.8 隔离 HOME smoke（RADICALE env set）：`/api/calendar/today` 503 → **400**（fetch failed，证明 wiring 通了）
- [x] P1.9 commit c5e8d58 → merge into master (cherry-pick d9f5c58) → push origin/master `49992bc..d9f5c58`
- [x] P1.10 worktree cleanup（已删除 .worktrees/agora-ts-wire-adapters-calendar + 分支已 -D）
- [x] P1.11 walkthrough 落地
- [x] P1.12 SSoT 回写

## P2. 验证证据

### P2.1 TypeScript build

`npx tsc -b tsconfig.workspace.build.json` → 0 errors ✓

### P2.2 隔离 HOME smoke（RADICALE env set, Radicale 不存在）

| 端点 | Before (master) | After (B1) |
|---|---|---|
| `GET /api/calendar/today` | 503 `"Calendar service is not configured (set RADICALE_URL...)"` | **400 `"fetch failed"`** |
| `GET /api/calendar/conflicts` | 503 同上 | **400 `"fetch failed"`** |
| `POST /api/calendar/reports/morning` | 503 同上 | **400 `"fetch failed"`** |

→ 503 → 400 的转变 = `runtime.calendarService` 已注入 buildApp，route 真正调用 `listToday()`/`listConflicts()`/`morningReport()`，Radicale 不可达导致 fetch failed → 400。

### P2.3 未设 RADICALE env

`runtime.calendarService === undefined` → conditional spread 不传 → route 走原 503 fallback ✓

## P3. 未决 / 风险

- **U1**：live agora-ts server 端口 18008 vs 18009 不一致 —— 部署配置问题，**不在 B1 范围**
- **U2**：Radicale server 实际部署 —— 运维/基础设施，**不在 B1 范围**；live smoke 时 RADICALE env 设了但 Radicale 不存在导致 400，**这是符合预期的状态**
- **U3**：dashboard calendar UI 没接（next-batch 只 backend 实现，dashboard calendar 页面不存在）—— 不在 B1 scope

## P4. 关联 walkthrough

`Doc/10-WALKTHROUGH/2026-09-01-b1-wire-adapters-calendar.md`

## P5. Backlog 转交

| ID | 触发命令 | 范围 | 优先级 | 状态 |
|---|---|---|---|---|
| **B1** | `/agora calendar today` | adapters-calendar wire | P0 | ✅ **DONE** (`d9f5c58`) |
| B2 | `/agora doc show <id>` | Markdown artifact route | P0 | ⏳ next |
| B3 | `/agora say` | information policy + fish-speech :8080 probe + connector 配置 | P1 | ⏳ after B2 |
| B4 | `/agora call join` | LiveKit SFU 部署 | P2 | ⏳ after B3 |

## P6. 部署契约

live agora-ts 服务需要（运维动作）：
```bash
RADICALE_URL=http://127.0.0.1:5232     # Radicale server 实际地址
RADICALE_USER=<username>
RADICALE_PASSWORD=<password>
# 可选：
# RADICALE_WORK_COLLECTION=/<username>/work/
# RADICALE_LIFE_COLLECTION=/<username>/life/
# RADICALE_TIMEZONE_OFFSET_MINUTES=480
```

外加 Radicale server 实际可达。**全部完成（B1-B4）后一次性部署**（用户拍板 turn 26）。
