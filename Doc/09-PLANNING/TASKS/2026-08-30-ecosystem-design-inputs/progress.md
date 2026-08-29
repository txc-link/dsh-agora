# Progress: Ecosystem Design Inputs (2026-08-30)

## 阶段

| 阶段 | 状态 | 备注 |
|---|---|---|
| 1. ✅ web_search 4 产品名 | 完成 | 8 snippet (turn 76 step 2) |
| 2. ✅ read 旧 dsh-ecosystem-probe | 完成 | 确认不重复 (turn 76 step 4) |
| 3. ✅ web_fetch Buzz + QM | 完成 | Computer Use 失败, snippet fallback (turn 76 step 6/8) |
| 4. ✅ mkdir architecture + task_dir | 完成 | turn 76 step 7 |
| 5. ✅ 启动 4 subagent 写 product doc | 完成 | background (turn 76 step 9) |
| 6. ✅ 写 README (索引 + summary) | 完成 | turn 76 step 10 |
| 7. ✅ 写 task_plan + findings + progress | 完成 | turn 76 step 11 |
| 8. ✅ collect 4 subagent results + verify | 完成 | 4 doc 落地 |
| 9. ✅ 写 undecided.md (输入 U1/U3/U4 + Phase 2/3/4) | 完成 | undecided.md 144 行 |
| 10. ✅ **总工 review (synopsis.md)** | 完成 | turn 79+ 用户发起"团队讨论 + 结论"; 4 视角对话 + 裁决候选; 234 行 |
| 11. ✅ **U3 候选升级 A/B → A/B/C** | 完成 | C = QM 三 posture (来自总工 review §3.2 P0) |
| 12. ✅ **U1/U3/U4 决议 (turn 79+ 用户拍板"1")** | 完成 | U1=A / U3=C / U4=A; 见 `Doc/03-ARCHITECTURE/2026-08-30-ecosystem-design-inputs/decisions.md` |
| 13. ✅ **decisions.md 落盘 (SSoT for U1/U3/U4)** | 完成 | 110 行, Phase 2/3/4 直接引用 |
| 14. ⏳ Phase 2 启动决策 (开 worktree 实施) | pending | **不主动** — 等用户单独指令 |
| 15. ⏳ U2 (Phase 4 真项目) 决议 | pending | **不主动** — 等用户单独指令 |
| 16. ⏳ docs 加 "Agora is Composable" 自描述段 | pending | P3, 等用户单独指令 |

## 关键证据

- **Buzz 真存在**: Apache-2.0, github.com/block/buzz, Nostr-based, channels/threads/code/voice/automations, cryptographic identity per agent
- **QM 真存在**: MIT, github.com/yc-software/qm, 9700+ stars by 2026-08-04, Scope-as-first-class, 3 postures, durable sandbox, 7-step execution
- **Composable CRM 真存在 (concept)**: Packaged Capability (PBC), MACH principles, 多个厂商 follow
- **Computer Use ⚠️ snippet-only**: Anthropic docs fetch 失败 (turn 76 step 6/8), snippet-level 验证
- **4 产品对 Agora U1/U3/U4 输入已落 findings §7**

## 关键产物 (turn 79+ 新增)

- **synopsis.md** (总工 review 候选) — `Doc/03-ARCHITECTURE/2026-08-30-ecosystem-design-inputs/synopsis.md` 234 行
  - §0 立场声明 (§1.5: 候选不是决议)
  - §1 事实底座 (引自 4 capture, 不重复)
  - §2 4 视角对话 (researcher / architect / skeptic / user-rep)
  - §3 总工裁决 (P0-P4 优先级 + 不做清单 + 决策树)
  - §4 计划更新 (本 task_plan/findings/progress 的更新来源)
  - §5 Phase 2/3/4 候选输入
- **U3 候选升级**: A (宽松) / B (严格) → **A / B / C** (C = QM 三 posture + audit trail + governance gate 保留)
- **decisions.md** (U1/U3/U4 决议 SSoT, **turn 79+ 用户拍板后**)
  - 路径: `Doc/03-ARCHITECTURE/2026-08-30-ecosystem-design-inputs/decisions.md`
  - **决议**: U1=A (单 scheme) / U3=C (QM 三 posture + governance gate) / U4=A (borrow + ACL 一起)
  - **状态**: U1/U3/U4 全部已决议, **U2 + Phase 2 启动仍未决议**
  - 后续 Phase 2/3/4 设计**必须引用本文件**, 不在每个 doc 重复说"U3=C"

## §1.5 错误更正 (诚实)

- turn 76 step 6/8 fetch Anthropic + Wikipedia = 422 失败
- **正确处理**: snippet fallback + 标 "⚠️ snippet-only", 不假装设计
- turn 76 step 4 read 旧 dsh-ecosystem-probe = 确认 turn 75 不重复 (那是 DSH 插件生态, 不是 4 外部产品)
- turn 79+ 用户发起"团队讨论", 总工 review **没**建 AgentTeam — §1.5 first-principles 判断: 4 视角对话式 review 比多 agent 协调更短路径, 单文件落盘更实用

## 完成状态

- 调研任务本身: **完成** (4 capture + README + undecided + planning 三件套 + 总工 review 结论 + decisions 决议落盘)
- U1/U3/U4 输入: **已落 findings §7 + undecided.md + U3 候选升级 C + decisions.md 决议** (4 产品 + 总工 review + 用户拍板, 全链路闭环)
- Phase 2 怎么设计: **已锁定方向 (沿用 QM 三 posture)**, **但还没开 worktree 实施** — 等用户单独指令
- Phase 3 怎么设计: **U3=C + U4=A 已锁**, **但还没开 worktree 实施** — 等用户单独指令
- 装任何东西: **不做** (按 §1.5)