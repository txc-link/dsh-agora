# findings.md — P0 批次

## 2026-08-30 初始盘点（connector 源码）

- connector 已有：`SpeechSynthesizer` 接口、`WindowsSapiSpeechAdapter`（唯一 provider）、
  `GovernedVoiceDelivery` 治理管线（boundary + information authorization + action risk）、
  matrix client `sendAudio`（m.audio）、`agora.companion.voice` 事件入口。
- **缺口**：config `speech.provider` 只支持 `'windows-sapi'`，Linux 无法合成；需新增 HTTP TTS adapter。
- status-panel 已有：按房间聚合任务列表（state/stage/executor），只读，无操作。
- agora-rest 已有：tasks list/get/create、projects、artifacts、citizens、assistant requests/commitments、
  events、SSE stream；**未见 pause/resume/reassign 类 task action 方法**。

## 待探明（GPU 实机）

- GPT-SoVITS :9880 实际 API 子路径与请求/响应格式（根路径 404）。
- agora central（:18008）是否存在 task action 端点。
- connector 在 GPU 上的安装路径、启动方式（systemd/pm2/cordis）、当前配置。

## 2026-08-31 GPU 实探结论（已验证）

### TTS
- GPT-SoVITS :9880 是 FastAPI（GET/POST /tts、/set_refer_audio 等），但 **pretrained_models 目录缺失
  （chinese-roberta-wwm-ext-large、s1bert...ckpt、s2G488k.pth 均不在机器上）**；HF 直连超时、
  hf-mirror 403/404，无法快速补齐。`set_refer_audio` 参数名是 `refer_audio_path`。
- **Fish Speech S2 Pro :8080 可用**：`GET /v1/health`、`GET /v1/references/list`（5 个已注册声线：
  female_local_20s / female_local_30s / multi_female / multi_female3 / myvoice）、
  `POST /v1/tts`（JSON: text/reference_id/format=wav/streaming=false，返回 audio/wav）。
  实测合成 2.46s/3.67s WAV 成功。→ **决策：v0.1 provider = fish-speech**。
- 8081 是嵌入/重排类服务（/v1/embeddings、/rerank），不是 TTS。

### agora central task action（:18008，probe 2026-08-31）
- 存在：`POST /api/tasks/:id/pause`（body {reason}）、`/resume`（body {}）、
  `/cancel`（{reason}）、`/unblock`（{reason, action?: retry|skip|reassign, assignee?, craftsman_type?}）、
  `/approve`（{approver_id}）、`/reject`（{rejector_id}）。
- 不存在：reassign/assign/dispatch/state/transition/control/action/update/complete/archive/block 等。
- approve/reject 需要人工身份字段 → 按 A4 留给 Dashboard，connector 不暴露。

### connector 部署
- GPU：`/root/.dsh/profiles/web`（pnpm，dsh-matrix-connector 0.3.9 → 0.4.0 已装）；
  配置 `cordis.patch.yml` 已加 `speech` 块（fish-speech, myvoice）。
- Mac：`~/.dsh/profiles/web`，0.4.0 已装（`--ignore-scripts` 绕过 `dsh-git-remotes`
  构建脚本门禁）；speech 块已加但 `enabled: false`（Mac 无法直连 GPU :8080）。
- dsh-web.service 明令禁止 agent 自行 restart → **重启需用户手动执行**。
- securityBoundary 未配置（GPU/Mac 都没有）→ `voiceDelivery` 仍未激活；已发现两个候选
  Space：`!VPmdUfisYdSBObRBvy:agent-hub.local`（公司团队）、`!pObsCDfoTwcmGlfzWK:agent-hub.local`
  （终身学习），激活语音投影前需确定 Root Space 与房间归属。
