# Walkthrough — B1: Wire @agora-ts/adapters-calendar to Server

**Date**: 2026-09-01 (Asia/Shanghai)
**Branch / Worktree**: `feat/agora-ts-wire-adapters-calendar` (now merged into master @ `d9f5c58`)
**Author**: 总工
**Status**: ✅ done (B1 code wire complete; live deploy pending RADICALE infra)

---

## 1. TL;DR

v0.1.1 slash smoke (turn 23) 报告 `/agora calendar today` → 404。Root cause analysis 发现
**`CalendarService` + 3 个 `/api/calendar/*` routes 已经在 master 实现**（next-batch 2026-08-31,
12/12 测试通过），**唯一缺失的是 runtime → index.ts 的 wiring**。B1 用 6 行最小改动
补齐 wiring，smoke 验证通过。

**改动**：`apps/server/src/runtime.ts` (+5) + `apps/server/src/index.ts` (+1) = 6 行净增。
**Commit**：`d9f5c58 feat(agora-ts): wire @agora-ts/adapters-calendar into server (B1)`
**Branch**：`feat/agora-ts-wire-adapters-calendar` → 已合并 master → worktree 已清理。

## 2. 现状盘点（before B1）

| 组件 | 状态 | 文件 |
|---|---|---|
| `@agora-ts/adapters-calendar` 包 | ✅ 已实现 + 12/12 测试 | `packages/adapters-calendar/src/` |
| `CalendarService` core | ✅ 已实现 + 3/3 测试 | `packages/core/src/calendar-service.ts` |
| `app.ts` BuildAppOptions `calendarService?` | ✅ 已声明 | `apps/server/src/app.ts:333` |
| `app.ts` buildApp 读 calendarService | ✅ 已读 | `apps/server/src/app.ts:1212` |
| `app.ts` routes `GET /api/calendar/today` | ✅ 已注册 | `app.ts:4538-4548` |
| `app.ts` routes `GET /api/calendar/conflicts` | ✅ 已注册 | `app.ts:4550-4560` |
| `app.ts` routes `POST /api/calendar/reports/:kind` | ✅ 已注册 | `app.ts:4562-4580` |
| `calendar-factory.ts` `createCalendarServiceFromEnv` | ✅ 已写 | `apps/server/src/calendar-factory.ts` |
| `runtime.ts` 构造 CalendarService | ❌ **缺失** | — |
| `runtime.ts` 返回 CalendarService | ❌ **缺失** | — |
| `index.ts` 传 runtime.calendarService 给 buildApp | ❌ **缺失** | — |

**结论**：B1 只补 3 处 wiring，scope 最小。

## 3. 改动

### 3.1 `apps/server/src/runtime.ts` (+5)

```diff
 import {
   ...
   RuntimeTargetService,
+  CalendarService,
 } from '@agora-ts/core';
 import { OpenAiCompatibleProjectBrainEmbeddingAdapter, ... } from '@agora-ts/adapters-brain';
 import { A2aGatewayService } from '@agora-ts/adapters-runtime';
+import { createCalendarServiceFromEnv, readCalendarEnv } from './calendar-factory.js';
 import { FilesystemArtifactContentStore } from '@agora-ts/adapters-materialization';

 export function createServerRuntime(options: CreateServerRuntimeOptions = {}) {
   ...
   const db = createAgoraDatabase({ dbPath: config.db_path, busyTimeoutMs: config.db_busy_timeout_ms });
   runMigrations(db);
+  const calendarEnv = readCalendarEnv(process.env);
+  const calendarService = calendarEnv ? createCalendarServiceFromEnv(calendarEnv) : undefined;
   ...

   return {
     config: config as AgoraConfig,
     db,
     ...composition,
+    ...(calendarService ? { calendarService } : {}),
     runtimeTargetService,
     ...
```

### 3.2 `apps/server/src/index.ts` (+1)

```diff
     ...(runtime.imProvisioningPort ? { imProvisioningPort: runtime.imProvisioningPort } : {}),
     ...(runtime.dashboardDir ? { dashboardDir: runtime.dashboardDir } : {}),
+    ...(runtime.calendarService ? { calendarService: runtime.calendarService } : {}),
   });
```

## 4. 验证

### 4.1 TypeScript build

`tsc -b tsconfig.workspace.build.json` → 0 errors ✓

### 4.2 回归测试

`apps/server` 全套（24 个文件 / 201 测试）：
- ✅ **195 pass**
- ⚠️ **6 fail**：全是 baseline 已知 sandbox EROFS（`/root/.agora/skills/acpx-agent-delegate` 只读 + `runtime-assets.ts` sync 副作用），与 B1 无关
- **B1 没引入新失败** ✓（baseline 对照已 stash B1 改动后跑确认）

### 4.3 隔离 HOME smoke (port 29001, Radicale 不可达)

