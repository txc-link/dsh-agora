# dsh-matrix-connector 完整 Roadmap 条目 (2026-08-30)

> 来源: turn 117 用户授权 tier1/2/3 列入未来开发计划.
> 与 README.md 配套: README 是排期 + 依赖; 本文是逐条目的目标 + 价值 + 成本 + 依赖 + 未决事项.
> baseline: matrix main `71c01f6`.

---

## Tier 0 — Phase 1 留的 stub (hygiene)

### T-0: matrix thread → WorkSite resolver

**目标**: 修 Phase 1 留的 5 个未实现 WorkSite resolver 之一. 当前 `WorksiteResolverRegistry` 只注册 task resolver, thread type `resolveWorksite(uri)` 抛 `WorksiteNotImplementedError`.

**价值**: ★★★★ — WorkSite 抽象的"全地址空间统一"承诺漏一角. 不补则 `agora://thread/mx_xxx` 永远不能通过通用 resolver 路径访问.

**实现位置**: `agora-ts/packages/core/src/worksite/thread-resolver.ts` (新文件) + `worksite/registry.ts` 注册 (现有 task-resolver 旁边).

**依赖**: thread metadata 来源 = matrix thread-registry JSON (cross-repo read) 或 thread URI 直接读 + matrix REST API (`agora-rest.ts`).

**输入/输出**:
- 输入: `agora://thread/mx_xxx` + resolution context
- 输出: `ThreadWorksite` (Phase 1 已定义 type, 含 `roomId`, `messages`, `currentEvents` 等)

**未决**: thread resolver 是否需要实时同步 messages (慢), 还是按需 fetch (推荐)? 现 stub 是按需, matrix 侧已有 REST API.

**估计**: 半 PR / 1-2h.

---

## Tier 1 — 强烈推荐

### T-1: 真实 MatrixTransport 实现 (matrix-js-sdk adapter)

**目标**: 实现 `MatrixTransport` interface (`matrix-client.ts`), 用 matrix-js-sdk 真实连接 homeserver. 当前是 stub — 测试里 `throw new Error('transport does not implement createRoom')`.

**价值**: ★★★★★ — matrix 仓 main 现在**没有任何一行真实 transport code 跑过**. 全部"功能"靠 stub transport 验证. 做完 R-B 才算"matrix 真能用".

**实现位置**: `dsh-matrix-connector/src/transport/matrix-js-sdk.ts` (新文件) + `index.ts` factory 选 transport.

**接口契约** (matrix-client.ts 已定义):
- `connect({ homeserverUrl, accessToken })`
- `createRoom({ name, topic, visibility })` — R4 Room auto-create 的真正实现
- `sendMessage({ roomId, body, format })`
- `editMessage({ roomId, eventId, body })`
- `deleteMessage({ roomId, eventId })`
- `listMessages({ roomId, since })`
- `syncState()` — SSE 状态同步
- `disconnect()`

**依赖**:
- matrix-js-sdk ^30+ (与 node 22 兼容)
- 真实 homeserver 测试实例 (沙箱无, 需 docker 或 homeserver.org 公共账号)
- E2EE 决策 (T-7 优先级)

**未决**:
- 是否引入 @matrix-org/matrix-sdk-crypto-wasm (E2EE) — 早期 stub 可不引入, 后续 T-7 加
- bot 身份 vs app-service — 默认 bot, app-service 留可选 (T-10)

**估计**: 1-2 PR / 4-6h (含 homeserver 接入测试).

---

### T-1.5: thread ↔ Task 双向 state 投影

**目标**: agora Task 状态变更 (running/blocked/done) 自动投影到对应 matrix thread (room name / topic / pinned message). matrix thread 里的 reply/reaction 也会回写为 agora Task progress markers.

**价值**: ★★★★★ — 现在 thread 只是单向镜像. 真实场景里 IM 用户通过 reply 反馈决策, 必须回写到 agora Task, agora 才算"真正接管"工作现场.

**实现位置**:
- dsh-matrix-connector/src/projection/task-state-to-thread.ts (Task → thread)
- agora-ts/apps/cli 或 apps/server: thread webhook → Task update (reply → inbox/comment, reaction → progress marker)

**依赖**: T-1 (真实 transport); Phase 3-5-3a (scope 接入).

**未决**: 双向同步冲突解决 — last-write-wins vs agora 是 source-of-truth (推荐后者, IM 是投影层).

**估计**: 1 PR / 3-4h.

---

### T-3: matrix reply-to 事件 → agora inbox/comment

**目标**: matrix 原生 `m.in_reply_to` 事件 → agora inbox 或 task comment. 让 IM 用户用最自然的 reply 形式给 agora task 反馈.

**价值**: ★★★★ — matrix 原生 threading 没用上等于浪费. reply 是 IM 用户最自然的反馈形式.

**依赖**: T-1; matrix m.in_reply_to 事件解析.

**未决**: reply 是进入 task conversation 还是独立 inbox? 推荐 task conversation (跟 task 强关联).

**估计**: 1 PR / 2-3h.

---

## Tier 2 — 推荐 (与 agora 主线契合)

### T-4: matrix Space 层级 (嵌套 thread)

**目标**: matrix Space 是层级化 room 容器 (类似 Discord server categories). 一个 agora project 对应一个 Space, task thread 是 Space 子 room.

