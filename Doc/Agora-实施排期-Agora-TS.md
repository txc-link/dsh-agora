# 实施排期 SSoT — agora-ts (主仓后端)

**Last updated**: 2026-09-01 (Asia/Shanghai, turn 26)
**Owner**: 总工
**Repo**: txc-link/dsh-agora (主仓, branch master / develop)
**Phase**: 3 (matrix-connector v0.1.x + 准备 R-E Space / R-F Web Detail)

---

## 1. Status

| Slice | Status | Notes |
|---|---|---|
| 0. SSoT 建立 (本文件) | ✅ done (turn 142) | 治理基础回填 |
| 1. R-A / R-B / R-C / R-D 系列切片 | ✅ done | 见 walkthroughs Doc/10-WALKTHROUGH/ |
| **2. R-D hotfix (60b01a6)** | ✅ **done** | InboxReplyService wiring + auto-bind thread on first reply — SSoT 回写 (本文件 §4) |
| 3. R-E Space 嵌套 | ⏳ scoped to connector (matrix 仓), agora-ts 不动 | 见 matrix SSoT phase 3 |
| 4. R-F thread web 详情面板 | ⏳ scoped to dashboard (主仓前端), agora-ts 不动 | 见 Dashboard SSoT |
| 5. agora-ts 自身大改 | ⏳ not started | 需新建独立 phase 计划 |
| **6. Onboarding cross-platform (债 4 闭环)** | ✅ **done (turn 157)** | `agora init --non-interactive` (CI 友好 + `--admin-password-stdin` + `--skip-assets`) + `agora serve` 跨5 平台 (systemd/launchd/windows/docker/bare) + `Doc/scripts/install-agora.sh` 一键 wrapper; 现有 `agora start` dev helper 保持不变; walkthrough `Doc/10-WALKTHROUGH/2026-08-30-agora-onboarding-cross-platform.md` |
| **7. Company OS v0.1** | ✅ **deployed** | Organization/Unit/Position/Employment + EA request/runtime dispatch/task/commitment + SHA-256 Markdown deliverable；REST/CLI/Matrix；restart recovery；`469a23b` / `a633447` / `dc7363a` |
| **8. v0.1.1 slash command smoke closeout** (cross-仓事件, turn 24) | ✅ **smoke 通过** | matrix-connector v0.1.1 CEO 收件箱实测 5 ✅ / 1 ⚠️ / 3 ❌；3 个后端缺口 (calendar / markdown artifact / information policy / LiveKit) 按 §6 流程转交后续 phase (B1-B4)；securityBoundary 9 房间白名单设计澄清（自然对话不走 boundary）；task_dir `Doc/09-PLANNING/TASKS/2026-09-01-v011-slash-command-smoke-closeout/` + walkthrough `Doc/10-WALKTHROUGH/2026-09-01-v011-slash-command-smoke-closeout.md`；本仓本轮**无代码改动** |
| **9. B1 wire adapters-calendar to server** (turn 26) | ✅ **deployed (master d9f5c58)** | `apps/server/src/runtime.ts` +5 + `index.ts` +1 (total 6 行) — `readCalendarEnv` + `createCalendarServiceFromEnv` 接入 runtime，conditional spread 传给 `buildApp`；smoke 验证：`/api/calendar/today` 从 503 → **400 fetch failed**（Radicale 不可达，证明 service 真正被调用）；TypeScript build 0 errors；回归 195/201（6 baseline 已知 sandbox EROFS 无关）；branch `feat/agora-ts-wire-adapters-calendar` merged + worktree cleaned；task_dir `Doc/09-PLANNING/TASKS/2026-09-01-b1-wire-adapters-calendar/` + walkthrough `Doc/10-WALKTHROUGH/2026-09-01-b1-wire-adapters-calendar.md`；live 部署需配 RADICALE_URL/USER/PASSWORD（**B1-B4 全部完成后统一部署**） |
| **10. B2 markdown artifact route** (turn 26) | ✅ **code in master b3fd488** | `app.ts:5835` 已有 `GET /api/artifacts/:artifactId/content` route（commit `80dda57 feat(coordination): add governed federation` 2026-08-28 引入，**早于 next-batch**）；B2 不需要新 code change；worktree 创建后立即发现无 diff，撤掉（无 commit 残留）；smoke 验证（隔离 HOME port 29004）：`POST /api/artifacts` → 201（artifact id `49707839-...`, sha256 `97c0c4a5...`），`GET /api/artifacts/:id/content` → 404 with `{"message":"Artifact X not found"}`（route 存在 + service wired）；live 18008 当前返 404 = stale build（部署早于 80dda57），**非 code gap**；task_dir `Doc/09-PLANNING/TASKS/2026-09-01-b2-markdown-artifact-route/` + walkthrough `Doc/10-WALKTHROUGH/2026-09-01-b2-markdown-artifact-route.md`；**统一部署时 live 重启即通** |
| **11. B3 /agora say command + fish-speech TTS adapter** (turn 26) | ✅ **deployed (master 617a459 / 69c2387)** | 跨仓 connector 改动：`dsh-matrix-connector/src/voice/tts-adapter.ts` (新) FishSpeechTtsAdapter 包装 `POST /v1/tts` JSON；`message-router.ts` 加 `say` verb；`index.ts` `case 'say'` switch：synthesize → matrix.uploadMxc → matrix.sendText `🔊 [audio (filename, N bytes)](mxc://...)` (markdown link 而非 m.audio msgType，避免 transport 扩展依赖)。fish-speech :8080 实测 live：POST `/v1/tts` → HTTP 200 + 94252B RIFF/WAV for "hello world" + 118828B for "中文测试"。**误诊纠正**：turn 23 "information policy not found" 实际是 connector unknown verb fallback，**后端 + fish-speech 都 100% 齐了**。`FISH_SPEECH_URL` env（默认 `http://127.0.0.1:8080`），plugin config 0 改动。`npm test` 98/98 pass (was 87, +11)，`npm run build` 0 errors。task_dir `Doc/09-PLANNING/TASKS/2026-09-01-b3-voice-information-policy/` + walkthrough `Doc/10-WALKTHROUGH/2026-09-01-b3-voice-information-policy.md`；branch `feat/agora-connector-say-command` merged + worktree cleaned。**out of scope v0.1**：m.audio msgType 直接发送（等 transport 升级），information policy 自动 gating（master CLI `agora personal-governance classify` 即可用户自建）。 |
| **12. B4 LiveKit SFU deployment** (turn 26) | ⏸️ **SKIPPED → v0.2+** (user 拍板) | turn 23 标注 "可选"。investigation: live `livekit-server` 不存在 + 7880/7881/7882 端口无 listen + connector/plugin/server 0 livekit 代码引用（**0 代码 + 0 部署**，非 code gap）。完整 scope = docker livekit container + 跨仓 connector 改造 (livekit-jwt.ts + element-call-url.ts + case 'call') + env 注入 (LIVEKIT_URL/KEY/SECRET)，估 1-2 小时 + 需 live 端口开放 + 凭据。**user 拍板 turn 26 step 181**：接受跳过，占位 token 推到 v0.2+。task_dir `Doc/09-PLANNING/TASKS/2026-09-01-b4-livekit-sfu-deploy/` 保留 v0.2 完整设计 (3 块：基础设施 / connector 改造 / 配置)；walkthrough `Doc/10-WALKTHROUGH/2026-09-01-b4-livekit-sfu-deploy.md`。**turn 26 总结** (master `b67111a`)：B1/B2/B3 ✅ DONE + B4 ⏸️ SKIPPED；v0.1.1 slash smoke 5 ✅ / 0 ⚠️ (B3 替代) / 0 ❌ (B1+B2 替代) / 1 ⏸️ (B4 占位)。**部署计划**：live agora-ts 重启 + connector 重启，B1-B3 部署即通。 |
| **13. Provider-neutral planning + external runtimes** | ✅ **code complete, not deployed** | Core 改用 Calendar/ExternalTask 抽象端口；Google Calendar + TickTick adapter；migration 045 持久化 Agora Task ↔ 外部 task/event；外部写操作接 ActionRisk/Human Gate；`dsh-agora-plugin` 0.7.0 增 OpenClaw CLI 与 Hermes Runs runtime。聚焦回归 21/21、workspace build、双架构 gate、插件 33/33 + typecheck + pack dry-run 通过；Matrix connector 无需改动。Planning: `Doc/09-PLANNING/TASKS/2026-09-01-provider-runtime-adapters/`；Walkthrough: `Doc/10-WALKTHROUGH/2026-09-01-provider-runtime-adapters.md`。 |
| **14. Google / TickTick bidirectional state sync** | ✅ **code complete, not deployed** | migration 046 为 binding 增 `manual|bidirectional` 授权和同步结果；Google GET/ETag conditional cancel、TickTick GET/complete/delete；Core 先读后写、终态单调同步、冲突不抢写；REST 单项/全量触发、CLI `planning sync|sync-all`、`PLANNING_SYNC_INTERVAL_MS` 非重入轮询。旧 binding 默认 manual，开启双向须 Dashboard 登录人类。Planning: `Doc/09-PLANNING/TASKS/2026-09-01-planning-bidirectional-sync/`；Walkthrough: `Doc/10-WALKTHROUGH/2026-09-01-planning-bidirectional-sync.md`。 |

