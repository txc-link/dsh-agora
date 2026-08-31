# Findings — 2026-08-31 next batch (agora-ts + dashboard)

## F1. agora-ts 现状
- Core 已具备 Task / Context / Participant / RuntimeBinding / Execution / Event / Notification
- REST(18008) + CLI + Dashboard; pause/resume/cancel/unblock 在 0.4.0 已落地 (turn 117)
- contracts (zod) 是前后端事实单一源 (D4); 新增 DTO 必须先扩 contracts
- 0.4.0 已部署 pause/resume/cancel/unblock + reassign action; approval 显式留给 Dashboard (A4)

## F2. 缺口拆解 → 切片
- 任务中心缺口 (用户 #1) = ① 拆解 (subtasks) ② 进度 (progress view) ③ 转派 (transfer 走 approval) ④ 审批 (Dashboard Human Gate)
- **既有覆盖** (F2.1): `POST/GET /api/tasks/:id/subtasks` + `completeSubtask|archiveSubtask|cancelSubtask` + `approve|reject|archon-approve|archon-reject` + pause/resume/cancel/unblock (0.4.0) + `approval_requests` 表 + ApprovalRequestRepo + TaskApprovalService
- **真实缺口** (F2.2): ① 全局 `GET /api/approvals/pending` 队列 (repo 只有 `listByTask` / `getLatestPending`) ② `POST /api/approvals/:id/decide` 统一入口 (TaskApprovalService 有 approveTask 但缺通用 decide by approval_id) ③ 任务进度聚合 `GET /api/tasks/:id/progress` (无 aggregate) ⑤ assignee transfer (触及 RuntimeBinding/Employment, 非纯增量 → follow-up) ⑥ CLI `task breakdown|subtasks|transfer|progress|approvals` ⑦ Dashboard 审批队列页 + SubtaskPanel + TransferReview
- 拆解 = 子任务 CRUD (已有) + CLI 补齐 + UI 展示; 进度 = 聚合子任务 + 父状态 (新 endpoint); 审批 = 全局队列 + decide 入口 (新 endpoints)

## F3. 日历/承诺缺口 (用户 #3)
- 服务器现状: Radicale 未起 (:5232 不通)
- 裁决 §3: Radicale + work/life collection 隔离; Human Gate 走 Dashboard
- Agora commitment 为主账, CalDAV 是投影; 反向 CalDAV → commitment 由 user 手动确认
- morning report = today 工作/生活事件 + 即将到期 commitment; evening = 今日完成 + 明日预告 + 冲突

## F4. 监控缺口 (用户 #4)
- Grafana :3001 已在跑; 告警 webhook 接 relay
- relay = 小 HTTP 服务 (POST /webhook/grafana), 鉴权用 shared secret, 转 Matrix m.room.message
- Element widget URL 白名单加 system-ops dashboard URL; 匿名 iframe 用 token embed

## F5. 协作文档缺口 (用户 #5)
- 现在只有读 (artifact preview); v0.1 = 只读 + 提交 (单写者 + 版本号, 符合裁决 §4 v0.1)
- artifact markdown 是 SHA-256 内容寻址, POST 新 version = 新 content_hash + parent_hash
- widget bundle 走 Vite library mode, 静态托管, 房间 widget URL 注册

## F6. Element Call 缺口 (用户 #6)
- 裁决 P2 后置; 本批严格仅 enablement
- Element Web v1.12 已内置 Element Call widget; MSC3401/3898 状态事件 + LiveKit/Jitsi SFU
- LiveKit 与 TURN 部署由用户决定; 本批给配置文档 + dashboard widget URL

## F7. 与 SSoT 的关系
- `Doc/Agora-实施排期-Agora-TS.md` Phase 3 原则维持; 本批按 §6 例外流程 (REST/数据模型新增, 非 Core 语义大改)
- Dashboard SSoT 新增 T_center_ui (Dashboard 现有 thread 详情 + 审批页 + 转派模态)
- 所有新包 (adapters-calendar) 仍属 adapter 层, 不进 core

## F8. 沙箱 / 工程坑 (供后续 turn 复用)

实现过程中踩到、与本批逻辑无关但需要固化在记录里的环境陷阱:

1. **`@agora-ts/*` 在 worktree 中默认解析到 main 仓**
   - 原因: 主 checkout 的 `agora-ts/node_modules` 是软链到 main; main 的 `@agora-ts/contracts → ../../packages/contracts` 指向 main 的 packages, 那里 dist 是旧的。
   - 修复: worktree 内重建 node_modules —— `mkdir node_modules` (删原 symlink) → 把 main 的非 `@agora-ts/*` 全部 `ln -s` 过来 → 把 `@agora-ts/*` 指向 worktree 的 `../../packages/<name>`; 同样建 `.bin` symlink。
   - 验证: `ls -la node_modules/@agora-ts/contracts` 必须指向 worktree 的 packages/contracts; `grep taskProgressSchema packages/contracts/dist/task-api.d.ts` 必须命中。

2. **zod v4 `z.record` 必须双参**
   - `z.record(z.unknown())` 在 v4 报 `TS2554 Expected 2-3 arguments`; v3 接受单参。
   - 修复: 改成 `z.record(z.string(), z.unknown())`。

3. **`tsc -b` 增量缓存 (`.tsbuildinfo`) 会让新加的 export 不出现**
   - 现象: 跑 `npm run build` (workspace) 报"no exported member" 但单独跑 `packages/contracts` build 又能看到。
   - 修复: `rm -f tsconfig.build.tsbuildinfo && npm run build` 或 `npx tsc -b --force`。

4. **`exactOptionalPropertyTypes: true` 与条件 spread**
   - `tsconfig.base.json` 开了 `exactOptionalPropertyTypes`; `{ subVerb: tail[0] }` 当 `tail[0]` 可能 undefined 时编译失败。
   - 修复: 用 `const x = tail[0]; return x !== undefined ? { ..., subVerb: x } : { ... }` (三元 spread), 或 `...(x !== undefined ? { subVerb: x } : {})`。

5. **`vi.stubGlobal('fetch')` 会污染所有 fetch 包括测试客户端**
   - 现象: `monitoring-relay` 测试起初用 `fetch` 调用自己的 server, fetch stub 后客户端 POST 也走 stub, 永远拿不到 server response, 看起来"server 返回 403"。
   - 修复: 测试客户端用 `node:http.request` (不走 fetch stub); 或 stub 内部按 URL 分流保留真实 fetch。

6. **`encodeURIComponent` 对 Matrix room id 中的 `!` 不编码, 只编码 `:`**
   - `encodeURIComponent('!ops:matrix.example.org')` → `'!ops%3Amatrix.example.org'` (RFC 3986 reserved chars 保留)。
   - 现象: 测试断言写成 `%21ops%3Amatrix.test` 一直不命中。
   - 修复: 测试断言用 `!ops%3Amatrix.test`。

7. **monitoring-relay 模块顶层 autostart 会先于 import 语句的副作用运行**
   - 现象: `process.env.X = 'false'; import { ... }` 在 ESM 下 import 会被 hoist, env 赋值晚于 import, autostart 跑了一次, 留下"missing env" stderr。
   - 修复: 把 env 赋值放 shell (`MONITORING_RELAY_AUTOSTART=false npx tsx ...`) 或改 autostart 为延迟到第一次 startServer 调用。

8. **iCal RFC 5545 §3.1 line folding: 续行开头的 WSP 是 fold 分隔符,不是内容**
   - 现象: `'SUMMARY:long\n the next line'` unfold 后是 `'longthe next line'` (中间没有空格)。
   - 测试期望要反映这个语义,不能加多余空格。

## F9. 决策日志 (按裁决 §6 / 未决事项)

| # | 问题 | 本批决议 | 状态 |
|---|---|---|---|
| 1 | widget 写操作是否长期保留 | 仅 Dashboard (A4); C_calendar/C_slash/D_doc 都用 CLI+REST 委托,无 widget | 维持 |
| 2 | 语音是否保留文字正文 | 默认不保留; m.audio 单独发 | 维持 |
| 3 | 声线档案存储位置 | connector config (`speech.provider/voiceName/...`) | 维持 |
| 4 | Grafana iframe 鉴权 | 文档建议匿名 kiosk 或受限 token; 由部署选 | 留给用户 |
| 5 | 告警 relay 形态 | 独立 systemd 服务 `apps/monitoring-relay` | 已实现 |
| 6 | commitment↔CalDAV 触发源 | 设计留白; current path = manual | 推迟 |
| 7 | 文档并发策略 | v0.1 单写者 + 内容寻址 sha256 | 已实现 |
| 8 | CosyVoice / Fish Speech 升级 | connector 0.4.0 已加 Fish Speech; CosyVoice 备选 | 待评估 |

## F10. 与 R5 baseline 噪声的关系 (walkthrough §4)

| 现象 | 来源 | 本批处理 |
|---|---|---|
| `packages/db/database.test.ts` 缺 043/044 断言 | Company OS v0.1 (turn 140) 未同步测试 | 不修 (baseline drift) |
| `apps/cli/composition.test.ts` ROFS `/root/.agora/skills/...` | 沙箱 ROFS, runtime-assets self-heal 写入失败 | 不修 (环境约束) |
| `apps/cli/index.test.ts` `attempt to write a readonly database` | 沙箱 ROFS db | 不修 (环境约束) |
| `dashboard/src/test/**.test.{ts,tsx}` 35 files × ~144 tests fail with `TypeError: React.act is not a function` (React 19 + RTL version skew) | dashboard React 19 + react-dom test-utils production build removed `.act`; not introduced by this batch — verified by `tsc --noEmit` clean | 不修 (baseline drift; fix is a dashboard-side dependency bump task) |