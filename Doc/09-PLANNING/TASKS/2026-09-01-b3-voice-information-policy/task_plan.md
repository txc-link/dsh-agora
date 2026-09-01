# Task Plan — B3: Add `/agora say` Command + Voice Adapter

**Date**: 2026-09-01 (Asia/Shanghai)
**Branch / Worktree**: `feat/agora-connector-say-command` @ `/home/ailink/dsh-agora/.worktrees/agora-connector-say-command`
**Source**: SSoT `Doc/Agora-实施排期-Agora-TS.md` §7 + Backlog B3 (turn 24 closeout)
**Trigger**: CEO 收件箱实测 `/agora say 语音测试` → 失败 (`information policy not found`) (turn 23)
**Author**: 总工
**Status**: ⏳ in_progress

---

## 0. Worktree 决策（AGENTS.md §3）

- **Worktree**: `/home/ailink/dsh-agora/.worktrees/agora-connector-say-command`
- **Branch**: `feat/agora-connector-say-command`
- **Base**: master @ `4658bc9` (B2 closeout)
- **依据**: connector 是 dsh-agora 主仓的 `dsh-matrix-connector/` 子目录（git ls-tree HEAD 验证），不是独立仓；在主仓 worktree 内直接改即可
- 后续 merge → master → push；部署由 B1-B4 全部完成后统一执行

## 1. 目标

让 `/agora say <text>` 在 CEO 收件箱：
1. 调 fish-speech TTS（`http://127.0.0.1:8080/v1/tts`）合成 WAV
2. 上传到 Matrix `mxc://`
3. 发 `m.audio` 消息到房间
4. 在原消息线程回执"uploaded: mxc://..."

## 2. 现状盘点（重校准）

| 组件 | 状态 | 文件 |
|---|---|---|
| fish-speech service :8080 | ✅ **alive**（HTTP 200 + RIFF/WAVE） | live `0.0.0.0:8080` |
| `POST /v1/tts` API | ✅ works（实测返 WAV bytes） | fish-speech |
| InformationGovernanceService | ✅ master 已实现 | `agora-ts/packages/core/src/governance-service.ts` |
| REST `/api/information-policies/...` | ✅ master 已挂 | `agora-ts/apps/server/src/app.ts:1957/1968/1979` |
| CLI `agora personal-governance` | ✅ master 已注册 | `apps/cli/src/index.ts:208` |
| connector `/agora say` command | ❌ **缺失** | `dsh-matrix-connector/src/message-router.ts` + `index.ts` |
| connector voice/TTS adapter | ❌ **缺失** | `dsh-matrix-connector/src/voice/` |
| connector Matrix `m.audio` send | ❌ **缺失** | `dsh-matrix-connector/src/matrix-client.ts` |

**turn 23 报告的 "information policy not found"**：connector `/agora say` 未实现 → 走 unknown verb → 渲染 "unknown command" 错误（用户的"information policy not found" 可能来自 connector 在 unknown 路径上对 `say` 的 fallback 处理，或者是 turn 23 描述不准确；本次实装后用真实命令验证）

## 3. 范围

### 3.1 In Scope（本轮做）

- ✅ 新文件 `dsh-matrix-connector/src/voice/tts-adapter.ts` — fish-speech HTTP client
- ✅ 新文件 `dsh-matrix-connector/src/voice/tts-adapter.test.mjs` — unit test
- ✅ `matrix-client.ts` 加 `sendAudio(roomId, mxcUri, filename, sizeBytes)` 方法
- ✅ `message-router.ts` 加 `say` verb（VerbName union + case）+ 完整测试
- ✅ `index.ts` switch case 加 `'say'` — 调 tts-adapter + matrix.sendAudio + 回执
- ✅ `npm run build` + `npm test` 全绿
- ✅ 隔离 HOME smoke（直接调 tts-adapter 合成 WAV + 上传）
- ✅ commit + merge + push + SSoT 回写

### 3.2 Out of Scope

