# Progress — B3: `/agora say` Command + Fish-Speech TTS Adapter

**Date**: 2026-09-01 (Asia/Shanghai)

---

## P1. 完成步骤

- [x] P1.1 探索 connector 现状（无 voice 模块）+ 确认 master 后端 100% wire
- [x] P1.2 task_dir + worktree 落地
- [x] P1.3 findings.md + task_plan.md 落地
- [x] P1.4 tts-adapter.ts 实现（FishSpeechTtsAdapter + FishSpeechTtsError）
- [x] P1.5 tts-adapter.test.mjs 8 个 unit test
- [x] P1.6 message-router.ts 加 `say` verb + case + HELP_TEXT entry
- [x] P1.7 message-router.test.mjs 加 3 个新测试
- [x] P1.8 index.ts 加 import + `fishSpeechUrl` const + `case 'say'` switch
- [x] P1.9 `npm run build` 0 errors
- [x] P1.10 `npm test` 98/98 pass (was 87, +11)
- [x] P1.11 Live fish-speech smoke: `hello world` 94252B RIFF/WAV + `中文测试` 118828B RIFF/WAV
- [x] P1.12 commit `69c2387` → merge to master `617a459` → push
- [x] P1.13 worktree cleanup（无残留）
- [x] P1.14 walkthrough + SSoT 回写

## P2. 验证证据

### P2.1 npm test

```
ℹ tests 98
ℹ suites 8
ℹ pass 98
ℹ fail 0
```

新测试 (11 个):
- tts-adapter.test.mjs: 8 (synthesize happy path / voice+format override / trailing slash / empty / maxLength / non-2xx / empty body / constructor baseUrl missing)
- message-router.test.mjs: 3 (say happy / say missing arg / HELP_TEXT documents say)

### P2.2 Live fish-speech smoke

```bash
$ FishSpeechTtsAdapter({baseUrl: 'http://127.0.0.1:8080'}).synthesize('hello world')
{bytes.length: 94252, mediaType: 'audio/wav', filename: 'tts-1788227802014.wav'}
first 4 bytes: 'RIFF' ✓ (WAVE header)

$ synthesize('中文测试')
{bytes.length: 118828, mediaType: 'audio/wav'}
```

### P2.3 端到端流（mock matrix upload）

```
synthesize(text='hello world')
  → bytes 94252, mediaType 'audio/wav', filename 'tts-XXX.wav'
matrix.uploadMxc(filename, mediaType, bytes)
  → mxcUri 'mxc://agent-hub.local/...', sizeBytes 94252
matrix.sendText(roomId, `🔊 [audio (filename, 94252 bytes)](mxc://...)`)
  → 用户看到带 audio link 的消息
```

## P3. Backlog

| ID | 触发命令 | 状态 |
|---|---|---|
| **B1** | `/agora calendar today` | ✅ DONE (`d9f5c58`) |
| **B2** | `/agora doc show <id>` | ✅ DONE (code in master) |
| **B3** | `/agora say <text>` | ✅ **DONE** (`69c2387` → master `617a459`) |
| B4 | `/agora call join` | ⏳ next |

## P4. 部署契约

live 部署 connector 新版本（master `617a459` 或更新）后：
- `/agora say <text>` 在白名单房间立即可通
- audio 以 mxc:// markdown link 形式发出（Matrix 客户端渲染为可点击 audio attachment）
- 无需新 env（`FISH_SPEECH_URL` 默认 `http://127.0.0.1:8080`）
- **B1-B4 全部完成后统一部署**

## P5. 未来优化（v0.2+）

- 升级 `MatrixTransport` 支持 `m.audio` msgType → 直接发 audio message（更原生体验）
- 加 information policy gating：`/agora say` 前检查 `informationGovernanceService.require('voice.tts')`
- tts 文本长度 > 500 时分块 streaming
- 多个 voice 选项（从 agora 配置读取）
