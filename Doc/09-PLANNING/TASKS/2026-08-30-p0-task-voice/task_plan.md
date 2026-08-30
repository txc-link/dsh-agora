# P0 批次：任务中心 + Agent 语音（2026-08-30）

> 总工程师：chief_engineer（用户已授权技术全权，2026-08-30）
> 状态：执行中

## 目标

按专家团队方案（`Doc/03-ARCHITECTURE/2026-08-30-expert-team/`）落地 P0：

1. **P0-A 任务中心**：补齐 Agora 任务查询/动作 API 缺口，升级 connector 房间 status panel / slash 为可操作入口；人类确认动作只走 Dashboard（A4）。
2. **P0-B Agent 语音消息**：connector 增加 Linux 可用的 HTTP TTS provider（v0.1 复用 GPU 上已在跑的 GPT-SoVITS :9880），端到端发送 `m.audio`。
3. **P0-C 日历/承诺中心**（依赖现成 commitment ledger）：先做到期提醒/晨报晚检，Radicale 后置。

P1（监控/文档）、P2（Element Call）不在本批次实现，只记录方向。

## 技术决策（总工程师拍板，替代 verdict §6 未决项）

| # | 问题 | 决策 | 理由 |
|---|---|---|---|
| 1 | widget 写操作 | 只读 + 跳 Dashboard 确认 | A4 人类入口唯一，禁止伪造 reviewer/approver |
| 2 | 语音是否保留文字 | 保留文字 + 语音都发 | 可检索、可归档、可回退 |
| 3 | 声线档案位置 | connector 配置（管理员维护） | v0.1 不引入新的配置服务 |
| 4 | Grafana iframe 鉴权 | 只读匿名 + 限定 dashboard/时间范围 | 见 P1 计划，本批次不做 |
| 5 | 告警 relay 形态 | 独立 systemd 轻量服务 | 与 connector 生命周期解耦 |
| 6 | commitment↔CalDAV 触发源 | agora scheduler | 保持 Core 为主账 |
| 7 | 文档并发策略 | 单写者 + 版本号 | 最简单满足"绑定任务版本" |
| 8 | TTS 引擎 | v0.1 **Fish Speech S2 Pro(:8080)**；GPT-SoVITS 待模型补齐后作为备选 | 实测 GPT-SoVITS 缺 pretrained 模型（HF 不可达）；Fish Speech 已在跑且实测可合成，零新增 |

## 实施切片

### P0-B（先做，最小可交付）

- V1：`FishSpeechSpeechAdapter`（HTTP JSON POST /v1/tts）+ config `speech.provider='fish-speech'` + wiring
- V2：单测（fake HTTP server）+ typecheck + build
- V3：GPU 实探并端到端合成一条真实音频（已验证：3.67s WAV）
- V4：发布 npm、部署 GPU/Mac、重启验证

### P0-A（并行探明后做）

- W0：探明 agora central 实际 task action 端点（pause/resume/reassign 是否存在）
- W1：按探测结果补 agora-rest 方法 + status-panel 增强 + slash 命令
- W2：测试 + Matrix 冒烟

### P0-C（若时间允许）

- 复用 `listCommitments` + 现有 initiative 定时器做到期提醒；不新增日历服务

## 验收

- [x] connector 单测/构建通过（258/258）
- [x] GPU 上真实合成音频（Fish Speech :8080，适配器直连验证）
- [x] 发布 npm 0.4.0 并在 GPU/Mac 安装（重启待用户执行）
- [x] 任务中心 API 结论落盘（pause/resume/cancel/unblock 存在；approve/reject 留给 Dashboard）
- [x] SSoT、planning、walkthrough 回写
