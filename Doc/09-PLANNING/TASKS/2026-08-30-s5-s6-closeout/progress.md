# progress — S5/S6 closeout

- worktree: .dsh/workspaces/s56-closeout (feat/s56-closeout → develop c0e5c9a, worktree 已删)
- TDD: 19 新/更新测试 (question 写回 2 + evolution 3 + 既有回归) → 全量 1423/1423 ✅
- gates: core-architecture + barrel-governance ✅
- 冒烟:
  - research 写回: 真 CLI ask create/answer → mem0 :8888 (真库 list scope=task:org 两条 research 条目含 answer 正文) ✅
  - evolution: post create(proposal) + updatePost metadata → CLI evolution apply → db 终态 applied/applied_by=human:ceo ✅
- 修复记录: ① createPost metadata 未透传 (core) ② CLI fire-and-forget 进程退出丢 POST → await (core answer 语义: await+catch, 失败不阻塞)
- checklist.md 同步: S1 全部/U6 已决并勾, S5-59/61 勾, S6 全部勾, Phase6 Discord R-G 勾; 剩 federation P2/P3 (明确留待)
- 未决: federation L4 跨节点记忆与 P3 同等待用户启动多 homeserver 需求
