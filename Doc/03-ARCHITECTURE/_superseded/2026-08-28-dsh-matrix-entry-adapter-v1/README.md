# dsh-matrix-entry-adapter — 架构讨论索引

## 范围
agora 体系下 dsh-matrix-connector 插件的架构讨论。
讨论日期：2026-08-28（turn 24，DSH agent 三角色交叉审视）
用户：dsh-agora 项目 owner

## 已知背景
- Synapse 中央已部署（`8.136.15.147:8008`，v1.12 协议，register 已关）
- agora 中央 server 已运行（`127.0.0.1:18008`）
- dsh-agora 0.6.0 已绑 nodeId `ailink-web`
- agora-ts + dsh-agora 仓对 matrix **零代码**（空白画布）
- AGENTS.md §1 三层口径、§1.5 第一性原理、§2 Entry Surface Rules 适用

## 子文档

| # | 标题 | 状态 |
|---|---|---|
| 01 | 战略五题专家判断 | ✅ done |
| 02 | adapter 边界（C 方案） | ✅ done |
| 03 | 身份模型（mxid 在 connector 内部） | ✅ done |
| 04 | v0.1 范围定义 | ✅ done |
| 05 | 风险清单 | ✅ done |
| 06 | provision-bot 流程 | pending |
| undecided.md | 未决问题兜底 | ✅ done |

## 一句话结论
v0.1 = Agora 体系的 matrix entry adapter（"一个 IM adapter"），架构上为未来 agent 协作骨架预留扩展点。类飞书体验是 v1.0 远期目标。
