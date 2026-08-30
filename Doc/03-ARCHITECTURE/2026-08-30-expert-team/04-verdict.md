# 总工裁决 — dsh-agora 下一批优化方案（2026-08-30）

> 角色: 总工（Chief Architect）
> 日期: 2026-08-30
> 来源: 专家团队（任务中心 / 语音 / 生活系统三视角）讨论汇总，turn 2026-08-30
> 性质: 候选裁决，决策权在用户。未决事项见 §6。

## 0. 裁决摘要

**同意"不堆普通聊天扩展，补齐五条链路"的方向**，但按价值/成本/风险调整顺序与形态：

1. **P0-A 任务中心 Widget**：自研 Matrix Widget（matrix-widget-api）+ Agora REST 只读投影；Human Gate 仍只走 Dashboard。这是最大价值项，且对 Core 冲击最小。
2. **P0-B 语音消息**：v0.1 直接复用 GPT-SoVITS(9880)，connector 加 `m.audio` 发送；Core 加 `SpeechSynthesisPort` 抽象，provider 可插拔。显存固定 GPU 0 + 队列 + 阈值告警。
3. **P0-C 日历与承诺中心**：Radicale（轻量）+ 工作/生活日历隔离 + 健康只投影；commitment 与 CalDAV 双向投影。
4. **P1-D 系统运行中心**：Grafana 只读 widget + 轻量 Matrix relay 告警；监控指标明确。
5. **P1-E 协作文档**：Markdown Widget v0.1（只读+提交）绑定 agora artifact；HedgeDoc 仅在有实时协同需求时评估。
6. **P2-F Element Call / MatrixRTC**：明确后置，部署量大，不作为本轮目标。

## 1. 三视角结论对齐

| 方向 | 架构师 | 语音专家 | 集成专家 | 总工裁决 |
|---|---|---|---|---|
| 任务中心 | Widget + REST 投影，Human Gate 在 Dashboard | — | — | ✅ 采纳 |
| 语音 | SpeechSynthesisPort 抽象 | 复用 GPT-SoVITS v0.1，CosyVoice 3 后置 | — | ✅ 采纳 |
| 日历 | — | — | Radicale + 隔离 | ✅ 采纳 |
| 监控 | — | — | Grafana widget + relay | ✅ 采纳 |
| 文档 | — | — | Markdown Widget v0.1 | ✅ 采纳（HedgeDoc 仅按需） |
| Element Call | 后置 | — | — | ✅ 后置 |

## 2. 反对派风险（skeptic 视角）

1. **任务中心 Widget 是新的攻击面**：widget iframe 的 OpenID 与 URL 白名单必须严格；写操作一律不得在 widget 内授权（否则破坏 A4）。
2. **TTS 显存风险**：GPU 0 空余仅约 4.9GB，若 CosyVoice 3 加载失败会拖垮链路；v0.1 复用已在跑的 GPT-SoVITS 是零增量方案，先跑通再升级。
3. **日历双向投影易变成"第二套任务系统"**：必须保持 Agora commitment 为主账，CalDAV 只是投影，禁止反向成为决策源。
4. **Grafana 公开访问**：只读 dashboard 也可能泄露内网信息；匿名 iframe 必须限定 dashboard 与时间范围，或走受限 token。
5. **范围蔓延**：五条链路一次全做会拖垮交付；按 P0 三件（任务中心/语音/日历）先交付，监控/文档 P1。

## 3. 实施顺序（建议）

```text
W1 Widget 脚手架 → W2 只读投影 → W3 轻量操作 → W4 Gate 跳转   (任务中心, P0)
       ↓
V1 connector m.audio → V2 SpeechSynthesisPort → V3 接线 → V4 显存队列   (语音, P0, 可并行)
       ↓
Radicale + 双日历集合 → 承诺↔日历投影   (日历, P0, 可并行)
       ↓
Grafana widget + 告警 relay   (监控, P1)
       ↓
Markdown Widget v0.1 → (按需) HedgeDoc 评估   (文档, P1)
```

任务中心（W1-W4）与语音（V1-V4）互相独立，可并行；日历（Radicale 部署）也可并行启动。

## 4. 与 SSoT 的关系

- 遵循 `Doc/Agora-实施排期-Agora-TS.md` Phase 3 原则：agora-ts 不主动大改；只按需新增 `SpeechSynthesisPort` 等抽象端口与 REST DTO。
- 任务中心 Widget 属于 dashboard 侧；`m.audio` 属于 connector 侧；日历/告警属于新增 adapter/service。
- 每项实施前按 AGENTS.md §3 开 planning 任务目录，记录 worktree/分支。

## 5. 服务器资源结论

- RAM（62GB，可用 45GB）、磁盘（865GB 空闲）充足。
- GPU 显存紧张（3060 空余 ~4.9GB、2080 Ti 空余 ~3.9GB 且 vLLM 占用）；TTS 固定 GPU 0 并加阈值告警。
- 新增服务均轻量（Radicale ~20MB、relay ~几十 MB、widget 静态资源），不引入重组件。

## 6. 未决事项（用户拍板）

| # | 问题 | 候选 | 影响 |
|---|---|---|---|
| 1 | widget 写操作是否长期保留 | 全部跳 Dashboard vs 开放房间内批准 | 影响 A4 语义 |
| 2 | 语音是否保留文字正文 | 不保留（默认）vs 保留 | RecordPolicy |
| 3 | 声线档案存储位置 | agora config vs connector config | 配置模型 |
| 4 | Grafana iframe 鉴权 | 匿名只读 vs 受限 token | 安全边界 |
| 5 | 告警 relay 形态 | 独立 systemd vs connector 内置 webhook | 部署 |
| 6 | commitment↔CalDAV 触发源 | agora scheduler vs connector 定时器 | 架构归属 |
| 7 | 文档并发策略 | 单写者+版本号 vs CRDT/HedgeDoc | 编辑体验 |
| 8 | CosyVoice 3 升级时间 | 语音链路稳定后 | 显存/许可 |

## 7. 结论

下一批优先做 **任务中心 Widget（P0-A）→ 语音消息（P0-B）→ 日历与承诺（P0-C）**，三者可并行启动；监控与文档列为 P1，Element Call 后置。所有新增均为 adapter/展示层/轻量 service，不违反 AGENTS.md §1 解耦硬约束，Agora 保持唯一任务主账。
