# Walkthrough — Phase 6: Matrix Transport 真实化 + IM 通道绑定

> 日期: 2026-08-30 · matrix 仓 `ee789e3` + dsh-agora develop `2609572`
> Planning: `Doc/09-PLANNING/TASKS/2026-08-30-org-aware-work-os-progress.md` (checklist Phase 6 段)

## 1. 交付

| 项 | 内容 | 证据 |
|---|---|---|
| R-B transport 真实化 | matrix 仓 `src/transport/matrix-js-sdk.ts` v0.4.0 (connect/createRoom/send/edit/upload/joinedMembers) + v0.5 inbound timeline; E2EE disabled by default (R-D 决定) | `tests/smoke-real-homeserver.mjs` 对 Synapse :8008 **PASS**: connect → createRoom → send eventId → joinedMembers → sync lifecycle |
| T-0 thread resolver | `core/src/worksite/thread-resolver.ts` (ThreadSourcePort 抽象, §1 合规) | worksite 套件 85 测试 |
| S5/S3 IM 通道 | 新包 `@agora-ts/adapters-matrix`: `MatrixIMMessagingAdapter` 纯 REST (PUT m.room.message, txnId UUID, fetchImpl 注入, roomByRef→default 定向解析) + `im.provider='matrix'` config schema + server/cli composition 分支 | 全量回归 **1239/1239**; 真机发 2 条通知 (ref 映射 + 兜底) GET /messages 回读落盘 |
| 拓扑 (U5 默认) | 方案 C: Linux home server = agora + mem0 :8888 + Synapse :8008; Win/Mac 客户端; runbook = matrix 仓 deploy/01-04 | 文档化; 实机部署由用户执行 |

## 2. 通道绑定语义

- S5 `agora ask` push、S3 `delegate subtree/escalate` 的 notify 端口、task broadcast 现均可经 `im.provider='matrix'` 出真实 IM
- targetRef → roomId: config `im.matrix.room_by_ref` 精确映射（如 agent:dl → 团队房间），未命中走 `default_room_id`
- 配置: `agora.example.json` 有参考块; 凭据来源 matrix 仓 `deploy/node-a.env`（已 provision 的 bridge bot）

## 3. 踩坑

- worktree 分支名记错 (`feat/mx-im` vs 实际 `feat/matrix-im-adapter`) 导致 merge 报 "不是可以合并的东西" — 以 `git branch --list` 为准
- python `open(p,'w').write(s if False else open(p).read())` 模式把 root package.json 截空 (open 'w' 先截断, 再读已是空) — 永远不要在同一语句 trunc-后-读; 本次 git checkout 恢复
- apps/server 测试需要可写 HOME (runtime-assets 复制 skills 到 ~/.agora) — 沙箱跑用隔离 HOME

## 4. 剩余 (Phase 6 后续)

- federation P3 (自动团队组建) — 依赖多 homeserver 环境
- Discord 冒烟 R-G — 需 Discord bot 环境在线
- 实机 3 台机部署 — 用户执行 runbook
