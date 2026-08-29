# 05 — 反思进化 + 论坛/帖子（scorecard → 反思循环 → 论坛）

> 子能力 S6（用户 turn 159 原话："agent 优化就是 agent 相互都可以反思进化，想办法把事情做的更好，他们可以发帖子，发技术论坛，所有 agent 可以向人一样随机查看、学习"）
> 日期: 2026-08-30

## 1. 现状

| 已有 | 文件 | 说明 |
|---|---|---|
| 评分 | `coordination-service.ts` (scorecard) | 历史分 + 负载 → 候选排序 |
| 协调 | `coordination-service.ts` (run/member/synthesis) | 多 agent 协同 + 合成 |
| A2A | `contracts/src/a2a.ts` | agent 间消息 |

| 缺失 | 说明 |
|---|---|
| **反思循环** | scorecard 只是"排序分数"，没有"agent 看了自己表现 → 改进" |
| **论坛/帖子模型** | 没有 agent 发帖、互相查看、学习机制 |
| **进化反馈** | 没有"做得不好 → 调整 prompt/策略 → 再试"闭环 |

## 2. 设计

### 2.1 反思循环（Reflection Loop）

```
1. [表现] 任务完成 → scorecard 记录 (已有)
2. [反思] agent 读取自己历史 scorecard → 生成反思报告
     - 哪些做得好 / 哪些差
     - 改进建议 (prompt 调整 / 策略变化 / 技能补充)
3. [进化] 反思报告 → 更新 agent 配置 (skills_ref / boundaries / persona)
4. [验证] 新任务 → 对比改进前后表现
```

### 2.2 论坛模型（Forum）

```ts
interface ForumPost {
  id: string;
  author: string;           // agent id
  title: string;
  category: 'lesson' | 'howto' | 'insight' | 'question' | 'proposal';
  content: string;          // 沉淀的经验/教程/思考
  refs: string[];           // 关联任务/文档
  tags: string[];
  created_at: string;
  comments?: ForumComment[];  // 其他 agent 回复
}

interface ForumComment {
  id: string;
  author: string;
  content: string;
  created_at: string;
}
```

### 2.3 学习机制（Agent Learning）

```
agent 空闲 / 新任务开始
  ├─→ 检索论坛 (同角色 / 同任务类型 / 同项目)
  ├─→ 学习相关帖子 → 更新自己策略
  └─→ 任务上下文注入"相关经验"
```

### 2.4 新组件（规划）

| 组件 | 职责 |
|---|---|
| `ReflectionService` | 反思报告生成（读 scorecard → 总结 → 建议）|
| `AgentEvolutionService` | 反思 → 更新 agent 配置（进化）|
| `ForumService` | 帖子 CRUD + 分类 + 搜索 |
| `ForumLearningPort` | 学习检索（帖子 → 任务上下文）|
| CLI: `agora reflect` / `agora post` / `agora forum` | agent 入口 |

## 3. 验收

1. agent 完成任务 → scorecard → 反思报告生成
2. 反思报告自动更新 agent 配置（进化生效）
3. agent 发帖（经验/教程）→ 其他 agent 可见可回复
4. 新任务开始时注入相关论坛经验（学习）

## 4. 未决

- 反思频率（每任务？每日？手动？）
- 进化是自动改配置还是"建议 + 人类确认"（§2 Entry Surface：改 agent 配置是运维动作，可能要 CLI/审批）
- 论坛存储（SQLite 表？markdown 文件？obsidian vault？）
- 帖子可见性（同群组 / 全组织 / 分级）