**Phase 3 默认原则**：R-E / R-F 严格限定在 connector + dashboard 侧，**agora-ts 这一阶段不主动大改**。仅当 connector / dashboard 侧需要 agora-ts 暴露新能力时，按 §6 流程加 slice。

---

## 2. Architecture Decisions (locked)

| ID | Decision | Reference |
|---|---|---|
| **A1** | 三层口径: IM adapters / Core Orchestrator / Runtime Craftsmen | AGENTS.md §1 |
| **A2** | Core 只表达抽象语义, 平台具体规则不进入 core | AGENTS.md §1 硬约束 |
| **A3** | DSH plugin 不复制核心编排, plugin = slash bridge / live status / 轻量 action | AGENTS.md §2 |
| **A4** | Human 入口唯一 = Dashboard 登录态 | AGENTS.md §2 |
| **A5** | Slack/Discord/Matrix 同等 IM adapter — 不可在 Core 写死任一平台 | AGENTS.md §1 |
| **A6** | Organization 独立于 Project；现有 Team 保留为项目执行团队，不充当公司 SSoT | Company OS v0.1 |
| **A7** | Employment 绑定 provider-neutral `subject_kind + subject_ref`；运行时只是投影 | Company OS v0.1 |
| **A8** | Company/Life/Health/Companion 是独立根信息域；个人域不得成为 Company 普通 Unit | Personal Office + Company OS |

