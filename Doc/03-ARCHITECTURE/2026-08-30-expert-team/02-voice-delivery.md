# 专家分析 02 — Agent 语音消息链路（TTS + connector m.audio）

> 角色: 语音/ML 专家（总工团队 · 语音视角）
> 日期: 2026-08-30
> 来源: 用户请求（2026-08-30）；继承 `personal-office-companion/02-voice-delivery.md` 分层设计
> 性质: 候选方案，不是决议。

## 0. 结论摘要

链路为：用户发语音 → FunASR(18000) 转写 → Agent 回复文本 → TTS 生成音频 → connector 上传 media → `m.room.message`(msgtype=`m.audio`) → Element 直接播放。TTS 推荐 **直接复用服务器已部署的 GPT-SoVITS(9880)** 作为 v0.1 provider，架构上通过 `SpeechSynthesisPort` 抽象保持可插拔；中长期若追求更高自然度/多语种，升级为 **CosyVoice 3（Fun-CosyVoice3-0.5B，FP16 约 3-4GB）** 或 **Fish Speech S2 Pro**。显存按"固定 GPU 0、按需加载、预留阈值、串行队列"策略调度，避免影响 vLLM。

## 1. 事实底座

- 服务器已有：FunASR(18000, docker)、GPT-SoVITS(9880, api_v2.py, gptsovits conda env)、vLLM chat(8082)/embed(8081)、ComfyUI(8188)。
- GPU 现状：RTX 3060 12GB（已用 7.3GB，空余约 4.9GB）；RTX 2080 Ti 22GB（已用 18.6GB，空余约 3.9GB，vLLM 在跑，利用率 15%）。RAM 62GB 可用 45GB。
- 已有设计：`SpeechSynthesisPort` → provider adapter → audio bytes + metadata → Matrix adapter upload → `m.audio`。Core 不依赖平台/编码器/voice id。
- connector 是纯 REST TypeScript，发布为 npm 包 `dsh-matrix-connector`（当前 0.3.9），发送路径在 `src/index.ts`。

## 2. TTS 选型对比

| 方案 | 中文质量 | 声音克隆 | 显存需求 | 推理速度 | 许可 | 服务器现状 |
|---|---|---|---|---|---|---|
| GPT-SoVITS (9880) | 好（中文强） | 是（few-shot） | 已在跑（api_v2.py） | 快 | MIT（模型权重有额外条款，需注意） | ✅ 已部署 |
| CosyVoice 3 (Fun-CosyVoice3-0.5B) | 很好 | 是（zero/few-shot） | FP16 约 3-4GB | 中 | Apache 2.0（ModelScope 权重） | ⏳ 需装 |
| Fish Speech S2 Pro / S1-mini | 好 | 是（ref audio + text） | S1-mini 约 3-5GB；S2 更高 | 中 | CC-BY-NC-SA 等，商用需确认 | ⏳ 需装 |
| edge-tts | 自然（云端） | 否 | 0（云端） | 快 | 微软服务条款，不推荐生产依赖 | ⏳ 备选 |

**推荐**：v0.1 直接复用 GPT-SoVITS(9880)，零新增显存、零安装；`SpeechSynthesisPort` 做成 provider 可插拔，后续一键切 CosyVoice 3 只换 adapter 配置。

## 3. 架构接线

```text
Agent 回复文本
  → agora-ts: SpeechSynthesisPort（Core 抽象端口）
  → provider adapter: tts-gptsovits（POST :9880 返回 wav/mp3）
  → connector: MediaUploadPort（POST /_matrix/media/v3/upload → mxc://）
  → connector: m.room.message { msgtype: "m.audio", body, url: mxc, info: {mimetype,size,duration} }
  → Element 播放
```

- Core 只新增 `SpeechSynthesisPort` 抽象（若有必要），具体 TTS/上传实现全在 adapter/connector。
- connector 新增 `sendAudio(roomId, audioBytes, info)`，复用现有鉴权与重试。
- 未决：语音消息是否同时保留文字正文（继承 `02-voice-delivery.md` v0.1：不自动永久保存，由 RecordPolicy 决定）。

## 4. 声线档案与授权

- 每 Agent 一份 voice profile：`{ voice_id, speaker/ref_audio, speed, emotion, allowed_users, source, authorization }`，存 connector 或 agora 配置，由管理员维护。
- 模拟女友 / 生活管家 / 健康管家各自独立声线。
- 真人克隆：必须记录 `authorization`（授权人、日期、用途、来源）与 `source`（原始音频 hash），禁止无授权克隆；列入部署 checklist。

## 5. 显存调度（避免影响 vLLM）

1. TTS 固定绑定 GPU 0（RTX 3060），vLLM 不动 GPU 1。
2. 服务启动时按需加载权重，空闲 N 分钟自动卸载（或保持 GPT-SoVITS 常驻——它已在跑且占用已知）。
3. 启动前检查显存：GPU 0 空余 < 4GB 时拒绝加载新模型并告警（连入 Grafana）。
4. 请求串行队列 + 超时；批量 TTS 任务走低优先级队列。
5. FP16/INT8 量化优先；CosyVoice 3 若启用，用 `Fun-CosyVoice3-0.5B` 并验证在 GPU 0 空余 4.9GB 内。

## 6. 开源参考

- [Fun-CosyVoice3-0.5B / cosyvoice-docker](https://github.com/neosun100/cosyvoice-docker) — 生产级 REST + 声音克隆 docker，NVIDIA 8GB+。
- [Fish Speech S2 Pro (HuggingFace AEmotionStudio)](https://huggingface.co/AEmotionStudio/fish-speech-s2-pro) — Qwen3-based + audio codec，zero-shot 克隆、情绪标签。
- [GPT-SoVITS](https://github.com/RVC-Boss/GPT-SoVITS) — 服务器已部署，v0.1 直接复用。
- [Matrix media upload spec](https://spec.matrix.org/latest/client-server-api/#post_matrixmediav3upload) — `m.audio` 发送路径依据。

## 7. P0 实施切片

| 切片 | 范围 | 验收 |
|---|---|---|
| V1 connector m.audio | 上传 media + 发送 m.audio（含 info） | 手工 curl 可让 Element 播放 |
| V2 SpeechSynthesisPort | Core 抽象 + gptsovits provider adapter | 文本→音频 bytes 单测 |
| V3 接线 | Agent 回复带 voice profile → 自动发语音 | 房间内收到可播放语音 |
| V4 显存/队列 | 加载检查 + 串行队列 + 空闲卸载 | 显存阈值告警生效，vLLM 不受影响 |

## 8. 已确认 / 未决

**已确认**：v0.1 复用 GPT-SoVITS；`SpeechSynthesisPort` 抽象；connector 发 `m.audio`；真人克隆必须授权留痕。

**未决**：语音是否保留文字正文；每 Agent voice profile 的存储位置（agora config vs connector config）；CosyVoice 3 / Fish Speech 升级时间点；商用许可（若对外）。
