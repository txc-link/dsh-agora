# Undecided: Shared Work Site

> 用户(t=55): 提供 Tutti·VM 产品介绍, 要求 brainstorm
> agent(t=55): 拆 4 机制 + 设计 4 phase + 落 4 子话题 + 本 undecided

## 已落地的设计

- README.md — 子目录索引 + 已确认决策
- 01-worksite-abstraction.md — WorkSite 抽象 (6 类型 + 适配器模式)
- 02-uri-protocol.md — `agora://<type>/<id>` 单 scheme
- 03-deep-reference-pull.md — matrix-connector pull URI embed event payload
- 04-agent-borrow.md — borrow_request/approval/revocation, dashboard 强制 approve

## 用户必须答的 — 4 个未决

### U1. 单 scheme vs 多 scheme (URI 协议)
- 草案: 单 scheme `agora://<type>/<id>` (已落 02-uri-protocol.md)
- 候选 B: 多 scheme `agora://` + `matrix://` + `git://`
- §1.5 决策草案: 单 scheme (理由: ACL 统一 + 最短路径)
- **等用户确认**: 单 scheme OK? 还是想要多 scheme?

### U2. Phase 4 真项目选哪个
候选 (turn 52 我列了 4 个, 还没选):

| 候选 | 难度 | 价值 | 依赖 Core 改动? |
|---|---|---|---|
| v2.1 stuck auto-reassign | 中 | 中 (carry-over, 收尾) | 🟠 是 (需要 `/api/tasks/:id/retry`) |
| Doc/03-ARCHITECTURE 索引页 | 低 | 低 | ❌ 否 (纯内容) |
| DSH 生态实战蓝图 | 中 | 中 | 🟠 是 (要装/用新插件) |
| v0.0→v3.0 walkthrough | 低 | 中 | ❌ 否 (纯文档) |

**等用户确认**: Phase 4 跑哪个?

### U3. Agent 借用边界 (受控程度)

候选 A: **宽松** — borrow_request ttl ≤ 24h, source_user dashboard 一键 approve
候选 B: **严格** — borrow_request 必须有 reason + 关联 task + ttl ≤ 1h, source_user 必须手写理由 approve

**§1.5 草案**: 候选 B (严格, 跟 turn 25 "受控" 核心对齐)
**等用户确认**: A 还是 B?

### U4. ACL 是跟 Phase 3 一起做, 还是单独 phase

候选 A: **一起** — Phase 3 直接做 borrow + ACL, 不分
候选 B: **单独** — Phase 3 只做 borrow, Phase 4.5 做 ACL 强化

**§1.5 草案**: 候选 A (一起, 最短路径)
**等用户确认**: A 还是 B?

## agent 自己不知道的

- 用户对 Tutti·VM 的态度 — 是想完全抄, 还是部分借鉴, 还是只是灵感?
- 用户对 "Agent 借用" 的需求强度 — 真有跨人 agent 借用的场景吗, 还是 turn 25 提了但没真需求?
- 用户对 "worktree 多用户共享" 的态度 — DSH worktree 现在是单用户, Tutti 是多用户, 我们要走哪边?

## 期望用户回应

期望用户在以下3 类回答中选一个 (按可能性排):

- (a) "草案都 OK, 单 scheme + 严格借用 + ACL 一起做 + 选 Phase 4 真项目 X" — 我开始 Phase 1 实现
- (b) "改 U1/U2/U3/U4 的某个决策" — 我重写对应文档
- (c) "不急 brainstorm, 先去看别的" — 我停下, 等用户下个指令

agent 不主动选 U2 (Phase 4 真项目) — 这必须是用户决策。