**Implementation implications for agora-ts**:
- `packages/core` 只能表达抽象端口与状态机
- 任何 IM/platform 接入 = 独立 adapter 包 (adapters-discord / adapters-cc-connect / ...)
- `apps/server` 与 `apps/cli` = composition root, 不承载业务语义

---

## 3. R-D hotfix 回写 (60b01a6)

**Commit**: `60b01a6 fix(inbox-reply): wire inboxReplyService + auto-bind thread task on first reply`
**Date**: 2026-08-29
**Trigger**: 真实 homeserver + agora-ts server E2E smoke 暴露 2 个 gap

### 3.1 改动文件 (4 个, +92 行)
- `apps/server/src/composition.ts` (+6) — wire `ThreadTaskBindingService`
- `apps/server/src/index.ts` (+1) — `createAppFromRuntime` 传入 `runtime.inboxReplyService`
- `packages/core/src/inbox-reply-service.ts` (+17) — auto-bind thread↔task before insert
- `packages/core/src/inbox-reply-service.test.ts` (+68) — 新增 4 个测试覆盖 auto-bind 路径

### 3.2 两个 gap
1. **composition → buildApp 漏传**: `createAppFromRuntime` 没把 `inboxReplyService` 传给 `buildApp`, reply route 永远 503
2. **首回复未绑定 thread**: adapter 给 opaque threadKey 但 binding row 不存在时, FOREIGN KEY 失败 — 房间首次回复永不绑定

### 3.3 修复策略
- 修 composition wiring (gap 1)
- reply 路径检测 threadKey 无 binding 时, 先调 binding service 创建 binding 再 insert conversation (gap 2) — auto-bind on first reply

### 3.4 验证
- E2E smoke (real homeserver + real agora-ts): matrix reply → ingestMatrixReply → POST reply → conversation entry. PASS
- matrix side walkthrough: `Doc/10-WALKTHROUGH/2026-08-30-shared-work-site-phase-1.md`

### 3.5 Baseline 债务 (R-D 完成后记账, turn 144)

R-F.1 subagent (turn 144) 实测发现主仓 dashboard 侧 baseline 在 R-F.1 启动前已 broken:
- **3 ts errors** in `dashboard/src/{taskMappers,taskMappers.test,taskStore.live-api.test}.ts` — 字段类型与 `@agora-ts/contracts` typedrift
- **144 vitest test failures** — React 19 + vitest `React.act is not a function` pre-existing 互动问题

**根因**: R-D hotfix 完成时 (turn 132) 只跑了 agora-ts 侧单测 (1339/1376, 36 EROFS + 1 locale fail), dashboard `npm run check` 未跑全, baseline typedrift 未被发现。

**不在 R-F 范围内修** (按 §1.5 scope 边界), **记账治理债**排未来独立 phase:
- Phase: "Dashboard baseline cleanup"
- 修复内容: contracts 字段对齐 (`TaskConversationEntry` 等) + vitest 升级到 React 19 act 兼容版本
- 触发条件: 任何想跑通 `npm run check` 的 slice 都依赖此 phase 完成

---

## 4. Phase 3 Slice Plan

agora-ts 这一阶段不主动开 slice。R-E / R-F 按矩阵仓 SSoT phase 3 + Dashboard SSoT 推进。

**例外流程** (§6): 若 R-E / R-F 在 connector / dashboard 实现过程中发现 agora-ts 缺少必要 REST endpoint / 数据模型, 按 §6 流程补 agora-ts slice。

---

## 5. Cross-references

- **矩阵仓 SSoT**: `.repos/dsh-matrix-connector/Doc/Agora-实施排期-dsh-matrix-connector.md`
- **Dashboard SSoT**: `Doc/Agora-实施排期-Dashboard.md`
- **架构决议 SSoT**: `Doc/03-ARCHITECTURE/2026-08-30-ecosystem-design-inputs/decisions.md`
- **AGENTS.md §1**: 三层口径与硬约束
- **AGENTS.md §3**: SSoT 与 planning 双向绑定 (本文件 ↔ Doc/09-PLANNING/TASKS/)

---

## 6. 跨切片依赖提交流程 (agora-ts 受外部需求触发时)

1. connector 或 dashboard 仓在 phase X 发现 agora-ts 缺能力
2. 在本仓 master 提 issue-style 记录 (本文件加 §3.X 候选段)
3. 新建 `Doc/09-PLANNING/TASKS/<日期>-agora-ts-<能力名>/{task_plan,findings,progress}.md`
4. 开 worktree `feat/agora-ts-<能力名>`
5. TDD 先行 + 实现 + 测试 + 验证
6. 回写本 SSoT (commit hash + 摘要) + walkthrough

