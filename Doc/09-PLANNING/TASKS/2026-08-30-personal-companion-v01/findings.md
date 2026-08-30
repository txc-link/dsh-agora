# Findings: Personal Companion v0.1

## 现有能力

- `CitizenService` 已有 persona，但 persona 是单个可变文本，不能表达不可变版本、关系契约、主动策略和声音偏好。
- `NotificationOutbox` 与 scheduler 已能承载主动投递，但当前消息端口以文本通知为主；本轮先建立可复用档案和音频投递缝，不把 provider 写进 Core。
- 独立 `dsh-matrix-connector` v0.1.7 已有 `uploadBytes()` / `uploadMxc()`，但 `MatrixRoomMessage.msgType` 只允许 `m.text | m.notice | m.emote`，没有 `m.audio` 内容模型。
- node-b 已安装 Windows SAPI 中文女声（Huihui、Yaoyao），无需新增云端密钥即可完成本机 TTS 冒烟；当前未安装 ffmpeg，首版直接发送 `audio/wav`。

## 设计决策

### D1: Relationship Profile 与 Citizen 分离

Citizen 是执行身份；Relationship Profile 是某个 owner 与 agent 之间的关系、人格版本和互动契约。一个 agent 可以拥有不同 owner/场景档案，因此不扩写 Citizen 表。

### D2: 版本不可变

profile 是稳定聚合根；persona canon、contract、initiative policy 和 voice preference 作为 version payload 整体追加。修订只新增版本并推进 currentVersion，不更新历史版本。

### D3: Core 只保存声音意图

Core 保存 locale、timbre、pace、pitch、expressiveness 等可移植偏好；具体 voice name、SAPI/OpenAI 等 provider mapping 留在 speech adapter。

### D4: 标准音频优先

Connector 发送标准 `m.audio`；可选语音标记/波形属于 adapter payload。普通 Matrix 客户端即使不识别语音扩展，也应能以音频附件播放。

## 风险与后续

- 私密伴侣房间正式承载敏感内容前必须完成 E2EE 持久 crypto store；当前 connector 的这项能力不在本轮基础切片内。
- 独立伴侣 Matrix 身份需要新 bot token 或 Application Service；现有凭据只能以 node-b bridge bot 身份完成传输验收。
- 公网探测确认 Synapse 禁止 public registration；正式部署必须由 admin API
  分别 provision life/health/companion bot。当前 SSH key 对常见远端用户均无权。
- 远端 CORE 仍是旧构建：新 relationship/governance/initiative 路由 authenticated
  404，必须先部署本分支再启用 connector initiative poll。
