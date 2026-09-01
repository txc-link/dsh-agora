# Walkthrough — B4: LiveKit SFU Deployment (Skipped → v0.2+)

**Date**: 2026-09-01 (Asia/Shanghai)
**Status**: ⏸️ **SKIPPED → v0.2+**（user 拍板 turn 26 step 181）

---

## 1. TL;DR

v0.1.1 slash smoke (turn 23) 标注 B4 (`/agora call join` 占位 token) 为 "可选"。
turn 26 用户拍板"挨个做 B1-B4 全做"，但 B4 真实 scope（live docker + 跨仓 connector 改造 +
跨包 matrix integration）属于大工作量（1-2 小时 + 需要 live 端口开放 + 凭据）。

**用户最终拍板**（turn 26 step 181）："接受 B4 跳过，占位 token 推到 v0.2"

## 2. 调查结论（事实）

| 探查 | 结果 |
|---|---|
| live `livekit-server` binary | ❌ not in PATH |
| live `docker` | ✅ `/usr/bin/docker` |
| live LiveKit ports (7880/7881/7882) | ❌ 无 listen |
| connector `livekit` 引用 | ❌ 0 命中 |
| plugin `livekit` 引用 | ❌ 0 命中 |
| server `livekit` 引用 | ❌ 0 命中 |

**B4 是 0 代码 + 0 部署** —— 不是 wire gap，是从零开始。

## 3. v0.2+ Backlog（含 B4 完整设计）

详见 `Doc/09-PLANNING/TASKS/2026-09-01-b4-livekit-sfu-deploy/{task_plan,findings}.md`：

- **A. 基础设施**：docker run livekit/livekit-server + config.yaml + 端口开放
- **B. connector 改造**：新建 `livekit-jwt.ts` + `element-call-url.ts` + `case 'call'` switch + `call` verb
- **C. 配置**：LIVEKIT_URL/KEY/SECRET env

## 4. turn 26 最终总结（B1-B3 完成 + B4 skipped）

### 4.1 Code 改动

| Commit | 描述 |
|---|---|
| `d9f5c58` | B1: adapters-calendar wire (runtime + index.ts, 6 行) |
| `4658bc9` | B2 docs closeout (no code change, `/content` route 已存在) |
| `69c2387` | B3: /agora say + fish-speech TTS adapter (跨仓 connector, +287 行) |

### 4.2 文档

- `Doc/09-PLANNING/TASKS/2026-09-01-b{1,2,3,4}-*/{task_plan,findings,progress}.md`
- `Doc/10-WALKTHROUGH/2026-09-01-b{1,2,3,4}-*.md`
- SSoT `Doc/Agora-实施排期-Agora-TS.md` §1 row 8-12 + §7 entry

### 4.3 部署计划（B1-B3 统一）

```bash
# 1. live agora-ts 重启 (含 B1+B2 在 master)
systemctl restart agora-ts.service
# 配 RADICALE_URL/USER/PASSWORD env (live agora config)

# 2. live connector 重启 (含 B3)
systemctl restart dsh-matrix-connector.service
# 无新 env (FISH_SPEECH_URL 默认 http://127.0.0.1:8080)
```

部署后：
- ✅ `/agora calendar today` 真返 200
- ✅ `/agora doc show <id>` 真返 raw bytes (live 需 redeploy 含 B2 commit `b3fd488` 之后代码)
- ✅ `/agora say <text>` 真发 mxc:// markdown link audio
- ⏸️ `/agora call join` 仍占位 token（v0.2+）

## 5. Lessons

1. **Smoke 报告的"占位 token"不一定是 "code 待 wire"** —— 也可能是 "code 缺失"。B3 vs B4 的对照：B3 是 "code 缺失 + 跨仓"，B4 是 "0 代码 + 0 部署"。Investigation 永远比 assumption 准。
2. **大型 B 的 scope 必须先 investigation + 拍板**：B4 investigation 揭露"docker 可用 + 端口需授权 + 凭据需提供"，让用户拍板"接受跳过"是最稳的，避免擅自 docker run 在 live 上。
3. **跨仓改动在 §1.5 下有边界**：B3 跨仓 (connector 在主仓 sub-tree) 是 OK 的；B4 涉及 matrix transport 外部包则不 OK。

## 6. References

- task_dir: `Doc/09-PLANNING/TASKS/2026-09-01-b4-livekit-sfu-deploy/`
- SSoT: `Doc/Agora-实施排期-Agora-TS.md` §1 row 12 + §7 entry
- prior smoke closeout: `Doc/10-WALKTHROUGH/2026-09-01-v011-slash-command-smoke-closeout.md` §6 B1-B4
- prior B1: `Doc/10-WALKTHROUGH/2026-09-01-b1-wire-adapters-calendar.md`
- prior B2: `Doc/10-WALKTHROUGH/2026-09-01-b2-markdown-artifact-route.md`
- prior B3: `Doc/10-WALKTHROUGH/2026-09-01-b3-voice-information-policy.md`