- ❌ **Information policy 自动创建** — InformationGovernanceService 已有 classify/create API，但 B3 scope 不创建默认 policy record（用户可后续用 CLI/REST 自行创建）。§1.5 不擅自扩展范围。
- ❌ 改 agora-ts 后端（已 100% wire）
- ❌ 部署 connector（运维，B1-B4 全部完成后统一执行）
- ❌ Live matrix smoke（live matrix 不可在本沙盒触达）

## 4. 设计

### 4.1 tts-adapter.ts 设计

```ts
export interface FishSpeechConfig {
  baseUrl: string;        // e.g. 'http://127.0.0.1:8080'
  voice?: string;          // optional voice id
  format?: 'wav' | 'mp3';  // default 'wav'
  sampleRate?: number;     // default 22050
}

export interface SynthResult {
  bytes: Uint8Array;
  mediaType: string;       // 'audio/wav' or 'audio/mpeg'
  filename: string;        // 'tts-{timestamp}.wav'
}

export class FishSpeechTtsAdapter {
  constructor(private readonly config: FishSpeechConfig) {}

  async synthesize(text: string): Promise<SynthResult> {
    // POST /v1/tts JSON {text, voice?, format?, sample_rate?}
    // Returns WAV/MP3 bytes
  }
}
```

### 4.2 Matrix sendAudio 设计

```ts
// matrix-client.ts
async sendAudio(roomId: string, mxcUri: string, filename: string, sizeBytes: number): Promise<MatrixSendReceipt> {
  return this.transport.sendRoomMessage({
    roomId,
    senderMxid: '',
    msgType: 'm.audio',
    body: filename,
    url: mxcUri,
    info: { mimetype: 'audio/wav', size: sizeBytes },
  });
}
```

注：`MatrixTransport.sendRoomMessage` 需要支持 `msgType: 'm.audio'` + `url` + `info` —— 看现有 signature。

### 4.3 message-router 加 say

```ts
export type VerbName = ... | 'say' | ...;

case 'say': {
  if (tail.length === 0) {
    return { verb: 'say', args: [], errorCode: 'MISSING_ARG' };
  }
  return { verb: 'say', args: tail };
}
```

### 4.4 index.ts 加 say case

```ts
case 'say': {
  const text = decision.args.join(' ');
  const synth = await ttsAdapter.synthesize(text);
  const filename = `tts-${Date.now()}.${synth.mediaType === 'audio/wav' ? 'wav' : 'mp3'}`;
  const upload = await matrix.uploadMxc(filename, synth.mediaType, synth.bytes);
  await matrix.sendAudio(input.roomId, upload.mxcUri, filename, upload.sizeBytes);
  await matrix.sendText(input.roomId, `uploaded audio: ${upload.mxcUri} (${upload.sizeBytes} bytes)`);
  return;
}
```

## 5. 部署契约

B3 完成后：
- connector 新版本部署到 live node（替换当前版本）
- live `/agora say` 立即可通
- fish-speech 已 alive（无需新增）
- Information policy 用户可后续 CLI 创建（不阻塞）

## 6. 风险

- **R1**：`transport.sendRoomMessage` 现有 signature 不支持 `m.audio` 的 `url` + `info` 字段 → 需要改 transport 或绕开
- **R2**：fish-speech 响应可能慢 / 超时 → 需 timeoutMs + 重试（v0.1 不重试，单次 timeout 5s）
- **R3**：tts 文本太长 → 限制 maxLen 500 字符
- **R4**：live matrix 没在本沙盒可触达 → smoke 仅验证 tts-adapter.fetch + MatrixTransport mock

## 7. Backlog

| ID | 触发命令 | 状态 |
|---|---|---|
| **B1** | `/agora calendar today` | ✅ DONE (`d9f5c58`) |
| **B2** | `/agora doc show <id>` | ✅ DONE (code in master, live redeploy) |
| **B3** | `/agora say` | ⏳ current |
| B4 | `/agora call join` | ⏳ after B3 |