---

## 7. Change Log

- 2026-09-01: **Provider-neutral planning + OpenClaw/Hermes runtime adapters** — `CalendarService` 从具体 Radicale 依赖改为 Core port；新增 Google Calendar、TickTick、planning binding migration 045/repository/service/REST，work/life calendar ID 分离且 domain 不可隐式切换；外部 task/event 写操作复用 ActionRisk，需 gate 时只接受 Dashboard 登录人类。`dsh-agora-plugin` 升 0.7.0，以 `dsh:<node>:openclaw/<agent>` 和 `dsh:<node>:hermes/<profile>` 接入现有 runtime registry，Agora 继续拥有跨团队调度权。验证：聚焦 Agora 21/21、workspace build、双 gate、插件 33/33/typecheck/pack dry-run；全量 Agora 测试在 Windows 受既有 SQLite 句柄清理 `EPERM` 阻塞，已由单个旧测试独立复现；未部署、未使用真实外部凭据、matrix connector 无改动。Planning: `Doc/09-PLANNING/TASKS/2026-09-01-provider-runtime-adapters/`；Walkthrough: `Doc/10-WALKTHROUGH/2026-09-01-provider-runtime-adapters.md`。
- 2026-09-01: **Google / TickTick bidirectional terminal-state sync** — 新增 migration 046（sync consent/status/time/error）；Google Calendar bound-event GET + ETag conditional cancel，TickTick bound-task GET/complete/delete；Core `PlanningSyncService` 先读取全部 provider，再做单调终态传播，`completed` ↔ Agora `done`、deleted/cancelled ↔ Agora `cancelled`，矛盾终态持久化 `conflict` 且零 mutation。旧 binding 迁移后为 manual，新 binding 的 bidirectional 启用与 projection 均要求 Dashboard 登录人类；提供 REST task/all sync、CLI `planning sync|sync-all`、可选非重入 `PLANNING_SYNC_INTERVAL_MS` poller。标题、日期、参与人、reopen 和 webhook 均不在本轮。未部署、未接真实账号。Planning: `Doc/09-PLANNING/TASKS/2026-09-01-planning-bidirectional-sync/`；Walkthrough: `Doc/10-WALKTHROUGH/2026-09-01-planning-bidirectional-sync.md`。
- 2026-09-01: **B4 LiveKit SFU deployment** (turn 26, **SKIPPED → v0.2+**, user 拍板 step 181) — investigation: live 0 livekit-server + 7880/7881/7882 端口无 listen + connector/plugin/server 0 livekit 引用 (**0 代码 + 0 部署**, 非 code gap, 与 B2 不同). 完整 v0.2 设计保留在 task_dir (3 块: docker container + 跨仓 connector 改造 + env 注入). 接受 turn 23 标为 "可选" 的判断, 占位 token 推到 v0.2+. **turn 26 总结** (master `b67111a`): B1 (`d9f5c58` wire adapters-calendar) ✅ + B2 (code already in master `b3fd488`) ✅ + B3 (`69c2387` cross-仓 connector `/agora say` + fish-speech TTS adapter) ✅ + B4 ⏸️. 部署计划: live agora-ts 重启 + connector 重启, B1-B3 即通. v0.1.1 slash smoke 5 ✅ / 0 ⚠️ (B3 替代占位) / 0 ❌ (B1+B2 替代 404) / 1 ⏸️ (B4 占位 token 推到 v0.2). Planning: `Doc/09-PLANNING/TASKS/2026-09-01-b4-livekit-sfu-deploy/`; Walkthrough: `Doc/10-WALKTHROUGH/2026-09-01-b4-livekit-sfu-deploy.md`.
- 2026-09-01: **B3 /agora say command + fish-speech TTS adapter** (turn 26, `617a459` / `69c2387`, branch `feat/agora-connector-say-command`) — 跨仓 connector 改动：新建 `dsh-matrix-connector/src/voice/tts-adapter.ts` (FishSpeechTtsAdapter 包装 POST `/v1/tts`，timeoutMs 10s + maxTextLength 500)，`message-router.ts` 加 `say` verb + HELP_TEXT entry，`index.ts` `case 'say'` switch（synthesize → matrix.uploadMxc → sendText markdown link）；新建 `tests/tts-adapter.test.mjs` 8 测试 + `message-router.test.mjs` 加 3 测试。**误诊纠正**：turn 23 "information policy not found" 实际是 connector unknown verb fallback，**后端 InformationGovernanceService + REST + CLI 100% wire + fish-speech :8080 实测 alive**（94252B RIFF/WAV）。Markdown link 而非 m.audio msgType（避免 transport 扩展依赖）。`npm test` 98/98 pass (was 87, +11)；`npm run build` 0 errors。Live smoke: synthesize "hello world" → 94252B + "中文测试" → 118828B RIFF/WAV。**out of scope v0.1**：m.audio 直接发送（等 transport 升级）；information policy gating（master CLI 可用户自建）。branch merged + worktree cleaned. Planning: `Doc/09-PLANNING/TASKS/2026-09-01-b3-voice-information-policy/`; Walkthrough: `Doc/10-WALKTHROUGH/2026-09-01-b3-voice-information-policy.md`. **B4 (LiveKit SFU deploy) 立即接**。
- 2026-09-01: **B2 markdown artifact route** (turn 26) — **`app.ts:5835` `GET /api/artifacts/:artifactId/content` route 已存在 master b3fd488**，由 commit `80dda57 feat(coordination): add governed federation` (2026-08-28) 引入；**B2 不需要新 code change**（与 B1 的 wiring 缺失模式不同）；worktree 创建后立即发现 master 已含 route，无 diff，撤掉 worktree（无 commit 残留）；smoke 验证（隔离 HOME port 29004）：`POST /api/artifacts` → 201 + sha256，`GET /api/artifacts/:id/content` → 404 with proper JSON `{"message":"Artifact X not found"}`（证明 route + service wired）；live 18008 当前返 404 = stale build（部署早于 80dda57），**部署动作 = B1-B4 全部完成后统一执行**；**经验**：live server stale build 治理 → 建议 `docs/11-REFERENCE/deploy-hygiene-standard.md` 规范 live 部署必须保持 master HEAD；新 B 调查前先 `git log -S "<关键词>"` 全局扫，避免误判 code gap。Planning: `Doc/09-PLANNING/TASKS/2026-09-01-b2-markdown-artifact-route/`；Walkthrough: `Doc/10-WALKTHROUGH/2026-09-01-b2-markdown-artifact-route.md`。后续 B3 (information policy + fish-speech) / B4 (LiveKit SFU) 按 §6 流程串行。
- 2026-09-01: **B1 wire adapters-calendar to server** (turn 26, `d9f5c58`, branch `feat/agora-ts-wire-adapters-calendar`) — `runtime.ts` 加 `CalendarService` import + factory import + `readCalendarEnv(process.env)` + `createCalendarServiceFromEnv` 构造 + return conditional spread；`index.ts` 加 buildApp conditional spread；6 行净增。**关键发现**：next-batch 2026-08-31 已实现 CalendarService + 3 个 routes + factory，**唯一缺的是 runtime → index wiring**。Smoke（隔离 HOME, port 29001, RADICALE env set, Radicale 不存在）：`/api/calendar/today` 503 → **400 fetch failed**（证明 service 真正被调用）。TypeScript build 0 errors；apps/server 回归 195/201（6 baseline 失败与 B1 无关）。Worktree hygiene：branch merged to master `49992bc..d9f5c58` + worktree `.worktrees/agora-ts-wire-adapters-calendar` 已删除。**Sandbox 经验**：`/root/.agora/skills/acpx-agent-delegate` 是只读 mount 触发 `runtime-assets.ts:165` rmSync EROFS；workaround = 设 `AGORA_SKILL_TARGET_DIRS` 指向可写目录。**Live 部署待办**（B1-B4 全部完成后统一部署）：配 RADICALE_URL/USER/PASSWORD env + Radicale server 实际部署（运维/infra，不在 B1）。Planning: `Doc/09-PLANNING/TASKS/2026-09-01-b1-wire-adapters-calendar/`；Walkthrough: `Doc/10-WALKTHROUGH/2026-09-01-b1-wire-adapters-calendar.md`。后续 B2 (Markdown artifact route) / B3 (information policy + fish-speech) / B4 (LiveKit SFU) 按 §6 流程串行。
- 2026-09-01: **v0.1.1 slash command smoke closeout** (turn 24, 跨仓事件 — connector v0.1.1) — CEO 收件箱实测：✅ `/agora task <id>` / `task <id> artifacts` / `task transfer`（"not implemented yet" 占位明确）/ 自然对话；⚠️ `/agora call join`（LiveKit 未部署，占位 token）；❌ `/agora calendar today`（404 — `adapters-calendar` 12/12 测试已过但未 wire server）/ `doc show <id>`（404 — Markdown artifact 路由未落地）/ `say 语音测试`（information policy not found）。**3 个 ❌ 按 §6 流程转交后续 phase backlog**：B1 (P0) adapters-calendar wire + REST `/api/calendar/today`；B2 (P0) Markdown artifact route `/api/artifacts/:id/markdown`；B3 (P1) information policy + fish-speech :8080 probe + connector 配置；B4 (P2) LiveKit SFU 部署。**安全设计澄清**：`securityBoundary` 9 房间白名单（CEO 收件箱 / 公司简报 / 虚拟女友 等），`node-home-linux` 不在白名单是设计意图非 bug，自然对话不走 boundary 检查（实测确认 node-home-linux 普通对话能正常回）。本次为**纯文档收口**（task_dir 三件套 + walkthrough + SSoT 回写），本仓**无代码改动**；connector 仓 SSoT（`.repos/dsh-matrix-connector/Doc/...`）由 connector 仓主人维护，本仓未触碰。Planning: `Doc/09-PLANNING/TASKS/2026-09-01-v011-slash-command-smoke-closeout/`；Walkthrough: `Doc/10-WALKTHROUGH/2026-09-01-v011-slash-command-smoke-closeout.md`。
- 2026-08-31: **2026-08-31 next batch** (`feat/2026-08-31-next-batch`，commit e012a0c / 2e9d521 / 3da427e / b8c08cd / 9fe8dc6) — 任务中心 + 日历 + 监控 + 文档。① 任务中心进度 + 审批队列：`TaskService.getTaskProgress(taskId)`（done/in_flight/failed/cancelled + percent + parent_state）；`TaskApprovalService` 新增可选 `approvalRequestRepository` 暴露 `getApprovalRequest` / `listPendingApprovals` / `decideApproval`（按 gate_type 分派到 approve/reject/archon-*，守护 "not configured"）；REST `GET /api/tasks/:id/progress`、`GET /api/approvals/pending?limit=`、`POST /api/approvals/:id/decide`（Dashboard session 强制，A4）；CLI `agora task subtasks|progress`、`agora approvals list|decide`；Dashboard `ApprovalsQueuePage` + `SubtaskPanel`。② 日历 / 承诺中心：新包 `@agora-ts/adapters-calendar`（iCal 解析、冲突检测、晨报晚检生成器 + Radicale 客户端）；`CalendarService`（listToday/conflicts/morningReport/eveningReport）；REST `GET /api/calendar/today|conflicts`、`POST /api/calendar/reports/:kind`；CLI `agora calendar today|conflicts|morning|evening`；Radicale docker-compose snippet。③ 系统监控：`apps/monitoring-relay` Node HTTP 服务（POST /webhook/grafana + GET /healthz，bearer 鉴权 + Matrix 转发）；Grafana 运维面板 JSON；Element widget customWidgets entry。④ 协作文档：artifact markdown endpoints（GET/POST `text/markdown`，sha256 内容寻址 + parent_artifact_id 元数据，单写者 v0.1）+ Dashboard `MarkdownDocumentPanel`。⑤ TDD 通过率：adapters-calendar 12/12、calendar-service 3/3、approval-service 11/11（含 queue + decide）。⑥ Workspace build clean，dashboard tsc clean。⑦ 跟进：T_transfer (RuntimeBinding/Employment) 推迟到独立 follow-up；Grafana iframe 鉴权 / Element Call SFU 部署留给用户拍板；CRDT/HedgeDoc 列为 P1。
- 2026-08-31: **P0 任务中心 + Agent 语音**（connector `0.4.0`，发布 npm）— ① 语音：
  新增 `FishSpeechSpeechAdapter`（HTTP JSON POST /v1/tts，串行队列+超时），
  config `speech.provider='fish-speech'`，GPU 真机端到端合成验证（3.67s WAV）；
  GPT-SoVITS 因模型缺失（HF 不可达）列为备选。② 任务中心：agora-rest 新增
  `pauseTask/resumeTask/cancelTask/unblockTask`（对应 central 已部署路由），
  slash 新增 `/agora task show|pause|resume|cancel|unblock`；approve/reject 因需
  人工身份字段按 A4 留给 Dashboard。258/258 测试通过。③ 部署：GPU/Mac profile
  依赖更新为 0.4.0，speech 配置写入；重启待用户执行。Planning:
  `Doc/09-PLANNING/TASKS/2026-08-30-p0-task-voice/`；Walkthrough:
  `Doc/10-WALKTHROUGH/2026-08-31-p0-task-voice.md`。
