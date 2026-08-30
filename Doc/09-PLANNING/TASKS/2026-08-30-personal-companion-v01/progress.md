# Progress: Personal Companion v0.1

> 2026-08-30 · active

| 轮次 | 状态 | 证据 |
|---|---|---|
| R1 架构与计划 | done | worktree 与 public planning 已建立 |
| R2 Core/DB | done | migration 040/041/042；档案、治理与主动 outbox 重启恢复 |
| R3 CLI/REST | done | CLI + Bearer REST；主动消息 schedule/claim/ack |
| R4 Matrix/TTS | done | connector v0.2；标准 m.audio；真实 SAPI WAV |
| R5 Space 隔离 | done | 单实例单域、顶层 root、独立 bot 部署校验、负向测试 |
| R6 真机/回写 | partial | CORE 已部署且新路由 200；npm/node-b 完成，专用 Matrix 身份尚未 provisioning |

## 已落地行为

- InformationPolicy immutable versions + purpose/retention/sharing mode。
- ConsentGrant 最小字段/目的/权限/源域/目标域/有效期匹配与撤销。
- sensitive-personal 强制 explicit + expiry。
- ActionRisk strict-personal-v1：支付/订阅/敏感披露/健康/第三方副作用强制 Human Gate。
- RelationshipProfile immutable versions + status CAS。
- CLI: `relationship` / `information` / `consent` / `risk`。
- REST: `/api/relationships*` 与 `/api/governance/*`，受现有 Bearer token 保护。
- RelationshipInitiative: provider-neutral schedule/quiet-hours/daily-limit/
  lease/recovery/delivered-failed ack；Core 不保存 roomId。
- Connector: 主动领取后执行 authorize → risk → local TTS → Matrix → ack。

## 环境

- Worktree/branch: merged to `master` at `e5b6e16`, temporary worktree cleaned
- Node: v25.9.0
- Windows SAPI: `Microsoft Huihui Desktop`, `Microsoft Yaoyao` 等中文女声可用
- ffmpeg: 未安装；本轮 Matrix 音频冒烟使用 WAV

## 验证与部署状态

- `npm run build`: pass。
- 新功能定向测试：24/24 pass；connector 全量 212/212 pass。
- `packages/db/src/database.test.ts` 的 21 个用例断言均执行，但 Windows teardown
  因既有未关闭 SQLite handle 报 EPERM；与本切片无关，专门的持久化测试通过。
- `8.136.15.147`: server fast-forwarded to `e5b6e16`; build passed and
  `agora.service` restarted active. Health/relationship/initiative/consent routes
  all return authenticated 200。
- Synapse public registration remains disabled；没有复用 Company bot 创建伪隔离
  Space。专用 Life/Health/Companion 身份和 E2EE durable store 仍是部署 gate。
