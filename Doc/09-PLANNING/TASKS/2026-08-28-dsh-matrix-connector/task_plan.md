# dsh-matrix-connector 任务规划

## 1. 任务来源
2026-08-28，用户与 DSH agent 多轮讨论收敛：
- 用户已部署 Synapse 中央 homeserver（`8.136.15.147:8008`，v1.12 协议，register 已关）
- agora 中央 server 已在 `127.0.0.1:18008` 跑通
- dsh-agora 0.6.0 已绑定 nodeId `ailink-web`
- agora-ts + dsh-agora 仓对 matrix **零代码**

## 2. 任务目标
组织**专家架构讨论**，回答战略 5 题；落 `Doc/03-ARCHITECTURE/dsh-matrix-entry-adapter/` 设计文档；
明确 v0.1 / v0.2 / v1.0 三阶段交付边界；不写实现代码。

## 3. 工作树
本任务为讨论与文档任务，未触动实现代码。
调研材料沉淀在 `/home/ailink/dsh-agora/.audit/`。
讨论文档落在 `Doc/03-ARCHITECTURE/dsh-matrix-entry-adapter/`。

## 4. 阶段

| 阶段 | 产物 | 状态 |
|---|---|---|
| 1. 实测验证 | Synapse 协议层活 / agora health ok / 仓内零 matrix | ✅ done |
| 2. 架构讨论 | `01-strategic-questions.md`、`02-adapter-boundary.md`、`03-identity-model.md` | pending |
| 3. v0.1 范围定义 | `04-v01-scope.md` | pending |
| 4. 风险清单 | `05-risks.md` | pending |
| 5. README 索引 | `dsh-matrix-entry-adapter/README.md` | pending |
| 6. undecided.md | 未决问题兜底 | pending |

每阶段前读本文件，后更新 `progress.md`。

## 5. 工作流约束
- §1.5：必须先回答动机/目标/约束/验收，再写实现
- §3：讨论必须落盘，分已确认 / 未决
- §8：只写公开 Doc/，不污染私仓
