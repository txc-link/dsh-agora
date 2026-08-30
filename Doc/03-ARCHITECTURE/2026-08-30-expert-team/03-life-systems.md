# 专家分析 03 — 日历与承诺中心 / 系统运行中心 / 协作文档

> 角色: 系统集成/生活协同专家（总工团队 · 集成视角）
> 日期: 2026-08-30
> 来源: 用户请求（2026-08-30）；继承 `ecosystem-design-inputs/` 与 `personal-office-companion/` 的 posture 与 governance-boundary 概念
> 性质: 候选方案，不是决议。

## 0. 结论摘要

三条链路分别推荐：

1. **日历**：轻量部署 **Radicale**（约 20MB RAM、无外部 DB、单进程）承担 CalDAV，按集合（collection）隔离工作日历/生活日历；健康只投影"有待办/有冲突/需确认"，明细不落普通 Matrix 房间；支付/订票/就医继续走 Dashboard Human Gate。
2. **系统运行中心**：Grafana 以只读匿名/受限 iframe 进"系统运维"房间；告警用 **Grafana Alerting webhook → 小型 Matrix relay（自写 ~50 行或复用 grafana-matrix-alerting）→ 运维房间**，不重复装监控栈。
3. **协作文档**：推荐 v0.1 自研 **Markdown Widget（只读 + 编辑提交）**，与 agora artifact 的 SHA-256 Markdown 交付物绑定；不引入 CryptPad/Etherpad 这类重组件，除非明确需要多人实时协同。

## 1. 事实底座

- 服务器已有：Grafana(3001)+InfluxDB(8086)+Mosquitto(1883)、Home Assistant(8123)、mem0(8888)+pgvector、Synapse+Element+Hookshot、nginx(8443/8444)+caddy(80)。
- Company OS v0.1 已有 `task` / `commitment` 语义与 SHA-256 Markdown deliverable。
- AGENTS.md A8：Company/Life/Health/Companion 是独立根信息域，个人域不并入 Company Unit。
- `ecosystem-design-inputs` 已确立 QM 三 posture（Strict/Auto/Dangerous）为"受控"的具体实现候选，需保留 governance gate，不照搬 classifier。

## 2. 日历：Radicale + 承诺中心

### 选型对比

| 方案 | RAM | 依赖 | ACL/多用户 | 运维 |
|---|---|---|---|---|
| Radicale | ~20MB | 无外部 DB | 文件/多 collection | 极简 |
| Baïkal | ~100MB+ | PHP+SQLite/MySQL | 有 admin UI | 中 |
| Nextcloud Calendar | 1GB+ | PHP+DB+全套件 | 完善 | 重 |

**推荐 Radicale**：单用户（或极少用户）场景下最短路径；未来需要团队 UI 再迁 Nextcloud。

### 隔离

- 工作日历：EA / 日程 Agent 可读写（经 agora 侧授权）。
- 生活日历：仅 Life Gateway + 授权管家可访问。
- 健康：只投影 `todo/conflict/confirm` 到房间，明细只存在于 Health 根域。
- Human Gate：支付/订票/就医动作从日历触发后一律跳 Dashboard 审批。

### 承诺对齐

- Agora `commitment` 与 CalDAV 事件做双向投影：到期提醒、冲突检测由日历 adapter 消费，结果以投影消息回房间。
- 未决：投影的触发源（agora scheduler vs connector 定时器）、CalDAV 凭据的托管位置。

## 3. 系统运行中心

- Grafana 只读 iframe：为"系统运维"房间建 widget URL（只读 dashboard，匿名受限或 token 嵌入），列入 Element widget 白名单。
- 告警链路：Grafana Alerting → webhook → **Matrix relay**（自写 `POST /_matrix/client/v3/rooms/{id}/send/m.room.message`，带 access token；或复用 [grafana-matrix-alerting](https://github.com/NiklasBeierl/grafana-matrix-alerting)）→ 运维房间。
- 监控指标：Agora REST 健康、任务队列积压、connector 心跳、节点在线、GPU/显存、Synapse/Element/Hookshot 端口探活、Media 磁盘水位。
- 未决：Grafana 公开访问的鉴权方式（匿名只读 vs 受限 token）、relay 的部署形态（独立 systemd vs connector 内置 webhook 端点）。

## 4. 协作文档

- 推荐 v0.1：**自研 Markdown Widget（只读渲染 + 编辑提交）**，文件保存在 agora artifact（SHA-256 交付物）或 Obsidian/Git 仓库，绑定 task 版本。
- 服务器已有 adapters-obsidian 与 mem0；文档正文进 artifact/Obsidian，mem0 只做情景记忆，不做事实唯一源。
- 若需要多人实时协同，再评估 CodiMD/HedgeDoc（实时协同 Markdown，可 iframe 嵌入）——列为 P1 候选，不默认引入。
- 未决：编辑并发与冲突策略（v0.1 单写者 + 版本号 vs CRDT）、文档↔任务版本绑定粒度。

## 5. Hookshot 启用

- 现有 hookshot 容器（19000-19002）已跑；启用 GitHub/GitLab/RSS/Webhook 只需在 hookshot 配置中开启对应 service + 在房间内 `!hookshot` 接入。
- 不引入第二套 Integration Manager；NeoBoard/Poll/现有阅读器已够。

## 6. 开源参考

- [Radicale](https://radicale.org/) — 轻量 CalDAV/CardDAV，~20MB。
- [grafana-matrix-alerting](https://github.com/NiklasBeierl/grafana-matrix-alerting) — Grafana webhook → Matrix relay。
- [CodiMD/HedgeDoc](https://github.com/hedgedoc/hedgedoc) — 实时协同 Markdown，P1 候选。
- [matrix-hookshot](https://matrix-org.github.io/matrix-hookshot/) — GitHub/GitLab/RSS/Webhook bridge。

## 7. P0/P1 实施切片

| 优先级 | 切片 | 验收 |
|---|---|---|
| P0 | Radicale 部署 + 工作/生活日历集合 | CalDAV 可读写，双集合隔离 |
| P0 | 承诺↔日历投影（到期/冲突） | 房间内收到投影消息 |
| P0 | Grafana iframe widget + 告警 relay | 运维房间收到告警 |
| P1 | Markdown Widget v0.1（只读+提交） | 文档入 artifact，绑定任务 |
| P1 | Hookshot GitHub/GitLab/RSS | 房间内收到事件 |
| P1 | HedgeDoc 评估（如需要实时协同） | 对比结论落盘 |

## 8. 已确认 / 未决

**已确认**：Radicale 为日历 v0.1；健康只投影不落明细；Human Gate 只走 Dashboard；监控复用 Grafana + 轻量 relay；Markdown Widget 绑定 agora artifact。

**未决**：Grafana 匿名访问鉴权；relay 形态；commitment↔CalDAV 双向投影触发源；Markdown 并发策略；日历凭据托管。
