# 2026-08-30 专家团队讨论 — dsh-agora 下一批优化方案

> 来源: 用户请求 "拉取最新代码，结合现有架构、服务器基础、前沿领域开源项目，组建一个专家团队讨论方案"（2026-08-30）
> 参与者: 架构师（任务中心）/ 语音与 ML 专家 / 系统集成专家 / 总工（裁决）
> 状态: 候选方案，未决事项见 `04-verdict.md` §6，决策权在用户。

## 文档索引

| 文件 | 主题 | 结论 |
|---|---|---|
| [01-task-center.md](./01-task-center.md) | Agora 任务中心（Element Widget 驾驶舱） | 自研 widget + REST 投影；Human Gate 在 Dashboard |
| [02-voice-delivery.md](./02-voice-delivery.md) | Agent 语音消息（TTS + m.audio） | v0.1 复用 GPT-SoVITS；SpeechSynthesisPort 抽象；显存固定 GPU 0 |
| [03-life-systems.md](./03-life-systems.md) | 日历/承诺中心、系统运行中心、协作文档 | Radicale + 双日历隔离；Grafana widget + relay；Markdown Widget v0.1 |
| [04-verdict.md](./04-verdict.md) | 总工裁决 | P0 任务中心→语音→日历；P1 监控→文档；Element Call 后置 |

## 一句话结论

下一批优先做 **任务中心 Widget → 语音消息 → 日历与承诺**（三者可并行），监控与协作文档为 P1，Element Call 后置；全部为 adapter/展示层/轻量 service，Agora 保持唯一任务主账。