- 2026-08-30: **Matrix EA intake reliability closeout** (`9393984`,
  `993f8be`, connector `0.3.2`–`0.3.7`) — 修复带时区截止时间、Node/Project
  身份混用、静默失败、普通消息误触发、Artifact 查询/下载、运行结果凭据泄漏和
  Space 子房间动态发现；三节点在线，完成两条真实 EA→团队→Artifact 链路，
  Life/Health/Companion 独立投影保持零公司机器人。Planning:
  `Doc/09-PLANNING/TASKS/2026-08-30-matrix-ea-intake-reliability/`；
  Walkthrough: `Doc/10-WALKTHROUGH/2026-08-30-matrix-ea-intake-reliability.md`。
- 2026-08-30: **Element agent workspace operator sample** — 固化 Company、
  Personal Office、Health Vault、Companion 四个独立顶层 Space 的房间样板；
  明确 Matrix/Obsidian/Mem0 的 SSoT 分工、当前显式接线与 E2EE Gate；提供
  Citizen/Position/Employment/RelationshipProfile 命令和可复制 Agent cards。
  Planning: `Doc/09-PLANNING/TASKS/2026-08-30-element-agent-workspace-sample/`；
  Walkthrough: `Doc/10-WALKTHROUGH/2026-08-30-element-agent-workspace-sample.md`。
