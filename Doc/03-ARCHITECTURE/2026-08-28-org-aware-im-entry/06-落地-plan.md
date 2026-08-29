# 06 — 落地方案（v0.1 立即启动）

## 1. 仓库位置

**独立 npm 包**：仓名 `dsh-matrix-connector`
本地路径：`/home/ailink/dsh-matrix-connector/`

不在 agora 主仓内（正交：dsh-agora 是 runtime host adapter，dsh-matrix-connector 是 entry adapter）。

## 2. worktree 策略（按 §3 默认）

```
主工作区（不变）：/home/ailink/dsh-agora
新建 worktree：/home/ailink/dsh-agora/.worktrees/feat-dsh-matrix-connector/
  └─ 新 git 仓 dsh-matrix-connector/
```

主工作区干净（除 `.audit/` 与 2026-08-28-* 文档），本任务不动主工作区实现代码。

## 3. 阶段（v0.1 — 4 周）

### 阶段 1：仓初始化 + RED test 骨架

**产物**：
- `package.json`（dep: matrix-js-sdk, cordis@^4.0.0-rc.8, dsh-agora/sdk）
- `dsh.plugin.json`
- `cordis.patch.yml`
- `src/index.ts`（cordis plugin entry）
- `tests/*.test.mjs`（5 个测试文件骨架，RED）

**验收**：
- `npm install` OK
- `npm test` 全 RED（测试存在但未实现）

**估计**：0.5 工作日

### 阶段 2：matrix-client 绿

**产物**：
- `src/matrix-client.ts`（matrix-js-sdk 封装：login / sync / send / edit / upload mxc）
- `tests/matrix-client.test.mjs`（mock sdk，3 case）

**验收**：
- 3/3 test pass

**估计**：2 工作日

### 阶段 3：message-router 绿

**产物**：
- `src/message-router.ts`（解析 `/agora <verb> [args]` + 路由到对应 bridge）
- `tests/message-router.test.mjs`（4 case）

**验收**：
- 4/4 test pass

**估计**：1 工作日

### 阶段 4：citizen-bridge 绿

**产物**：
- `src/citizen-bridge.ts`（调 agora 中央 citizen API）
- `tests/citizen-bridge.test.mjs`（mock fetch，3 case）

**验收**：
- 3/3 test pass

**估计**：1 工作日

### 阶段 5：task-bridge 绿

**产物**：
- `src/task-bridge.ts`（调 agora 中央 task API + polling /api/events）
- `tests/task-bridge.test.mjs`（mock fetch，3 case）

**验收**：
- 3/3 test pass

**估计**：1 工作日

### 阶段 6：attention-bridge 绿

**产物**：
- `src/attention-bridge.ts`（调 agora 中央 brain search API）
- `tests/attention-bridge.test.mjs`（mock fetch，2 case）

**验收**：
- 2/2 test pass

**估计**：0.5 工作日

### 阶段 7：provision-bot 脚本

**产物**：
- `scripts/provision-bot.sh`（admin 调 `_synapse/admin/v1/register` 开新 bot）
- `scripts/provision-bot.test.sh`（mock + 集成）

**验收**：
- 脚本可执行，输出 bot token env
- README 含使用步骤

**估计**：1 工作日

### 阶段 8：smoke-matrix 真 Synapse 调试

**产物**：
- `tests/smoke-matrix.mjs`（端到端：注册 bot → 进房间 → 触发 dispatch → 验证结果）
- 调试通过

**验收**：
- 真 Synapse（`8.136.15.147:8008`）上跑通

**估计**：1 工作日

### 阶段 9：README + walkthrough + 回写

**产物**：
- `README.md`（部署 + 使用）
- `Doc/10-WALKTHROUGH/2026-08-28-dsh-matrix-connector-v0.1.md`
- 更新 `Doc/09-PLANNING/TASKS/2026-08-28-org-aware-im-entry/progress.md`
- 更新 `Doc/03-ARCHITECTURE/2026-08-28-org-aware-im-entry/README.md`

**验收**：
- README 含 admin 怎么开 token + 用户怎么 invite bot
- walkthrough 演示 v0.1 主链路

**估计**：1 工作日

### 总计

**9 工作日 ≈ 4 周**（5/2 节奏）

## 4. TDD 验收门槛（按 §4）

1. 每个阶段前读 `Doc/09-PLANNING/TASKS/2026-08-28-org-aware-im-entry/task_plan.md`
2. 每个阶段后更新 `progress.md`
3. `npm run typecheck` 0 错误
4. `npm test` 全绿
5. `npm run smoke:matrix` 真 Synapse 跑通
6. 不能未验证就声称完成

## 5. 回写清单（按 §4 + §8）

| 回写到 | 何时 |
|---|---|
| `Doc/03-ARCHITECTURE/2026-08-28-org-aware-im-entry/README.md` | 每阶段完成 |
| `Doc/09-PLANNING/TASKS/2026-08-28-org-aware-im-entry/progress.md` | 每阶段后 |
| `Doc/10-WALKTHROUGH/2026-08-28-dsh-matrix-connector-v0.1.md` | v0.1 完成 |
| agora 中央 server（dsh-agora） | **不写**——agora 中央零改动 |

## 6. 部署清单（用户验收）

- [ ] admin 跑 `provision-bot.sh` 开 bot 账号 → 拿 token
- [ ] 用户在 Element 邀请 bot 进房间
- [ ] 装 `dsh-matrix-connector` 进 `~/.dsh/profiles/web/node_modules`
- [ ] `cordis.patch.yml` 加 `id: matrix-connector` 配置块
- [ ] 重启 DSH，验证 connector 启动 OK（无 /sync 错误）
- [ ] 房间输入 `/agora citizen list` → 看见 citizen 列表
- [ ] 房间输入 `/agora dispatch ask REMOTE_OK` → 占位 → 编辑结果

## 7. CI / 测试策略

- 单测全在 CI 跑
- smoke-matrix 不进 CI（需要真 Synapse + 真 agora 中央 + 真 DSH Agent）
- smoke 在本地 / 预发布环境跑
- regression 脚本（按 §4）v0.2 评估

## 8. 风险与降级

| 风险 | v0.1 降级策略 |
|---|---|
| agora 中央 `/api/events` 接口不存在 | 退化为 polling `/api/dispatch` 或 `/api/tasks` |
| matrix 中央不可达 | matrix-js-sdk 内置重连，房间无响应但 DSH 节点在线 |
| agora 中央不可达 | matrix 房间回 "agora unavailable" |
| bot token 失效 | 启动 fail-fast，DSH 报错 |
| message-router 解析错 | 房间回 "❌ unknown command" |

## 9. v0.2 / v1.0 触发条件

- v0.1 全部验收通过 + 用户体验反馈
- 进入 v0.2 = 卡片协议落地 + 4 类 context 流
- v0.2 全部验收 + 用户需求强度 → 进入 v1.0

不预设"v0.2 必须在 X 周后启动"——按 §1.5 不允许过度设计。

## 10. 现在（你已确认三题"是"）

**等你最后一句"动手"**。我立刻开 worktree + 初始化 dsh-matrix-connector 仓 + 写 RED test 骨架（阶段 1）。

按 §1.5 我**不再加更多轮次问题**。