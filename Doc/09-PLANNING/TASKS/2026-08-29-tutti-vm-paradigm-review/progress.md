# Progress: Tutti·VM Paradigm Review (2026-08-29)

## 阶段

| 阶段 | 状态 | 备注 |
|---|---|---|
| 1. ✅ 拆 Tutti·VM 4 机制 | 完成 | Room / @pull / 借用 / 内置应用 |
| 2. ✅ 定位真缺 | 完成 | 共享状态层 + @pull 对象 = 必做 |
| 3. ✅ 建 task_dir + arch 子目录 | 完成 | 2 个目录已建 |
| 4. ✅ task_plan.md | 完成 | 7 节, 含 §1/§1.5/§2/§3/§4 约束 |
| 5. ✅ findings.md | 完成 | 6 节, 含 URI 设计草案 |
| 6. ⏳ progress.md | 进行中 | 本文件 |
| 7. ⏳ arch 子目录文档 | 待办 | README + 4 子话题 + undecided.md |

## 关键结论 (一句话)

> **抄 Tutti 的 "共享工作现场 + @pull 对象" 两个机制**, **不抄** SaaS Room / 多租户 / Agent 自发无审批。
> 我们差异化优势是 "受控 + 长期 + 审计" (agora 中央 + sentinel + audit log), 正是 Tutti 不做的。

## 4-phase 实施顺序 (已落 task_plan §4)

| Phase | 内容 | 状态 |
|---|---|---|
| 1 | WorkSite 抽象 + URI 协议 (agora 中央) | 设计阶段 |
| 2 | @深度引用 = pull 对象 (matrix-connector) | 设计阶段 |
| 3 | Agent 借用 + 受控 ACL | 设计阶段 |
| 4 | 真任务 end-to-end 跑 + walkthrough | 待用户选项目 |

## 待用户决策 (undecided.md)

1. URI 协议用单 scheme (agora://) 还是多 scheme (matrix:// / git://)?
2. Phase 4 选哪个真项目跑 (turn 52 候选 4 个)?
3. Agent 借用的边界 (谁能借, 借多久)?
4. ACL 跟 Phase 3 一起做, 还是单独 phase?

## 状态

- brainstorm: **完整完成** (按 §3 已落 task_plan + findings + progress + arch 子目录)
- 实现: **不动** (用户没要求实现, 这次纯 brainstorm)
- 文档: 4 文档落盘 (task_plan + findings + progress + arch README)