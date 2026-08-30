# 专家分析 01 — Agora 任务中心（Matrix Element Widget 驾驶舱）

> 角色: 架构师（总工团队 · 任务中心视角）
> 日期: 2026-08-30
> 来源: 用户请求 "结合现有架构、服务器基础、前沿领域开源项目，组建专家团队讨论方案"（turn 2026-08-30）
> 性质: 候选方案，不是决议；决策权在用户。

## 0. 结论摘要

推荐形态是 **自研 Matrix Widget（iframe, matrix-widget-api）+ Agora REST 只读投影 + Dashboard 登录态承担 Human Gate**，而不是把核心编排复制进 widget，也不是依赖第三方看板。现有 Synapse + Element v1.12.20 已具备 widget 白名单与 postMessage 能力，无需安装第二套 Integration Manager。Agora 仍是唯一任务主账。

## 1. 事实底座

- `agora-ts` 已有：Task / Context / Participant / RuntimeBinding / Execution / Event / Notification 核心语义，Gate / Scheduler / Recovery / Archive，SQLite，REST(18008) + CLI + Dashboard。
- Company OS v0.1 已有 Organization/Unit/Position/Employment + EA request / runtime dispatch / task / commitment + SHA-256 Markdown deliverable。
- `adapters-matrix` 目前只做 `m.text` 通知（`messaging-adapter.ts`），无 widget、无事件上行。
- AGENTS.md 硬约束：Core 不写死平台；plugin = slash bridge / live status / 轻量 action；人类动作只允许 Dashboard 登录态触发。
- 服务器已有 Element Web v1.12.20（18085）、Synapse（8008）、Hookshot、NeoBoard、Poll。

## 2. 形态选型对比

| 维度 | 自研 Widget (matrix-widget-api) | Dashboard 内嵌 | Bot / Slash 命令 |
|---|---|---|---|
| 房间内可见性 | ✅ 直接嵌在 Element 房间 | ❌ 需切到 Dashboard | ⚠️ 文字命令，无驾驶舱感 |
| 权限模型 | widget URL 白名单 + OpenID/wtoken；需要房间级授权 | Dashboard 登录态（已有） | bot 凭据 |
| Human Gate | ⚠️ 需跳 Dashboard 或独立登录 | ✅ 已有登录态 | ❌ 不适合审批 |
| 开发成本 | 中（React widget + matrix-widget-api） | 低（已有前端） | 低 |
| 对 Core 冲击 | 低（只消费 REST 投影） | 低 | 低 |
| 与 §1 解耦 | ✅ adapter/展示层 | ✅ 展示层 | ✅ adapter |

**推荐**：Widget 承担"房间内只读驾驶舱 + 轻量操作请求"，真正的 approve/reject/转派确认跳转 Dashboard（保持 A4 人类入口唯一）。

## 3. 认证与权限

1. Widget iframe 通过 Element 的 widget 机制加载（`m.widget` 状态事件 + URL 白名单），与 Synapse 无直接信任；使用 matrix-widget-api 的 `getOpenIdToken()` 换取用户身份。
2. Widget → Agora REST(18008)：使用 Agora API token（现有 Bearer 机制）+ 按 widget 配置的只读 scope；写操作一律返回"请在 Dashboard 确认"并带 task id 跳转链接。
3. Human Gate 语义不变：`reviewer_id/approver_id` 不允许 widget 伪造，只有 Dashboard session adapter 能断言"登录的人类"。
4. 未决：widget token 的发放/轮换策略、房间↔组织/项目映射是否由 widget 配置注入。

## 4. Core 冲击分析

- 展示层：**不需要改 Core**。Widget 消费现有 REST 投影（task list / detail / gate / run 状态 / artifact / node 租约）。
- 轻量操作（暂停/恢复/转派申请）：走现有 CLI/REST task action；若存在缺口，只补 REST DTO 与 action，不新增 Core 语义。
- 若未来要"房间内直接批准"，需要新决策：是否允许 widget 代表人类身份（当前 A4 禁止），列为未决。
- 与 SSoT §6 的关系：本方案属于 Dashboard/前端侧 + connector 侧工作，遵循 Phase 3 "agora-ts 不主动大改"。

## 5. 开源参考

- [matrix-widget-api](https://github.com/matrix-org/matrix-widget-api) — widget ↔ Element postMessage 协议、OpenID、权限请求。核心依赖。
- [matrix-widget-toolkit (nordeck)](https://github.com/nordeck/matrix-widget-toolkit) — React widget 脚手架、JWT 认证、与 Element 交互，NeoBoard/Poll 同源，最有参考价值。
- [matrix-widget-examples](https://github.com/matrix-org/matrix-widget-examples) — 官方最小 widget 示例。
- [OpenProject + Hookshot](https://matrix-org.github.io/matrix-hookshot/) — 人类看板后期可选，但**不做第二任务主账**。

## 6. P0 实施切片

| 切片 | 范围 | 验收 |
|---|---|---|
| W1 Widget 脚手架 | `dashboard/` 下新增 widget 入口或独立小包；matrix-widget-api 握手 + 房间身份 | Element 房间内可加载 iframe，能拿 OpenID |
| W2 只读投影 | task list/detail 调 Agora REST，展示 status/owner/agent/gate/artifact | 房间内看到真实任务状态 |
| W3 轻量操作 | 暂停/恢复/转派申请按钮 → REST → 返回 Dashboard 确认链接 | 操作不越权，写操作必须 Dashboard 确认 |
| W4 Gate 审批跳转 | widget 内"去批准"跳 Dashboard 对应 task/gate 页 | 审批闭环，A4 不破坏 |

## 7. 已确认 / 未决

**已确认**：Widget 是展示层 + 轻量 action；Human Gate 只在 Dashboard；Agora 唯一主账；不装第二套 Integration Manager。

**未决**：widget 写操作是否长期保留（还是全部跳 Dashboard）；widget token 生命周期；房间↔项目映射的配置来源；是否开放"房间内批准"（需改 A4 语义）。