```
AGORA_HOME_DIR=/home/ailink/.agora-b1-smoke
AGORA_SKILL_TARGET_DIRS=/home/ailink/.agora-b1-skills
RADICALE_URL=http://127.0.0.1:5232  # 故意指向不存在
RADICALE_USER=tester
RADICALE_PASSWORD=secret
PORT=29001
```

| 端点 | HTTP | Body |
|---|---|---|
| `GET /api/calendar/today` | **400** | `{"message":"fetch failed"}` |
| `GET /api/calendar/conflicts` | **400** | `{"message":"fetch failed"}` |
| `POST /api/calendar/reports/morning` | **400** | `{"message":"fetch failed"}` |

**解读**：
- 之前（无 wiring）：503 `"Calendar service is not configured (set RADICALE_URL...)"`
- 现在（有 wiring + RADICALE env 但 Radicale 不可达）：**400 `"fetch failed"`**
- 这证明 `runtime.calendarService` 已被传给 `buildApp`，route 不再走 503 fallback，而是真的调 `calendarService.listToday()` → Radicale 不可达 → fetch failed → 400

### 4.4 503 fallback 保留

未设 RADICALE env 时，`runtime.calendarService` 是 undefined → conditional spread 不传 → route 走原 503 fallback `"Calendar service is not configured (set RADICALE_URL + RADICALE_USER + RADICALE_PASSWORD)"`。✓

## 5. Sandbox 限制记录

| 限制 | 现象 | workaround |
|---|---|---|
| `/root/.agora/skills/acpx-agent-delegate` 只读 | `runtime-assets.ts:165` rmSync 报 EROFS | 设 `AGORA_SKILL_TARGET_DIRS` 指向可写目录 |
| `/root/.npm/_cacache` 只读 | npx / npm install 报 EROFS | 设 `NPM_CONFIG_CACHE=/home/ailink/dsh-agora/.npm-cache` |
| `im.provider` 必须是 `discord\|matrix\|none` | zod 验证 fail | smoke 用 `"none"` |

## 6. 部署契约（informational）

要让公网 `/agora calendar today` 返回 200，live agora-ts server 需要：

```bash
RADICALE_URL=http://127.0.0.1:5232     # Radicale server 实际地址
RADICALE_USER=<username>
RADICALE_PASSWORD=<password>
# 可选：
# RADICALE_WORK_COLLECTION=/<username>/work/
# RADICALE_LIFE_COLLECTION=/<username>/life/
# RADICALE_TIMEZONE_OFFSET_MINUTES=480   # +0800
```

外加 Radicale server 实际在 `RADICALE_URL` 可达。**Radicale 部署 = 不在 B1 范围**（运维/基础设施）。
本仓 B1 只补 wiring；live 部署时配齐 env 即可让命令返回 200。

## 7. Files Changed

| File | 改动 |
|---|---|
| `agora-ts/apps/server/src/runtime.ts` | +5 (import CalendarService + factory + 构造 + return spread) |
| `agora-ts/apps/server/src/index.ts` | +1 (buildApp conditional spread) |
| `Doc/09-PLANNING/TASKS/2026-09-01-b1-wire-adapters-calendar/{task_plan,findings,progress}.md` | 新建 task_dir 三件套 |
| `Doc/10-WALKTHROUGH/2026-09-01-b1-wire-adapters-calendar.md` | 本 walkthrough |
| `Doc/Agora-实施排期-Agora-TS.md` | §1 row 9 + §7 entry 回写 |

## 8. Lessons / 后续

1. **Wire-only change 在 next-batch 后是常见 gap** —— next-batch 2026-08-31 实现了 CalendarService + routes + factory，**但 wiring 漏了一步**。下次类似切片（routes 已挂 + service 已实现 + factory 已写），TDD checklist 加 "wire from runtime to buildApp"。
2. **Sandbox EROFS 是 baseline 已知** —— `/root/.agora/skills/acpx-agent-delegate` 只读挂载触发 `runtime-assets.ts:165` rmSync 失败。workaround 是 `AGORA_SKILL_TARGET_DIRS`。这条经验值得记录在 §11-REFERENCE/testing-standard.md。
3. **Smoke 是 wiring 的最佳验证** —— TDD 红难以写（runtime 副作用 + asset sync 副作用），但隔离 HOME + curl 模式验证 wiring 是否传导（503 → 400）非常清晰。
4. **Conditional spread 模式**：`...(x ? { x } : {})` 是 codebase 已建立的"可选 BuildApp 字段"标准模式，B1 沿用。

## 9. References

- task_dir: `Doc/09-PLANNING/TASKS/2026-09-01-b1-wire-adapters-calendar/`
- SSoT: `Doc/Agora-实施排期-Agora-TS.md` §1 row 9 + §7 entry
- prior backlog source: `Doc/10-WALKTHROUGH/2026-09-01-v011-slash-command-smoke-closeout.md` §6 B1-B4
- commit: `d9f5c58 feat(agora-ts): wire @agora-ts/adapters-calendar into server (B1)`
