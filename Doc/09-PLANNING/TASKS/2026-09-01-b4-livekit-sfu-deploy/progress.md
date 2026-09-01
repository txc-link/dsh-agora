# Progress — B4: LiveKit SFU Deployment

**Date**: 2026-09-01 (Asia/Shanghai)

---

## P1. 决策：B4 跳过（user 拍板 turn 26 step 181）

**用户拍板**："接受 B4 跳过，占位 token 推到 v0.2"

**理由**：
- turn 23 已标注 B4 为"可选"
- turn 24 closeout backlog 标为 P2（最低优先级）
- B1-B3 已全部完成（master @ `b67111a`）
- B4 真实 scope 是 live 基础设施 + 跨仓 connector 改造 + 跨包 matrix integration，大工作量（1-2 小时）+ 需要 live 端口开放 + 凭据

**行动**：本轮不做 B4。占位 `/agora call join` 状态保留到 v0.2+。

## P2. 完成步骤

- [x] P2.1 调研 live + 代码现状（结论：0 代码 + 0 部署）
- [x] P2.2 task_plan.md + findings.md 落地（事实 + 三选项 + 风险）
- [x] P2.3 用 ask_user_question 拍板 → B4 跳过
- [x] P2.4 progress.md + walkthrough + SSoT 回写（本次 closeout）
- [ ] P2.5 （不做）B4 代码 + 部署

## P3. 状态总结

| ID | 触发命令 | 状态 |
|---|---|---|
| **B1** | `/agora calendar today` | ✅ **DONE** (`d9f5c58` → master) |
| **B2** | `/agora doc show <id>` | ✅ **DONE** (code in master `b3fd488`) |
| **B3** | `/agora say` | ✅ **DONE** (`69c2387` → master) |
| **B4** | `/agora call join` | ⏸️ **SKIPPED → v0.2+**（占位 token）|

## P4. 部署计划（B1-B3 统一部署）

用户原计划 (turn 26)："全部做完一次性部署"。**B4 跳过** → 部署只覆盖 B1-B3：

```bash
# 1. agora-ts 重启 (含 B1 adapters-calendar wire + B2 content route 在 master)
systemctl restart agora-ts.service
# 配 RADICALE_URL/USER/PASSWORD env (live agora config)

# 2. connector 重启 (含 B3 /agora say command + fish-speech TTS)
systemctl restart dsh-matrix-connector.service
# 无新 env (FISH_SPEECH_URL 默认 http://127.0.0.1:8080)
```

部署完成后：
- ✅ `/agora calendar today` 真返回 200（Radicale 已 alive + B1 wiring）
- ✅ `/agora doc show <id>` 真返 raw bytes（B2 content route + live redeploy）
- ✅ `/agora say <text>` 真发 mxc:// markdown link audio
- ⏸️ `/agora call join` **仍返占位 token**（B4 跳过）

## P5. v0.2+ backlog（含 B4）

- B4 LiveKit SFU deployment
- Information policy auto-gating for `/agora say`
- `m.audio` msgType direct send（等 transport 升级）
- Dashboard markdown UI（frontend）
- LiveKit 录制 / TURN / Cloud 选项
