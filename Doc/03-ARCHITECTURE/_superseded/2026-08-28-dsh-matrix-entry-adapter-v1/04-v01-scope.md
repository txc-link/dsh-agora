# v0.1 范围 — 严格最小可交付

## v0.1 目标（单句）

**跑通一条消息从 Element 进来 → 经过 agora 中央 → DSH Agent 完成 → 回 Element 房间**。

## v0.1 功能清单（必须实现）

### 入站
1. 单 DSH 节点连单 Synapse homeserver
2. 单 bot 账号（每 DSH 节点一个 bot）
3. /sync long-poll（matrix-js-sdk 内置）
4. 文本消息 + `/agora ...` 命令消息
5. allowFrom 白名单过滤
6. message-router 解析命令（/agora dispatch/list/status/show/im/health/help）
7. 调 agora 中央 `/api/dispatch`
8. 拿 dispatch_id 后立即回房间 "🤖 thinking..."

### 出站
9. agora 中央事件 polling（5s 间隔，读 /api/events?since=<seq>）
10. 状态变化 → edit 占位消息
11. 最终结果文本 → matrix 中央 editMessage，format='org.matrix.custom.html'
12. 失败 → 错误消息，**不重试**避免 spam

### 部署
13. cordis.patch.yml 字段定义
14. README 部署步骤（admin 怎么开 token，用户怎么 invite bot）
15. `provision-bot.sh` 脚本（开新 bot 账号）

### 测试
16. 单测：matrix-client（mock sdk）
17. 单测：message-router（纯函数）
18. 单测：agora-bridge（mock fetch）
19. 冒烟：smoke-matrix.mjs 在真 Synapse 跑通

## v0.1 明确不做

- ❌ voice / STT / TTS（v0.2）
- ❌ 卡片 / 富交互（v1.0）
- ❌ E2EE（v0.2 评估）
- ❌ 多 bot 协作（v0.1 单 bot）
- ❌ room 状态同步 / 历史拉取
- ❌ 自然语言 fallback（v0.1 只认 `/agora` 前缀命令）
- ❌ mxid 身份映射 / 权限（v1.0）
- ❌ agora 中央事件流改造（agora 中央**完全不动**）
- ❌ matrix 中央改造（Synapse**完全不动**）

## v0.1 部署拓扑

```
一台服务器（已有）：
  Synapse :8008  ← homeserver
  agora 中央 :18008
  Element Web :8080

每 DSH 节点（新增 dsh-matrix-connector）：
  DSH 进程 + dsh-agora plugin
  DSH 进程 + dsh-matrix-connector plugin  ← 本次
  每节点 = 1 个 matrix bot 账号
```

## v0.1 验收（按 Doc/reference/testing-standard.md）

1. `npm run typecheck` 0 错误
2. `npm test` 单测全绿
3. `npm run smoke:matrix` 在真 Synapse 跑通：
   - 用户发 `/agora dispatch dsh:node-a:default prompt:REMOTE_OK`
   - placeholder 出现
   - 状态变化 edit 占位
   - 最终结果 "REMOTE_OK" 出现
4. README 含完整部署步骤 + admin bot 开号流程
5. Doc/10-WALKTHROUGH/2026-08-28-dsh-matrix-connector.md 写完

## v0.1 工作量估算（资深架构师 C 视角）

| 任务 | 工作日 |
|---|---|
| 新仓初始化（package.json / dsh.plugin.json / cordis.patch.yml） | 0.5 |
| matrix-client.ts + 单测 | 2 |
| message-router.ts + 单测 | 1 |
| agora-bridge.ts + 单测 | 1 |
| provision-bot.sh + 测试 | 1 |
| smoke-matrix.mjs + 真 Synapse 调试 | 1.5 |
| README + walkthrough | 0.5 |
| 总计 | **7.5 工作日 ≈ 6 周（按 5/2 节奏）** |

## v0.2 / v1.0 预留扩展点（**架构上必须留**）

虽然 v0.1 不做，但**架构上必须预留**：

| 扩展点 | v0.1 怎么处理 |
|---|---|
| threadKey 抽象 | v0.1 connector 自己生成 `mx_<sha256>` 作为 threadKey，agora 中央完全无感 |
| actor opaque | v0.1 actor 字段就是 mxid 原文，agora 中央不解析 |
| result envelope `format` | v0.1 result envelope 加 `format: 'text' \| 'html'` 字段（v1.0 才用 'card.v1'） |
| 命令扩展点 | v0.1 command parser 用可扩展表，新增命令不动核心 |

## v0.1 工作流（按 §3 + §4）

### 阶段
1. 仓初始化 + RED test 骨架
2. matrix-client + 单测
3. message-router + 单测
4. agora-bridge + 单测
5. provision-bot + README
6. smoke-matrix 真 Synapse 调试
7. walkthrough

每个阶段前读 `Doc/09-PLANNING/TASKS/2026-08-28-dsh-matrix-connector/task_plan.md`，
后更新 `progress.md`。

### 工作树
按 §3 必须开 worktree。建议：
```
/home/ailink/dsh-agora/.worktrees/feat-dsh-matrix-connector/
  → 新 git 仓 dsh-matrix-connector
```

主工作区干净（除 `.audit/`），与本任务无冲突。