**价值**: ★★★★ — matrix Space 是它的杀手级特性 (vs Discord 没有). agora WorkSite 抽象支持嵌套, 正好对接.

**依赖**: T-1; Worksite resolver 支持嵌套 (T-0 是前置).

**未决**: Space permission model vs agora member model 是否对齐? (推荐 agora member model 是 source-of-truth, Space ACL 是投影).

**估计**: 1-2 PR / 4-6h.

---

### T-5: thread message edit/delete 同步到 agora artifact 修订

**目标**: matrix 允许 edit/delete message; agora artifact 也支持修订. 同步两端.

**价值**: ★★★ — matrix 支持 edit/delete 现在没同步. 修订历史对 audit/可追溯性重要.

**依赖**: T-1; agora artifact 修订 API (已存在? 待 verify).

**估计**: 半 PR / 1-2h.

---

### T-6: multi-homeserver 联邦支持 (matrix federation)

**目标**: matrix 的根本优势是联邦. agora 是单租户模型, 联邦 = 让外部 matrix server 上的用户也能 join agora thread.

**价值**: ★★★ — 但有"是否要支持" 的根本决策: agora 单租户模型扩展性.

**未决**:
- agora 是否要扩展为 multi-tenant / federated? (回答: 暂不支持, 但 seam 留好)
- 即使不联邦, matrix-jssdk 也需支持 federation-capable server 配置

**估计**: 1-2 PR / 6-8h (含架构决策).

---

## Tier 3 — 可选 (外围/运营)

### T-7: matrix E2EE 端到端加密

**目标**: matrix-js-sdk crypto (olm/megolm) 集成. encrypted room 端到端加密, agora server / matrix server 都看不到消息内容.

**价值**: ★★★ — matrix 原生 E2EE 是核心卖点. 但 crypto 复杂度高.

**依赖**: T-1; @matrix-org/matrix-sdk-crypto-wasm (或 olm).

**未决**:
- agora Task state 是否也要 E2EE? (回答: 不, task metadata 需可审计)
- key backup 策略: 用户本地 / agora server 代理 / 完全不备份?

**估计**: 1-2 PR / 6-10h (crypto 复杂).

---

### T-8: matrix Webhook 入站 (不只 pull)

**目标**: matrix homeserver 配置 webhook (push rules / app-service), 实时推送事件到 agora 而不是 agora 主动 polling.

**价值**: ★★ — 比 polling/inbox 低延迟. 但 webhook 需要 homeserver 端配置.

**依赖**: T-1; homeserver push rules 配置.

**估计**: 1 PR / 2-3h.

---

### T-9: matrix attachment / file upload

**目标**: matrix 消息支持 attachments (image/audio/file). agora artifact 支持, 需打通.

**价值**: ★★ — attachments 是 IM 重要功能.

**依赖**: T-1; agora artifact storage 决策 (本地 / S3 / IPFS).

**未决**: artifact storage 决策. 暂本地.

**估计**: 1 PR / 2-3h.

---

### T-10: matrix app-service 模式 (非 bot 身份)

**目标**: matrix app-service (而非 bot 身份) 接入. app-service 可伪装成任意用户, 权限更强大.

**价值**: ★★ — 但 homeserver 端配置复杂, 一般项目用 bot 就够.

**依赖**: T-1 + agora model 决策 (是否要支持多用户伪装).

**未决**: agora 是否要支持"用 matrix 任意用户身份发 thread"? 默认不, 但留 seam.

**估计**: 1 PR / 3-4h.

---

### T-11: matrix reaction → agora progress markers

**目标**: matrix reaction 事件 (👍 / 👎 / ❓) → agora task state 投影 (ack / not / needs_clarification).

**价值**: ★ — reaction 是轻量反馈形式, 但语义映射需谨慎 (👍 不一定 = ack).

**依赖**: T-1.

**未决**: reaction → state 映射规则 (策略配置 vs 硬编码).

**估计**: 半 PR / 1-2h.

---

### T-12: matrix rate limit / retry / circuit breaker (韧性)

**目标**: matrix homeserver 限流 / 重试 / 断路器. homeserver rate limit (429) 时自动 backoff + retry; 持续失败时断路.

**价值**: ★ — 韧性, 长期运营必需.

**依赖**: T-1.

**估计**: 半 PR / 1-2h.

---

## 排期建议 (recap)

详见 `README.md` §1:

```
R-A (T-0) → R-B (T-1) → {R-C (T-1.5) || R-D (T-3) || R-E (T-4)}
                            ↓
                            {R-F (T-5) || R-G (T-7) || R-H (T-2) || ...}
```

总估计 (按推荐顺序): **R-A 1-2h + R-B 4-6h + R-C/R-D/R-E 各 3-6h ≈ 2-3 周** (单 dev 估时).

---

## 关联

- `02-current-state.md` — baseline 盘点
- `README.md` — 排期建议 + 未决事项
- `Doc/03-ARCHITECTURE/2026-08-30-ecosystem-design-inputs/decisions.md` §U1/§U2 — 设计原则
- `Doc/10-WALKTHROUGH/2026-08-30-phase-3-phase-4-borrow-stuck.md` — 已实现 P3.5-1/2 走通, 真实 thread 落地依赖 R-B/R-C