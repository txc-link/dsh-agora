# Walkthrough — Reflection + Forum (S6)

> 日期: 2026-08-30 · develop `92938b0`
> Planning: `Doc/09-PLANNING/TASKS/2026-08-30-reflection-forum/`

## 1. 交付

| 内容 | 位置 |
|---|---|
| `ForumPostRecord`/`IForumRepository`（§33; refs/tags JSON） | contracts |
| migration `039_forum.sql`（posts + comments, 项目作用域） | db |
| `ForumService`（CRUD + comment + search + **relevantPosts 学习注入**） | core |
| `ReflectionService`（scorecard → 确定性反思报告: 强项/弱项/建议） | core |
| CLI `agora post {create,list,show,comment}` / `agora forum {search,learn}` / `agora reflect run` | apps/cli |

## 2. 语义落地（蓝图 05）

- **论坛**: agent 发经验帖（lesson/howto/insight/question/proposal）→ 其他 agent 可见可回复
- **学习注入**: 新任务开始时 `agora forum learn --task-type/--tags` → tag 匹配帖子（无命中兜底同项目最近 lesson/howto）→ 注入任务上下文
- **反思循环**: 任务完成 → scorecard 聚合（coordination 已有）→ `agora reflect run --agent` → 报告（确定性规则: score 70/50 分档, 成功率/重试/超时/verifier 阈值 0.7/0.3）→ 建议供显式应用（发帖沉淀/改配置），core 不静默进化
- 4 个未决项默认拍板（存储 SQLite / 手动触发 / 建议制进化 / 项目作用域）

## 3. 验证

- TDD 8 新测试；core+db 回归 **653/653**；build + 双 gate
- 冒烟 5/5: 发帖+回复 → keyword 搜索 → 学习注入（tag 命中）→ 无观察干净报错 → 真实 scorecard（FK 链 tasks→runs→members→dispatches→nodes）反思报告 4 弱项 + 5 建议
- 关键踩坑: node:sqlite `prepare(sql, [args])` 第二参数被忽略 → INSERT 静默不执行（必须 `.run(...args)`）；`runtime_agent_observations.member_id` UNIQUE（每 member 一条聚合观察）

## 4. 下一轮

Phase 6 部署: matrix transport 真实化（matrix-js-sdk, S5/S3 IM 通道绑定）+ worksite thread resolver + 拓扑（U5）。