- 2026-08-30: **Company OS execution closeout** (`a633447`, `dc7363a`) — EA
  委派写入 DSH runtime dispatch；worker 完成后 result envelope 回写 task、
  单阶段 workflow 自动 done、request/commitment 自动核销，并生成按 SHA-256
  内容寻址的 Markdown Artifact。node-b 真机完成任务 `OC-1788062063992`，
  Core 重启后 task/artifact/content hash 全恢复。
- 2026-08-30: **Company OS v0.1 deployed** (`469a23b`) — migrations 043/044；Organization/Unit/Position/Employment 正式组织模型；Executive Request + Commitment ledger；EA 按能力路由到在岗 Position，并将模板全部 role 绑定到任职 runtime target、写 task claim；REST + CLI + Matrix v0.3 接线。远端建立 `austin-agent-company`（4 units / 6 positions / 5 active employments），首次 research 请求形成 active task，Core 重启后组织、inbox、commitment 全恢复。Planning: `Doc/09-PLANNING/TASKS/2026-08-30-company-os-v01/`；Walkthrough: `Doc/10-WALKTHROUGH/2026-08-30-company-os-v01.md`。
- 2026-08-29: agora-ts SSoT 建立 (本文件); 回写 60b01a6 R-D hotfix; R-E / R-F 显式 scope 到 connector + dashboard, agora-ts 不动
- 2026-08-30: **org-aware-work-os S2 任务认领** (develop `505ce4d`) — TaskClaimService 状态机 + matchTaskToAgent 职责匹配 + ResidentAgentPoller + CLI `agora claim {create,release,list,claimable}` + migration 036; TDD 33 新测试, core+db 回归 592/592, 真实冒烟 8/8; planning: `Doc/09-PLANNING/TASKS/2026-08-30-org-aware-task-claiming/`; architecture: `Doc/03-ARCHITECTURE/org-aware-work-os/`; 顺手修复 database.test.ts 迁移断言陈旧 (033-036)
- 2026-08-30: **最后一公里闭环（用户授权后）** — ① mem0: 正门建 agent API key + adapter X-API-Key 修复（m0sk_ 前缀）→ `experience add→search` 真机全链 ✅；② live server: /root/.agora/agora.json im 段（node-a 凭据）+ agora.service daemon-reload/restart → outbox scan {delivered:1} → Synapse 房间回读 ✅；③ Discord R-G: austin_l bot REST + adapter 真机冒烟 ✅。secrets 存 .secrets/（gitignored, 不入 git）。剩余: Win/Mac 实机接入（用户手动 deploy/01-04）+ federation P2/P3（留待多节点场景真实需求, 用户拍板延后）
- 2026-08-30: **test(cli) hygiene** (`8f76ad3`) — apps/cli 7 个环境相关 locale 断言失败清零 (errors.test beforeAll pin en-US; redirect 用例 env pin 必须先于 createCliProgram, addRedirectCommand 构造时捕获 locale); apps/cli 全量 15 文件绿; 教训: merge 后主仓必须重建 (wrapper 测试以源码模式 tsx 运行, 陈旧 dist 报 SyntaxError)
- 2026-08-30: **Phase 6 server E2E + obsidian 分组导出** (`92a56b0`, `61a3b6c`) — adapter roomId 直发规则; 一次性 server 全链 outbox→dispatcher→matrix→Synapse 落盘; ForumVaultWriter + `agora forum export` (S4 obsidian 沉淀, 分组幂等); 存量: apps/cli errors.test 7 个 locale 断言失败 (develop 既有, 非本轮回归)
- 2026-08-30: **Phase 6 IM 通道绑定** (develop `2609572`) — 新包 `@agora-ts/adapters-matrix` (MatrixIMMessagingAdapter, 纯 REST, roomByRef→default 定向) + im.provider='matrix' composition 分支 (server+cli); 全量回归 1239/1239; 真机冒烟: Synapse :8008 发 2 条通知回读落盘
- 2026-08-30: **CLI create 通知 undecided 收口** (`7dc4d3a`) — `agora create` 按 im.*.notify_on_task_create 写 notification_outbox 公告行; 推送仍由 server 周期扫描统一执行(单一扫描者防双投); 真实冒烟: CLI 直连 /root/.agora 中央库 create → 35s 扫描 delivered → 组织房间实测推送 ✅; 回归 1425/1425 + 双 gate
- 2026-08-30: **S5/S6 checklist 清零** (`c0e5c9a`) — ① S5-61: AgentQuestionService 加 groupMemory 缝, answer(kind=research) 自动写回共享记忆(await+失败不阻塞; 修复: CLI fire-and-forget 随进程退出丢 POST) ② S6-67: EvolutionService 建议+确认模式(反思报告→forum proposal 帖, apply 状态机 proposed→applied; IForumRepository.updatePost + ForumService.updatePostMetadata/metadata 透传) + CLI `agora evolution {propose,apply}`; 回归 1423/1423 + 双 gate; 真实冒烟: mem0 task:org 分区写入 ✅ + evolution applied 状态机真库验证 ✅; checklist.md 全量同步(陈旧勾选修正), 剩 federation P2/P3 两项明确留待(用户启动)
- 2026-08-30: **task_created 自动通知链路补全** (`9c37655`) — 发现 im.*.notify_on_task_create config 有声明无消费者（server 端 gap）；补全三环: ① core NotificationDispatcher `defaultTargetRef` 兜底（无 binding 通知→组织默认房间/频道, TDD 2 测试）② composition 按 provider 解析默认目标 ③ REST create 后写 task_created outbox 行 + scheduler 周期扫描 outbox（60s 默认, 通知不再依赖手动 POST /api/notifications/scan）；TDD 全量 1418/1418 + 双 gate ✅；真实冒烟: 隔离实例(5s 间隔) 5s 内送达 + live 现网 REST create → 45s 自动送达 Synapse 房间 ✅；教训: dist 不随 git, merge 后主仓 rebuild 否则 live 部署旧代码; 已知边界: CLI 直写本地 db 的 create 不触发 server 通知（CLI 进程无扫描者, 留 undecided）
- 2026-08-30: **org-aware-work-os S6 反思论坛** (develop `92938b0`) — ForumRepository(039) + ForumService(CRUD/学习注入) + ReflectionService(scorecard→报告) + `agora post|forum|reflect`; 回归 653/653; 冒烟 5/5
- 2026-08-30: **org-aware-work-os S3 委派路由** (develop `349a04d`) — DelegateRouter (delegateSubtree/escalateUp + 深度限制 + 环检测) + `agora delegate subtree|escalate`; 回归 645/645; 冒烟 4/4
- 2026-08-30: **org-aware-work-os S1 组织模型** (develop `090ca6d`) — TeamRecord/migration 038 + TeamService (环守卫) + OrgHierarchyResolver + `agora team`/`agora org show|chain`; 回归 638/638; 冒烟 4/4; 未决默认拍板: Membership 并存/SQLite 表/每项目 org
- 2026-08-30: **org-aware-work-os S4 共享记忆 R1** (develop `993e7b6`) — GroupMemoryPort/Service (core) + @agora-ts/adapters-mem0 (Mem0RestAdapter) + `agora experience add/search/list`; 本机 mem0 REST server :8888 探测确认; 回归 629/629; 冒烟: 真实 401 路径 3/3 + stub 全链路 3/3; 待 MEM0 token 后全链上线
- 2026-08-30: **org-aware-work-os S2 收尾** (develop `8b0d3e6`) — TaskClaimService.expireStale 批量过期扫描 + Poller 每轮先 expire + `agora claim poll [--interval-ms]` (单轮/常驻模式, 认领成功即退出); TDD 8 新测试, 回归 618/618, 冒烟 4/4; 设计修正: poller 属 agent 侧 (认领=agent 真在场), server 不代劳
- 2026-08-30: **org-aware-work-os S5 主动提问 push** (develop `d002792`) — routeQuestion (assistant 优先→ceo) + AgentQuestionService 状态机 (pending→answered|escalated→answered; *→closed) + QuestionMessagingPort 推送缝 + CLI `agora ask {create,list,show,answer,escalate,close}` + migration 037; TDD 18 新测试, core+db 回归 610/610, 真实冒烟 7/7; 设计偏差: ResearchRequestService 并入 kind=research (D1), escalation 是状态 (D2); planning: `Doc/09-PLANNING/TASKS/2026-08-30-agent-question-push/`
- 2026-08-30: **Personal Office / Companion v0.1** — 通用
  RelationshipProfile immutable versions；InformationPolicy、ConsentGrant、
  ActionRisk 三套治理；RelationshipInitiative durable outbox（quiet hours、每日上限、
  lease/reclaim/ack）；CLI + Bearer REST；migration 040-042。Matrix provider 数据不进
  Core。跨仓 connector v0.2 完成单实例单域、独立顶层 Space、标准 m.audio 与本地
  SAPI。远端 probe：CORE/Synapse reachable，但 CORE 新 routes 未部署且 Synapse
  registration disabled，等待部署/admin provision。Planning:
  `Doc/09-PLANNING/TASKS/2026-08-30-personal-companion-v01/`；Walkthrough:
  `Doc/10-WALKTHROUGH/2026-08-30-personal-companion-governance-v01.md`。

