# Personal Office Companion

> 来源: 2026-08-30 Codex 对话
> 参与者: 用户、Codex
> 状态: v0.1 Core/adapter 纵向切片已实现，远端部署待凭据

## 已确认设计

- 模拟女友是 Personal Office 内的私人陪伴者，不属于公司 Employment 层级。
- Core 使用通用 Relationship Profile；`companion` 只是关系类型，不建立女友专用主体。
- 性格、虚构经历、关系契约、主动策略和声音偏好必须版本化。
- 虚构人物设定、真实共同经历和临时即兴细节必须分层。
- 主动关心与监督受 quiet hours、每日主动上限和用户可暂停控制约束。
- Matrix 使用独立私密房间；语音通过标准 `m.audio` 投递，不 fork 客户端。
- Life/Health/Companion 分别使用独立顶层 Space 与 connector 身份；同一 EA
  只在 Core 逻辑层统一管理。

## 文档

- [01-companion-model.md](./01-companion-model.md) — 核心模型与边界
- [02-voice-delivery.md](./02-voice-delivery.md) — TTS 与 Matrix 音频链路
- [03-governance-boundary.md](./03-governance-boundary.md) — 信息治理、授权同意、动作风险与 Space 边界
- [undecided.md](./undecided.md) — 后续待拍板事项
