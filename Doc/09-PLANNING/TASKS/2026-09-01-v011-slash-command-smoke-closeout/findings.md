# Findings — v0.1.1 Slash Command Smoke Closeout

**Date**: 2026-09-01 (Asia/Shanghai)
**Source**: CEO 收件箱 Matrix 房间实测报告（2026-09-01 turn 23）

---

## F1. 测试结果汇总

| # | 命令 | 结果 | 备注 |
|---|---|---|---|
| 1 | `/agora task <id>` | ✅ 通过 | 返回 done / creator / type |
| 2 | `/agora task <id> artifacts` | ✅ 通过 | 列出任务产物（如 `441f2302…-executive-deliverable`） |
| 3 | `/agora call join` | ⚠️ 半通 | 返回 Element Call 加入链接（**占位 token**，需部署 LiveKit 才有真 JWT）|
| 4 | `/agora task transfer <id>` | ✅ 通过 | 按设计返回 "not implemented yet"（**占位明确，符合预期**） |
| 5 | 自然对话（非 slash） | ✅ 通过 | 普通消息 → DSH 本地 agent 处理（"Dispatch claimed by runtime node"）|
| 6 | `/agora calendar today` | ❌ 404 | agora 后端缺 `/api/calendar/today` |
| 7 | `/agora doc show <id>` | ❌ 404 | 缺 `/api/artifacts/:id/markdown` 路由 |
| 8 | `/agora say 语音测试` | ❌ 失败 | `information policy not found`（语音投递需先创建 information policy，且 fish-speech :8080 可达性未确认） |

**摘要**：✅ 5 / ⚠️ 1 / ❌ 3（含 1 个占位明确 + 3 个后端缺口）

## F2. "假故障"澄清（重要）

**现象**：之前在 `node-home-linux` 房间发 `/agora help` 没回复，被怀疑是 bug。

**根因（已澄清，非 bug）**：connector 的 `securityBoundary` 安全设计——只有 **9 个白名单房间**（CEO 收件箱、公司简报、虚拟女友等）接受 slash 命令，`node-home-linux` 不在白名单。

**关键观察**：自然对话**不走 securityBoundary 检查**，所以 `node-home-linux` 里普通对话能正常回（"Dispatch claimed by runtime node"）。

**设计意图**：
- 白名单房间是高频治理 / 任务入口 → slash 命令必须可用
- 非白名单房间是只读 / 监听 / 闲聊 → 不应触发 `agora` 编排
- 自然对话走不同路径（DSH 本地 agent 直处理），不受白名单约束

**下次回应 playbook**：用户报告"X 房间 /agora X 没响应" → 第一步检查房间是否在 9 个白名单内，不是 bug。

## F3. 后端缺口根因分类

| 命令 | 缺口 | 根因 | 修复路径 |
|---|---|---|---|
| `/agora calendar today` | `/api/calendar/today` 404 | `@agora-ts/adapters-calendar` 已实现（SSoT §7 next batch 117行：12/12 测试通过），但**未 wire 到 apps/server composition** | composition.ts 加 service 注册 + route 注册 + smoke |
| `/agora doc show <id>` | `/api/artifacts/:id/markdown` 404 | Markdown 文档编辑后端未落地（SSoT §7 next batch：artifact markdown endpoints 已规划但未实施）| core service + REST route + smoke（参考 next batch 已规划的 wire 流程）|
| `/agora say` | `information policy not found` | 语音投递需要先创建 information policy（Personal Office / Companion v0.1 治理），且 fish-speech 服务在 8080 可达性未确认 | 两步：① agora-ts 创建 information policy（CLI 或 REST）；② 验证 fish-speech :8080 + 配 matrix-connector speech 配置 |

## F4. ⚠️ Element Call 占位 token

**现象**：`/agora call join` 返回的加入链接用了占位 token。

**根因**：LiveKit SFU 未部署。Element Call 的 join URL 模板需要真 JWT 签名（含房间名 + 用户身份 + TTL）。

**修复路径**：部署 LiveKit 服务（独立基础设施工作）+ connector 配置 `livekit.url` / `livekit.api_key` / `livekit.api_secret` → connector 把占位 token 换成真签名 JWT。

**P2 优先级**（不阻断主流程，但会限制 `/agora call` 的实际可用性）。

## F5. /agora task transfer "not implemented yet"

**现象**：返回占位错误。

**判断**：按设计预期。T_transfer（RuntimeBinding/Employment 转移）推迟到独立 follow-up（见 SSoT §7 next batch 117行："T_transfer (RuntimeBinding/Employment) 推迟到独立 follow-up"）。

**action**：无需修复，等 T_transfer 切到独立 phase 再实施。

## F6. 9 个白名单房间具体名单（部分）

来自用户实测报告：
- ✅ CEO 收件箱（测试通过的样本）
- ✅ 公司简报（用户提到）
- ✅ 虚拟女友（用户提到）
- ❌ node-home-linux（不在白名单）

**完整 9 房间清单未在本次实测报告中列出** → 后续需要时从 connector 配置 / 源码 `securityBoundary` 实现处获取精确名单。

## F7. 不在本次范围

- ❌ connector 仓 SSoT 回写（`.repos/dsh-matrix-connector/Doc/...`）—— 属于 connector 仓主人的工作
- ❌ 实施 adapters-calendar / Markdown artifact / information policy / LiveKit —— 各自需要独立 task_dir + worktree
- ❌ 修改本仓代码（本次纯文档收口）