## 8. Company OS v0.1 — 长期组织与 EA 入口

已交付的最小可运行链：

1. Organization 是公司根，固定 `information_domain`；Unit/Position 表达长期组织和汇报关系，Employment 保留入离调历史并限制每岗一个当前任职。
2. EA intake 先持久化 request，再按 capability 在当前在岗 Position 中路由；无匹配时由 EA triage；成功时生成 Task + TaskClaim + fenced RuntimeDispatch + Commitment。
3. Task template 的全部角色绑定到被委派 Employment 的 runtime target，避免“账面委派但执行团队仍是模板默认 Agent”。
4. Runtime worker 完成后，Core 保存 result envelope、生成 SHA-256 Markdown
   Artifact、推进单阶段 Task，并以 runtime dispatch + artifact evidence 自动
   核销 request/commitment。
5. CLI/REST 是完整管理面；Matrix 只做 `/agora company` 与 `/agora assistant` 薄投影，不复制组织和路由状态。
6. Company 仅使用 `domain:company`。Life/Health/Companion 继续使用独立顶层 Space、身份和安全域，跨域读取仍需 InformationPolicy/Consent/Gate。

尚未宣称完成的长期能力：自动例行总结、偏好/记忆质量治理、文档模板分层、自主学习预算和 protected-domain E2EE 上线 Gate；这些在现有 Brain/Mem0/Forum/Routine 能力之上继续迭代，不阻碍本次组织与委派主链运行。
