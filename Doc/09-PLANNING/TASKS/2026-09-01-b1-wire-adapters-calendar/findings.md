# Findings — B1: Wire @agora-ts/adapters-calendar to Server

**Date**: 2026-09-01 (Asia/Shanghai)
**Worktree**: `/home/ailink/dsh-agora/.worktrees/agora-ts-wire-adapters-calendar`
**Branch**: `feat/agora-ts-wire-adapters-calendar`

---

## F1. 现状盘点（master @ 49992bc）

### F1.1 已经实现的（next-batch 2026-08-31 完成的）

| 组件 | 状态 | 文件 |
|---|---|---|
| `@agora-ts/adapters-calendar` 包 | ✅ 已实现 + 12/12 测试 | `packages/adapters-calendar/src/{ical,conflicts,reports,radicale-client}.ts` |
| `CalendarService` core | ✅ 已实现 + 3/3 测试 | `packages/core/src/calendar-service.ts` |
| `app.ts` BuildAppOptions `calendarService?` 字段 | ✅ 已声明 | `apps/server/src/app.ts:333` |
| `app.ts` buildApp 读取 `calendarService` | ✅ 已读 | `apps/server/src/app.ts:1212` |
| `app.ts` routes `GET /api/calendar/today` | ✅ 已注册（503 fallback） | `apps/server/src/app.ts:4538-4548` |
| `app.ts` routes `GET /api/calendar/conflicts` | ✅ 已注册（503 fallback） | `apps/server/src/app.ts:4550-4560` |
| `app.ts` routes `POST /api/calendar/reports/:kind` | ✅ 已注册（503 fallback） | `apps/server/src/app.ts:4562-4580` |
| `calendar-factory.ts` `createCalendarServiceFromEnv` | ✅ 已写 | `apps/server/src/calendar-factory.ts` |
| `calendar-factory.ts` `readCalendarEnv` | ✅ 已写 | `apps/server/src/calendar-factory.ts:43` |
| `CalendarQuerySchema` (zod) | ✅ 已 import | `app.ts:62` |

### F1.2 缺口（B1 要补的）

| 缺口 | 位置 | 影响 |
|---|---|---|
| `runtime.ts` 没构造 / 持有 `CalendarService` | `apps/server/src/runtime.ts` | service 永远是 undefined |
| `runtime.ts` 类型定义没 `calendarService` 字段 | 同上 | runtime 类型缺字段 |
| `index.ts` 没把 `runtime.calendarService` 传给 `buildApp` | `apps/server/src/index.ts:42-58` | routes 永远走 503 fallback |
| 没有 server 端 calendar route 单测 | `apps/server/src/` | TDD 缺位 |

### F1.3 关键事实

- **routes 已经存在 + 503 fallback 已经写好** —— live 实测 `/api/calendar/today` 应当返回 503（不是 404）
- **实测 live `/api/calendar/today` 行为**：HTTP 000（connection refused）—— live server 实际监听 18008 而非 18009（`.env` AGORA_SERVER_URL 18009 与实际端口不一致）。**这是部署/配置问题，不是 code gap**。
- **实测 dashboard `/api/dashboard/session` 200**：vite proxy 把 dashboard 的 `/api/*` 转给 18009 → 但 18009 没人接 → vite proxy 走 fall through？看 turn 21 的 sessionStore 工作 —— 当时 `curl http://127.0.0.1:18009/api/dashboard/session` 返回 200 JSON。可能 18009 在某个 OS 上是另一份 server 实例（live）。**当前 shell `ss -ltnp` 看不到 node 进程**（沙盒限制），不深查。
- **B1 scope 锁定**：只补 F1.2 的两个 wiring 缺口。live 端口 / RADICALE 部署配置 = **不在 B1 范围**（按 §1.5 不扩展 scope）。

## F2. 设计决策

### F2.1 wire 模式

`CalendarService` 是**可选**（按 `app.ts:1212` `if (!calendarService) return reply.status(503)` 设计意图）：

- `runtime.ts` 在 `createServerRuntime()` 启动时调用 `readCalendarEnv(process.env)`
  - 配齐 → `createCalendarServiceFromEnv(...)` → runtime.calendarService = service
  - 缺 env → runtime.calendarService = undefined（routes 自然 503）
- `index.ts` 用 conditional spread：`...(runtime.calendarService ? { calendarService: runtime.calendarService } : {})`

### F2.2 部署契约（informational, 不在 B1 范围）

live server 要让 `/agora calendar today` 返回 200，需配：

```bash
RADICALE_URL=http://127.0.0.1:5232
RADICALE_USER=<username>
RADICALE_PASSWORD=<password>
RADICALE_WORK_COLLECTION=/<username>/work/    # 可选
RADICALE_LIFE_COLLECTION=/<username>/life/    # 可选
RADICALE_TIMEZONE_OFFSET_MINUTES=480          # 可选（+0800）
```

外加需要 Radicale server 实际在跑（`http://127.0.0.1:5232`）。**Radicale 部署 = 不在 B1**（是运维/基础设施）。

## F3. TDD 切口（server 端）

| 测试 | 位置 | 模式 |
|---|---|---|
| `GET /api/calendar/today` 注入 fake service → 200 + fakeService 返回 events | `apps/server/src/calendar-routes.test.ts`（新建） | buildApp({calendarService: fake}) + Fastify inject |
| `GET /api/calendar/today` 无 service → 503 + clear message | 同上 | buildApp({}) + Fastify inject |
| `GET /api/calendar/today` invalid query → 400 | 同上 | inject `{domain: 'invalid'}` |
| `GET /api/calendar/conflicts` 同上 3 个变体 | 同上 | 同模式 |
| `POST /api/calendar/reports/morning` 注入 service → 200 + markdown | 同上 | buildApp({calendarService: fake}) + POST |
| `POST /api/calendar/reports/:kind` kind !== morning|evening → 400 | 同上 | inject `{kind: 'bad'}` |
| `createCalendarServiceFromEnv` 工厂单元测试 | `apps/server/src/calendar-factory.test.ts`（新建） | 直接调工厂 |

**fake CalendarService** = `{ listToday: vi.fn(async (domain) => [...]) , listConflicts: vi.fn(...), morningReport: vi.fn(...), eveningReport: vi.fn(...) }`（minimal stub，参考 `app.test.ts` 现有 fake 模式）

## F4. 风险

- **R1**：`runtime.ts` 类型定义要改 `ServerRuntime` interface —— 影响所有引用 runtime 的测试。 → smoke 阶段跑全量回归。
- **R2**：live server 端口 18009/18008 不一致是部署/配置问题，不在 B1 范围，但 progress.md 要记录。
- **R3**：Radicale 部署不在 B1。live smoke 时 503 是预期（live 没 RADICALE env），不是 bug。

## F5. 不在本次范围

- ❌ RADICALE_URL/Radicale server 部署（运维/基础设施）
- ❌ live server 端口 18008 vs 18009 不一致调查（部署配置）
- ❌ dashboard calendar UI 接线（前端，超 B1 scope）
- ❌ CalendarService 业务逻辑改动（next-batch 已完成 + 12/12 测试）
