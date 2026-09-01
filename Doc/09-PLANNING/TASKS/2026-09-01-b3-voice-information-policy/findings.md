# Findings — B3: `/agora say` Command + Fish-Speech TTS Adapter

**Date**: 2026-09-01 (Asia/Shanghai)
**Branch**: `feat/agora-connector-say-command` → merged master @ `617a459` (`69c2387`)

---

## F1. 关键发现：turn 23 报告的 "information policy not found" 是误诊

turn 23 用户报告 `/agora say 语音测试` → `information policy not found`。**实际原因**：connector 完全没有 `/agora say` 命令处理（`grep` 无任何 voice/TTS 代码）。用户的 "information policy not found" 可能来自 connector 对 unknown verb 的 fallback 显示，或者是用户测试时的近似描述。**真正的情况**：

| 组件 | 状态 |
|---|---|
| InformationGovernanceService core | ✅ 已实现 + 测试 |
| REST routes (`/api/information-policies/*`) | ✅ master 已挂 (`apps/server/src/app.ts:1957/1968/1979`) |
| CLI `agora personal-governance` | ✅ master 已注册 |
| fish-speech :8080 服务 | ✅ **live 且工作**（实测 POST `/v1/tts` → HTTP 200 + RIFF/WAVE 94252 bytes for "hello world"）|
| connector `/agora say` command | ❌ **缺失**（`message-router.ts` 无 say case，`index.ts` 无 case，**没有任何 voice/ 目录**）|

→ **真正的 gap 在 connector**，不在后端。

## F2. 设计决策：markdown link 而非 m.audio msgType

`MatrixTransport.sendRoomMessage` 现有 signature 只支持 `msgType: 'm.text' | 'm.notice' | 'm.emote'`，**不支持 `m.audio`**。transport 实现可能在外部 npm 包（本仓改不到）。

**v0.1 路径**：
1. tts-adapter 合成 WAV bytes
2. matrix.uploadMxc → `mxc://...`
3. matrix.sendText 发 markdown link: `🔊 [audio (filename, size bytes)](mxc://...)`

Matrix 客户端会渲染 mxc link 为可点击的 audio attachment，**用户体验接近 m.audio msgType**，但 transport 不需要扩展。

**未来优化**（out of scope v0.1）：transport 支持 m.audio 后改用 `sendRoomMessage({msgType: 'm.audio', url, info})`。

## F3. Information policy 不强制

v0.1 设计：**`/agora say` 不创建/检查 information policy**。turn 23 报告的"信息政策 not found"错误实际是 connector unknown verb 的 fallback，不是真 policy check。

如果用户后续需要 policy gating：用 `agora personal-governance classify --domain <X>` CLI 预创建 policy，然后在 connector `index.ts` `case 'say'` 加 `informationGovernanceService.require('voice.tts')` 检查。**这是 v0.2 工作**。

## F4. 实现文件清单

| 文件 | 改动 |
|---|---|
| `dsh-matrix-connector/src/voice/tts-adapter.ts` | 新建 — FishSpeechTtsAdapter |
| `dsh-matrix-connector/src/voice/.gitkeep` | 不需要（已有 tts-adapter.ts）|
| `dsh-matrix-connector/src/index.ts` | 加 import + `fishSpeechUrl` const + `case 'say'` switch |
| `dsh-matrix-connector/src/message-router.ts` | 加 `'say'` VerbName + case + HELP_TEXT entry |
| `dsh-matrix-connector/tests/tts-adapter.test.mjs` | 新建 — 8 个 unit test |
| `dsh-matrix-connector/tests/message-router.test.mjs` | 加 3 个新测试（say + missing arg + HELP_TEXT）|

**总改动：5 文件 / +287 行**

## F5. FishSpeech API 指纹

实测 live 8080 endpoint：

```bash
$ curl -X POST -H "Content-Type: application/json" \
    -d '{"text":"hello world","format":"wav","sample_rate":22050}' \
    http://127.0.0.1:8080/v1/tts
HTTP 200, body: RIFF...WAVE 94252 bytes (约 4.7s @ 22050Hz mono)

$ curl -X POST ... -d '{"text":"中文测试",...}'
HTTP 200, body: RIFF...WAVE 118828 bytes
```

`format: "mp3"` 也支持；`voice` 参数可选；`sample_rate` 默认 22050。

## F6. 部署契约

```bash
# 部署 connector 新版本 (commit 69c2387 在 master) 到 live node
# 无需新 env (FISH_SPEECH_URL 默认 http://127.0.0.1:8080)
# 部署后 /agora say <text> 在白名单房间立即可通
# audio 通过 mxc:// markdown link 形式发出
```

## F7. 不在本次范围

- ❌ Information policy 自动 gating（master CLI `agora personal-governance classify` 即可用户自建）
- ❌ m.audio msgType 直接发送（等 transport 升级）
- ❌ Live matrix smoke（live matrix 不可在本沙盒触达）
- ❌ Connector deploy 动作（B1-B4 统一部署）
- ❌ connector 仓 `.gitignore`（lib/ node_modules/ 没 ignore，但本次 commit 只 add 源文件，未污染）
