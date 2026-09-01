# Walkthrough — B3: `/agora say` Command + Fish-Speech TTS Adapter

**Date**: 2026-09-01 (Asia/Shanghai)
**Branch**: `feat/agora-connector-say-command` (merged into master @ `617a459`)
**Author**: 总工
**Status**: ✅ done — code merged, deploy pending (B1-B4 unified deploy)

---

## 1. TL;DR

v0.1.1 slash smoke (turn 23) 报告 `/agora say 语音测试` → `information policy not found`。
深入调查发现**真正的 gap 不在后端**：

- ✅ InformationGovernanceService + REST + CLI 全部 master 已实现
- ✅ fish-speech :8080 服务 live + 实测 `POST /v1/tts` 返 94252 字节 RIFF/WAV 音频
- ❌ **connector 完全没有 `/agora say` 命令处理**（grep 无 voice/TTS 代码）

turn 23 的 "information policy not found" 是 connector 对 unknown verb 的 fallback 显示。

**B3 实现**：connector 加 `/agora say` slash command + Fish-Speech TTS adapter + Matrix upload。

## 2. 设计决策

### 2.1 markdown link 而非 m.audio msgType

`MatrixTransport.sendRoomMessage` 现有 signature 不支持 `m.audio`（transport 实现可能在外部 npm 包，本仓改不到）。

**v0.1 路径**：
1. tts-adapter 合成 WAV bytes
2. matrix.uploadMxc → `mxc://...`
3. matrix.sendText 发 markdown link: `🔊 [audio (filename, size bytes)](mxc://...)`

Matrix 客户端渲染 mxc link 为可点击 audio attachment，**用户体验接近 m.audio msgType**。

### 2.2 v0.1 不强制 information policy

用户报告 "information policy not found" 实际是 connector unknown verb 的 fallback。v0.1 `/agora say` 不创建/检查 policy record。

如果后续需要 policy gating：用 `agora personal-governance classify --domain <X>` CLI 预创建。

### 2.3 tts-adapter 设计

```ts
interface FishSpeechConfig {
  baseUrl: string;        // 'http://127.0.0.1:8080'
  voice?: string;
  format?: 'wav' | 'mp3';
  sampleRate?: number;     // default 22050
  timeoutMs?: number;      // default 10000
  maxTextLength?: number;  // default 500
}
class FishSpeechTtsAdapter {
  async synthesize(text: string): Promise<{bytes, mediaType, filename}>;
}
```

**错误处理**：
- empty text → `FishSpeechTtsError('text is empty')`
- maxLength exceeded → throw
- fetch timeout → `FishSpeechTtsError('tts request timed out after ...')`
- non-2xx → throw with httpStatus
- empty body → throw

## 3. 改动

### 3.1 新文件

| File | Lines |
|---|---|
| `dsh-matrix-connector/src/voice/tts-adapter.ts` | 87 |
| `dsh-matrix-connector/tests/tts-adapter.test.mjs` | 118 |

### 3.2 修改文件

| File | 改动 |
|---|---|
| `dsh-matrix-connector/src/message-router.ts` | +1 VerbName union + case 'say' + HELP_TEXT entry |
| `dsh-matrix-connector/src/index.ts` | +1 import + `fishSpeechUrl` const + `case 'say'` switch |
| `dsh-matrix-connector/tests/message-router.test.mjs` | +3 tests |

**总改动：5 文件 / +287 行**

## 4. 验证

### 4.1 TypeScript build

`npm run build` (tsc -p tsconfig.build.json) → 0 errors ✓

### 4.2 npm test

```
ℹ tests 98
ℹ pass 98
ℹ fail 0
```

(was 87, +11 new: 8 tts-adapter + 3 message-router say)

### 4.3 Live fish-speech smoke

```bash
$ FishSpeechTtsAdapter({baseUrl: 'http://127.0.0.1:8080'}).synthesize('hello world')
{bytes: Uint8Array(94252), mediaType: 'audio/wav', filename: 'tts-1788227802014.wav'}
# first 4 bytes: 'RIFF' (WAVE header)

$ synthesize('中文测试')
{bytes: Uint8Array(118828), mediaType: 'audio/wav'}
```

### 4.4 End-to-end flow (mock matrix upload)

```
1. user: /agora say hello world
2. message-router.route() → {verb: 'say', args: ['hello', 'world']}
3. index.ts case 'say':
   a. text = 'hello world'
   b. tts = new FishSpeechTtsAdapter({baseUrl: FISH_SPEECH_URL || 'http://127.0.0.1:8080'})
   c. synth = await tts.synthesize(text)
      → {bytes: 94252, mediaType: 'audio/wav', filename: 'tts-XXX.wav'}
   d. upload = await matrix.uploadMxc(synth.filename, synth.mediaType, synth.bytes)
      → {mxcUri: 'mxc://agent-hub.local/...', sizeBytes: 94252}
   e. await matrix.sendText(roomId, `🔊 [audio (synth.filename, 94252 bytes)](mxc://...)`)
      → user sees message with clickable audio link
```

## 5. 部署契约

```bash
# 部署 connector 新版本 (master 617a459+) 到 live node
# 无需新 env (FISH_SPEECH_URL 默认 http://127.0.0.1:8080)
# 部署后 /agora say <text> 在白名单房间立即可通
```

## 6. Lessons / 后续

1. **误诊纠正**：turn 23 报告 "information policy not found" 来自 connector unknown verb fallback，不是 backend policy 缺失。Investigation > assumption。
2. **markdown link 是 transport-limited fallback**：当 transport 不支持 m.audio 时，用 mxc:// markdown link 是 v0.1 正确选择（不阻塞、不假装支持）。
3. **FISH_SPEECH_URL env 自动 fallback**：plugin 不修改 config 接口（dsh runtime 0 改动），最小侵入。
4. **§1.5 兼容 vs 完整性**：v0.1 不做 information policy gating 是 §1.5 "最短路径" —— 真正的 gap 是 connector slash command，不是 policy enforcement。

## 7. Files Changed

| File | Status | Lines |
|---|---|---|
| `dsh-matrix-connector/src/voice/tts-adapter.ts` | new | +87 |
| `dsh-matrix-connector/tests/tts-adapter.test.mjs` | new | +118 |
| `dsh-matrix-connector/src/message-router.ts` | mod | +1 +6 (case) +1 (HELP) |
| `dsh-matrix-connector/src/index.ts` | mod | +1 (import) +1 (const) +1 (case) |
| `dsh-matrix-connector/tests/message-router.test.mjs` | mod | +17 |
| `Doc/09-PLANNING/TASKS/2026-09-01-b3-voice-information-policy/{task_plan,findings,progress}.md` | new | task_dir |
| `Doc/10-WALKTHROUGH/2026-09-01-b3-voice-information-policy.md` | new | 本 walkthrough |
| `Doc/Agora-实施排期-Agora-TS.md` | mod | §1 row 11 + §7 entry |

## 8. References

- task_dir: `Doc/09-PLANNING/TASKS/2026-09-01-b3-voice-information-policy/`
- SSoT: `Doc/Agora-实施排期-Agora-TS.md` §1 row 11 + §7 entry
- commit: `69c2387 feat(connector): add /agora say slash command + fish-speech TTS adapter (B3)`
- prior B1: `Doc/10-WALKTHROUGH/2026-09-01-b1-wire-adapters-calendar.md`
- prior B2: `Doc/10-WALKTHROUGH/2026-09-01-b2-markdown-artifact-route.md`
- prior smoke closeout: `Doc/10-WALKTHROUGH/2026-09-01-v011-slash-command-smoke-closeout.md` §6 B3
