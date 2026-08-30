# 02 — Voice Delivery

## 分层

```text
Companion/Core intent
  → SpeechSynthesisPort
  → provider adapter (Windows SAPI / cloud / future local model)
  → audio bytes + metadata
  → Matrix adapter upload
  → m.room.message / m.audio
```

Core 不依赖 Matrix、SAPI、音频编码器或具体 voice id。

## v0.1

- node-b 使用 Windows SAPI 生成 `audio/wav`。
- connector 上传 bytes 得到 MXC URI。
- 发送 `m.audio`，携带 `body/url/info(duration,mimetype,size)`。
- 文字正文不随音频自动永久保存；后续由 RecordPolicy 决定。

## 正式使用前

- 配置独立 companion Matrix 身份。
- 私密房间启用 E2EE，并使用持久 crypto store。
- 语音媒体进入独立 retention policy 与删除审计。

