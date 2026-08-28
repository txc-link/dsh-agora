# Undecided: Ecosystem Design Inputs — U1/U3/U4 + Phase 2/3/4 输入

> 用户 (turn 75): "做之前研究一下 buzz / qm / comp crm / computer agent 持久化电脑工作区"
> agent (turn 76): 调研完成, 4 文档 + README + task_dir 全部落地
> **turn 79+ 用户拍板 (1) → U1=A / U3=C / U4=A 已决议, 见 [decisions.md](./decisions.md)**

## 状态变更 (turn 79+)

- ✅ U1 = 候选 A (单 scheme `agora://<type>/<id>`) — **已决议**
- ✅ U3 = 候选 C (QM 三 posture + audit trail + governance gate 保留) — **已决议**
- ✅ U4 = 候选 A (ACL 跟 scope + posture 一起做) — **已决议**
- ⏳ U2 (Phase 4 真项目) — **仍未决议**, 等用户单独拍
- ⏳ Phase 2 启动决策 — **等用户单独拍** (开 worktree 实施是下一步, 不在本 turn 范围)

> §1.5 立场: **决议落盘 ≠ 实施**, 不主动开 Phase 2 worktree

## 我必须做的事 vs 不能做的事

### 必须
- 把调研发现如实回报 (4 doc + findings.md)
- 列候选 + 风险 + 跟 Agora 已有 Phase 1 的对齐
- **等用户决策 U1/U3/U4** — ✅ 已达成 (turn 79+)
- **不主动推 Phase 2/3/4** (决议后也不主动开 worktree, 等用户单独指令)

### 不能
- ~~不主动选 U1/U3/U4 (按 turn 67 lesson "agent 不主动选")~~ — ✅ U1/U3/U4 已由用户拍板
- 不假装 QM/Buzz/Comp CRM/Computer Use 设计 = Agora 该 follow (§1.5 first-principles)
- 不主动装任何东西 (按 §1.5)
- 不动 agora 中央 / dsh-matrix-connector (按 §1)

## U1. URI scheme — 4 产品给的输入 → **已决议 A**

| 来源 | URI 设计 | Agora 怎么解读 |
|---|---|---|
| **Buzz** | Nostr (single protocol identity, 跨平台 portable) | 倾向**单 scheme** (跟 §1.5 草案对齐) |
| **QM** | Core contract (model-agnostic, 不绑具体 URI scheme) | 不反对任何选择 |
| **Comp CRM** | PBC API contract (不绑具体 URI scheme) | 不反对任何选择 |
| **Computer Use** | File-based workspace (不绑 URI scheme) | 不反对任何选择 |
| **4 产品共识** | **倾向单 scheme `agora://<type>/<id>`** (§1.5 草案) | 无反对 |

**U1 候选**:
- 候选 A: **单 scheme `agora://<type>/<id>`** (已落 `02-uri-protocol.md`) ← **已决议**
- 候选 B: 多 scheme `agora://` + `matrix://` + `git://`

