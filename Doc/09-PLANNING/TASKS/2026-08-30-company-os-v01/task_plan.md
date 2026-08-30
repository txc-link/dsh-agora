# Task Plan: Company OS v0.1

> 日期: 2026-08-30
> 来源: 用户要求继续完成“组织关系、任务、文档、助手、团队协同”，并以可长期运行的 Agent 公司为验收口径
> 架构: `Doc/03-ARCHITECTURE/org-aware-work-os/`

## Worktree

- 路径: `E:\Learn AI Agent\dsh-agora-company-v01`
- 分支: `feat/company-os-v01`
- 基线: `master 24869e0`
- 使用独立 worktree 原因: 本轮跨 Core、DB、CLI、REST、Matrix bridge 与部署，属于多文件主链路改动。
- 文档位置说明: 当前公开聚合仓不含私有 `docs/`，按公开仓规范使用 `Doc/`。

## 目标

交付“最小可运营 Agent 公司”纵向切片，而不是只增加孤立服务：

1. 建立跨项目长期存在的 Organization / Unit / Position / Employment 模型，保留汇报关系与任职历史。
2. 建立第一等 Executive Assistant：统一接收 CEO 请求、登记承诺、按职责选择负责人并创建任务。
3. 对组织、任职和 EA 请求提供 Agent-first CLI 与 REST；Matrix 只做轻量 bridge，不复制编排语义。
4. 将任务交付物、决策与复盘纳入可检查的文档策略，至少跑通一条标准任务链。
5. 在中央服务器建立最小组织、EA、研究与工程岗位，并验证重启恢复。
6. 保持 Personal/Life/Health/Companion 与 Company 的信息安全边界独立；本轮不把它们建成 Company 下普通部门。

## 范围边界

- 本轮优先“一个组织 + 一个 EA + 两个团队/岗位 + 一个真实任务闭环”。
- 组织模型 provider-neutral；Matrix room、DSH runtime、具体模型名不进入 Core。
- LLM 自由文本规划通过端口扩展；Core 首版使用确定性职责匹配，避免把模型 provider 写死。
- 暂不实现自动支付、健康建议执行、Personal E2EE、跨 homeserver federation。
- 自动组队和跨节点 L4 记忆不阻塞 v0.1，但必须保留明确后续项。

## 轮次

| 轮次 | 内容 | 状态 |
|---|---|---|
| R1 | 现状审计、模型定稿、planning 与失败测试 | done |
| R2 | Organization / Unit / Position / Employment Core + SQLite | done |
| R3 | Executive Assistant Inbox / Commitment / routing + Task 联动 | done |
| R4 | CLI + REST + Matrix 轻量入口 | done |
| R5 | 文档制品、端到端 scenario、重启恢复 | done |
| R6 | 合并、推送、服务器部署、最小组织初始化与真机验收 | done* |

`*` Core 与 node-b 已部署；connector npm registry 发布仍因外部 npm
认证缺失待补，node-b 不依赖 registry，当前实际运行 0.3.0。

## 验收

1. 创建组织后可建立部门、岗位、上下级岗位，并拒绝跨组织引用和汇报环。
2. Citizen 入职岗位形成 Employment；转岗/离职保留历史，任一岗位的当前任职唯一。
3. Organization 独立于 Project；多个项目可由同一公司承接。
4. CEO 向 EA 提交请求后形成 durable inbox item 与 commitment。
5. EA 按职责将请求路由到 active 岗位/员工并创建 Agora task；无人可接时保留 blocked 原因而不静默丢失。
6. 任务完成后 commitment 与 EA request 可闭环，关键产物/决策/复盘可查询。
7. CLI、Bearer REST 和 Matrix 轻量命令都调用同一 Core 服务。
8. 进程重启后组织、任职、请求、承诺、任务和文档引用全部恢复。
9. 线上最小组织至少包含 CEO/EA、Research、Engineering、Audit 职责；至少两个常驻 Agent 身份可见。
10. Life/Health/Companion 不出现在 Company 组织树或普通 Company Space 投影中。
