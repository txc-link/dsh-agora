# S5/S6 收尾（checklist 清零）

- 日期: 2026-08-30 | worktree: .dsh/workspaces/s56-closeout | 分支: feat/s56-closeout
- 目标: checklist 最后两个可实现条目
  - S5-61 调研结果自动写回共享记忆: AgentQuestionService.answer 时 kind=research → GroupMemoryPort.add
  - S6-67 AgentEvolutionService: 反思报告 → proposal 帖（建议+确认模式）→ apply 状态机
- 同步: checklist 陈旧勾选修正（S1 全部/S5-59/S6-65/66/68/69 已实现未勾）

## 设计

- S5-61: options.groupMemory?: Pick<GroupMemoryPort,'add'>; answer() 成功后 kind==='research' fire-and-forget add（scopeRef=question.scope_ref, kind='research', text=answer）, 失败不阻塞
- S6-67: EvolutionService(forumService).proposeFromReport({agent_ref, report}) → category='proposal' 帖, metadata.evolution={status:'proposed', report 摘要}; apply({postId, appliedBy}) → status='applied'; CLI agora evolution propose|apply
- 不做: 自动改配置文件（core 不写死配置格式）; federation L4（留待多 homeserver）

## 状态

- [x] TDD core: question 写回 + evolution propose/apply
- [x] CLI 注入 + evolution 命令
- [x] build + gates + 回归
- [x] 冒烟
- [x] merge + checklist/SSoT/walkthrough 回写