**决议**: 候选 A (理由: ACL 统一 + 最短路径, 4 产品都支持)
**详情**: [decisions.md §U1](./decisions.md#u1-uri-scheme)

## U3. Agent 借用边界 — 4 产品给的输入 → **已决议 C**

| 来源 | 借用/审批模型 | Agora 怎么解读 |
|---|---|---|
| **Buzz** | 默认信任 agent, 无 explicit approve | **不借鉴** (违反 turn 25 "受控") |
| **QM** | **三 posture (Strict/Auto/Dangerous) + audit trail** | **可借鉴** (跟 §1.5 草案"严格"对齐) |
| **Comp CRM** | PBC lifecycle (权限跟组件 lifecycle 一起) | 部分借鉴 |
| **Computer Use** | 默认信任, 无 explicit approve | **不借鉴** |
| **4 产品共识** | QM 三 posture 模型 | 倾向**严格 + 三 posture** |

**U3 候选**:
- 候选 A: 宽松 — borrow_request ttl ≤ 24h, source_user dashboard 一键 approve
- 候选 B: 严格 — borrow_request 必须有 reason + 关联 task + ttl ≤ 1h, source_user 必须手写理由 approve
- **候选 C: QM 三 posture (Strict/Auto/Dangerous) + audit trail + governance gate 保留** ← **已决议**

**决议**: 候选 C (理由: turn 25 "受控" 的最具体实现; Auto classifier 不能照搬, 必须自定 governance gate)
**详情**: [decisions.md §U3](./decisions.md#u3-agent-借用边界)

## U4. ACL bundled — 4 产品给的输入 → **已决议 A**

| 来源 | ACL 设计 | Agora 怎么解读 |
|---|---|---|
| **Buzz** | Nostr identity 跟 ACL 一起 | (Nostr-specific, 不直接借鉴) |
| **QM** | **ACL 跟 scope + posture 一起** (一阶段) | **可借鉴** (跟 §1.5 草案"一起"对齐) |
| **Comp CRM** | ACL 跟 PBC lifecycle 一起 | (PBC-specific, 部分借鉴) |
| **Computer Use** | 不涉及 | — |
| **4 产品共识** | ACL 跟 scope/identity 一起 | 倾向**一起** |

**U4 候选**:
- **候选 A: 一起 — Phase 3 直接做 borrow + ACL, 不分** ← **已决议**
- 候选 B: 单独 — Phase 3 只做 borrow, Phase 4.5 做 ACL 强化

**决议**: 候选 A (理由: QM 一阶段 + §1.5 最短路径)
**详情**: [decisions.md §U4](./decisions.md#u4-acl-bundled)

## U2. Phase 4 真项目 — turn 52 旧问题, 4 产品给的输入 → **仍未决议**

| 候选 | 4 产品给的关联 |
|---|---|
| v2.1 stuck auto-reassign | 跟 QM audit trail 可对接 |
| Doc/03-ARCHITECTURE 索引页 | 纯内容, 不受 4 产品影响 |
| DSH 生态实战蓝图 | 跟旧 `dsh-ecosystem-probe` 关联 |
| v0.0→v3.0 walkthrough | 4 产品可作为参考章节 |

**§1.5 不主动选**: 等用户决定 — 跟 U1/U3/U4 独立, 不混在此次决议里

## Phase 2/3/4 设计 — 4 产品给的输入 (决议后映射)

### Phase 2 (matrix-connector @pull) — 候选输入 (待用户拍"开 Phase 2")
- 借鉴: QM scope-authorization 字段 (per Room = 1 scope)
- 不借鉴: Buzz Nostr identity (Agora §1 不绑 Nostr)
- 不借鉴: Computer Use screenshot (matrix 已是结构化 API)
- **新增 (U1 已决议)**: 单 scheme `agora://<type>/<id>` 锁

### Phase 3 (Agent borrow + Dashboard approve) — 候选输入 (U3=U4 已决议)
- 借鉴: **QM 三 posture (Strict/Auto/Dangerous)** — 替代 turn 60 草案 A/B ← **U3=C 已锁**
- 借鉴: QM audit trail by default
- 借鉴: QM 7-step execution path 的 step 3 (posture + scope policy decides)
- **新增 (U4 已决议)**: borrow + ACL 一起做, 不分两阶段 ← **U4=A 已锁**
- **新增 (治理保留)**: Auto classifier 不能直接照搬, 留 governance gate (02-qm §5)

### Phase 4 (真项目)
- 不强依赖 4 产品 — 等 U2 决议
- **新增 (反对派警告)**: Computer Use ⚠️ snippet-only 验证, Phase 4 立项前必须重 fetch Anthropic docs 拿到完整 design doc

## 期望用户回应 (turn 79+ 后续)

**已完成**: 类别 A (U1/U3/U4 决议, 选 A2 = 单 scheme / 三 posture / 一起)

**下一步候选**:
- (B1) "再读 QM 全套 docs (security policy + README)" — 我开 subagent 读 QM 详细设计
- (B2) "再读 Anthropic Computer Use docs (重试 fetch)" — 我重试 + fallback
- (B3) "再读 Composable CRM 全套 MACH principles" — 我开 subagent 读
- (C1) "U1/U3/U4 已决, 开 Phase 2 task_dir + worktree" — 我开 Phase 2 (新 turn)
- (C2) "U2 我决定 → X" — 我把 U2 决议落 undecided + decisions
- (C3) "docs 加 'Agora is Composable' 自描述段" — 我加到 whitepaper.md
- (D) 自由文字 — 我听

## 没回答的问题 (部分已回答)

1. QM 三 posture 是**新选项**, 跟 turn 60 U3 草案 A/B 不同 — ✅ **用户接受** (选 C)
2. Computer Use 的 Anthropic docs 没 fetch 成功 — ⏳ 用户可回 B2 重试, 或接受 snippet-level
3. Phase 2 设计的 matrix 多 Room 模拟 thread (turn 59 锁) 跟 QM scope-per-room 的对齐 — ⏳ 等 Phase 2 启动时确认
4. "受控" 在 turn 25 root goal 是关键词 — ✅ **QM 三 posture 是 turn 25 "受控" 的最具体实现** (turn 79+ 总工 review 确认)

## 跟踪

- **调研完成**: 4 doc + README + task_plan + findings + progress + undecided + decisions (turn 79+)
- **U1/U3/U4 已决议**: 见 [decisions.md](./decisions.md)
- **不开 worktree** (§3 纯调研)
- **不装任何东西** (§1.5)
- **下一步**: 等用户单独指令 (Phase 2 启动 / U2 决议 / docs 自描述 / 别的)