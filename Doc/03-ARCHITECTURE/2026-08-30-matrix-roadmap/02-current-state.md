# dsh-matrix-connector 当前状态盘点 (2026-08-30)

baseline: matrix main `71c01f6` (turn 117 盘点)

## 1. 仓库

- 仓: `txc-link/dsh-matrix-connector` (独立仓, 不在 monorepo)
- main 分支: `71c01f6` (Merge pull request #1 from txc-link/feat/phase-2-matrix-connector)
- 已 merge PR: #1 (Phase 2 @pull + 3 posture), #2 (R4 thread Room auto-create + registry)
- open PRs: 0

## 2. src 目录结构 (20 个文件)

| 文件 | 状态 | 备注 |
|---|---|---|
| `index.ts` | 入口 | — |
| `config.ts` | bridge config | — |
| `matrix-client.ts` | **stub** | `MatrixClient.createRoom` 抛 `'transport does not implement createRoom'`, MatrixTransport 是 interface, 实现是测试 stub |
| `thread-registry.ts` | ✅ 实现 | upsert/getByRoomId/allBindings, JSON 持久化 |
| `uri-parser.ts` | ✅ 实现 | VALID_TYPES + thread URI `agora://thread/mx_xxx` |
| `pull-handler.ts` | ✅ 实现 | RoomCreatePullRequest/Response/handlePullWithRoomCreate + posture gating |
| `audit-trail.ts` | ✅ 实现 | JSONL audit + AuditRecord |
| `acl-bundled.ts` | ✅ 实现 | 三 posture ACL with scope |
| `bridges.ts` | ✅ 实现 | bridge 连接配置 |
| `posture-middleware.ts` | ✅ 实现 | gate check |
| `message-router.ts` | ✅ 实现 | pull → bridge 路由 |
| `rollup.ts` | ✅ 实现 | 消息合并 / state 投影 |
| `room-roster.ts` | ✅ 实现 | member 列表 |
| `status-panel.ts` | ✅ 实现 | health snapshot |
| `stuck-alert.ts` | ✅ 实现 | /agora stuck 命令 |
| `stuck-list.ts` | ✅ 实现 | stuck task list |
| `agora-rest.ts` | ✅ 实现 | REST client |
| `artifact-summary.ts` | ✅ 实现 | post-mortem 摘要 |
| `post-mortem.ts` | ✅ 实现 | 自动回投 |
| `dispatch-args.ts` | ✅ 实现 | arg 解析 |

## 3. 真实集成状态

| 维度 | 状态 |
|---|---|
| 真实 matrix homeserver 连接 | ❌ 仅 stub transport |
| matrix-js-sdk 依赖 | ❌ 未引入 |
| 真实 sendMessage 链路 | ❌ 仅 audit 落盘, 无 send |
| 真实 receive/reply 同步 | ❌ 仅 polling inbox (sse) |
| E2EE | ❌ 未实现 |
| Federation | ❌ 未实现 |
| Space 层级 | ❌ 未实现 |
| attachments / file upload | ❌ 未实现 |
| reaction 事件 | ❌ 未实现 |

## 4. 测试覆盖

- `tests/matrix-room-auto-create.test.mjs` 12 cases (R4 thread Room auto-create)
- 历史测试: pull posture, ACL bundles, audit, registry 持久化
- 沙箱 EROFS 限制 (`/root` 只读): 部分 smoke 测试需 homeserver 环境

## 5. 与 agora 主仓 (dsh-agora) 集成

- matrix `agora://thread/mx_xxx` URI 在 dsh-agora `agora-ts/packages/core/src/worksite/uri.ts` 已注册 (`VALID_TYPES` 含 `thread`)
- **resolver 未实现**: `WorksiteResolverRegistry` 注册时只有 task resolver, thread type `resolveWorksite` 抛 `WorksiteNotImplementedError` (Phase 1 留的 5 个 stub 之一)
- Phase 3 borrow 的 scopeAuthorization 可引用 worksite.thread.metadata.scopeAuthorization (但 worksite registry 目前查不到 thread 实例)

## 6. 总结

matrix 仓 main 已具备 **协议层完整骨架** (URI, ACL, posture, audit, registry, pull handler) 但 **transport 层是 stub**. 真实运行依赖 homeserver 时无法 connect / create room / send / receive, 所有功能只能靠测试 stub 验证.