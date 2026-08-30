# Progress: Company OS v0.1

> 2026-08-30 · deployed

| 轮次 | 状态 | 证据 |
|---|---|---|
| R1 审计与设计 | done | 主仓/线上只读审计完成；worktree 与 planning 已建立；失败测试先红 |
| R2 组织 Core/DB | done | migration 043；OrganizationService/Repository；定向 6/6；workspace build pass |
| R3 EA/任务联动 | done | ExecutiveRequest + Commitment；模板角色绑定任职 runtime；task claim |
| R4 CLI/REST/Matrix | done | 完整 REST/CLI；connector 0.3.0 company/assistant 薄入口 |
| R5 文档与 E2E | done | 定向 12/12；connector 225/225；重启恢复实测 |
| R6 部署 | done* | Core 与 node-b 已部署；npm registry 因凭据失效待发布 |

## 环境

- Worktree: `E:\Learn AI Agent\dsh-agora-company-v01`
- Branch: `feat/company-os-v01`
- Baseline: `24869e0`
- 主工作区与 connector 主工作区在开工时均 clean。

## 已完成检查

- 完整读取根 `AGENTS.md`、公开 contributor reference、Core 解耦/执行/测试/工程/文档/walkthrough 规范。
- 完整读取 agora-ts SSoT 与 org-aware-work-os README、01-05、undecided。
- 确认线上“组织已运营”条件未满足，当前为模块底座。

## R2 已落地

- Organization 独立于 Project，固定 `informationDomain`。
- Unit/Position 双层组织图，均拒绝跨组织引用和层级环。
- Employment 绑定 provider-neutral human/agent ref；一个岗位最多一个当前任职，ended 历史永久保留。
- 转岗会结束旧任职并创建新任职，原记录可查询。
- `043_company_organization.sql` 与 repository 重启恢复测试通过。
- `npm run build` 通过。单 workspace `typecheck` 会扫描既有测试并命中基线历史错误；本轮生产构建无新增错误。

## 完成证据

- Implementation commit: `469a23b`，已 fast-forward 到 `master`。
- Core architecture gate、barrel governance gate、生产 build 全部通过。
- 定向测试 12/12：组织/EA Core、两个 repository 重启恢复、REST 及 task team + claim 绑定。
- connector 0.3.0 typecheck、build、225/225 与 npm pack dry-run 通过；node-b 已从稳定本地 tarball 安装并重启。
- 远端迁移 043/044 已应用；部署前 DB 备份保留在 `/root/.agora/backups/`。
- 正式组织 `austin-agent-company`：4 units、6 positions、5 active employments；三个不同且在线的 DSH runtime targets。
- live 请求 `b800a212-0021-43b2-ad3c-0791b07f7759` 路由到 Research Lead，生成 active task `OC-1788060290161` 与 open commitment；task team / claim 均为 `dsh:node-c:default`。
- Core 带数据重启后组织、任职、inbox、commitment 全恢复。

Windows 全量 Vitest 的旧 DB 测试会在 afterEach 删除仍被 SQLite 占用的临时目录时报 `EPERM`；单独旧用例复现为清理阶段失败，并非断言/迁移失败。本轮使用生产 build、双架构 gate、定向 restart tests 与 Linux live smoke 作为发布门禁。

`*` npm registry 上仍是 0.2.1：Windows 与 Core host 均 `ENEEDAUTH`。未伪报发布；需要新的 `npm adduser` 会话或 automation token。
