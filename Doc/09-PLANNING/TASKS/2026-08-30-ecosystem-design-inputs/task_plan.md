# Task: Ecosystem Design Inputs (4 products research)

## 1. 目标

用户 (turn 75) 在做 Phase 2 之前, 要求研究 4 个外部产品:
- **Buzz** — 人类 + AI 共享协作平台 (Block.xyz)
- **QM** — 组织级 AI agent 工作空间 (Y Combinator)
- **Composable CRM** — 组件化 CRM pattern (Salesforce 等)
- **Computer Use** — Computer agent 持久化电脑工作区 (Anthropic 等)

**本任务目标**:
- verify 4 个产品**真存在** + 真实机制 (不 hallucinate)
- 跟 Agora turn 25 锁定的 8 keywords 对比 (协同/主动/24×7/维护/分解/有组织/进化/共享/完成复杂任务/受控)
- 给 Agora Phase 2/3/4 + U1/U3/U4 提供借鉴/不借鉴决策输入
- 不装任何东西, 不写 Agora 代码

## 2. §1 + §1.5 + §2 约束

- §1: agora 中央不变; 这次纯调研不动任何代码
- §1.5: 不假装, 不推销, 不主动扩展
- §2: 不补 CLI/REST/plugin 入口 (这是调研任务)
- §3: 本任务建立 task_dir, 含 task_plan + findings + progress
- §3 architecture capture: 同时建 architecture 子目录, 含 README + 4 个 product doc + undecided.md
- §4: 不需要 TDD (没写代码)

## 3. 阶段

1. ✅ turn 76 step 2: web_search 4 个产品名 → 8 个 snippet (Buzz 2 + QM 2 + Comp CRM 2 + Computer Use 2)
2. ✅ turn 76 step 4: read 旧 `dsh-ecosystem-probe` (确认 turn 75 是新 research, 不重复)
3. ✅ turn 76 step 6: web_fetch Buzz + QM + Computer Use (Computer Use 失败, snippet fallback)
4. ✅ turn 76 step 9-10: mkdir + 启动 4 个 subagent 写 4 product doc (background) + 写 README
5. ✅ turn 76 step 10: 写 README (索引 + 借鉴/不借鉴 summary)
6. ✅ turn 76 step 11: 写 task_plan + findings + progress + undecided (主调研闭环)
7. ✅ collect 4 subagent results + verify 4 doc 落地
8. ✅ 写 undecided.md (输入 U1/U3/U4 + Phase 2/3/4)
9. ✅ turn 79+ (本次): 用户发起"团队讨论 + 结论" — 总工 review 4 视角对话 + 裁决候选 (synopsis.md)
10. ✅ turn 79+: U3 候选升级 A/B → A/B/C (C = QM 三 posture)
11. ✅ turn 79+ 用户拍板"1" → U1=A / U3=C / U4=A 决议
12. ✅ turn 79+: decisions.md 落盘 (SSoT for U1/U3/U4)
13. ⏳ 等用户回应 (下一步: 锁 U1/U3/U4 / 继续 Phase 2 / 别的)

## 4. Constitution Constraints

- 不装任何东西 (只读 web fetch)
- 不动 agora 中央
- 不动 dsh-matrix-connector
- 不写 `/tmp/*` (用 workspace `Doc/` 子目录)
- SSoT (`docs/Agora-实施排期-Agora-TS.md`) 调研任务不强制要求 (turn 38 已确认 SSoT 不存在不作 §3 阻断)

## 5. worktree / 分支

纯调研, **不**开 worktree (按 §3 — 纯只读分析可不新开)。

## 6. 验证口径

- 每个产品必须有 "✅ 真存在 + URL + 1 行核心机制" 或 "⚠️ snippet-only + fetch failed" 二选一
- 4 文档全部落地 (per §3 architecture capture)
- README + findings + undecided 全部落地
- undecided.md 必须明确给 U1/U3/U4 提供输入选项