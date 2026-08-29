# 03 — 共享记忆与文档（mem0 + ProjectBrain + Obsidian）

> 子能力 S4（用户 turn 159 原话："一个群组的 agent 应该共享记忆、文档"；turn 160："记忆共享可以用 memo0，资料沉淀分组可以用 obsidian"）
> 日期: 2026-08-30

## 1. 现状

| 已有 | 文件 | 说明 |
|---|---|---|
| 项目知识库 | `project-brain-service.ts` + 检索 | hybrid retrieval (embedding + qdrant) |
| Obsidian adapter | `adapters-obsidian/src/` | 已实现（rest-retrieval + context-source） |
| Brain adapter | `adapters-brain/src/` | 已实现（qdrant / openai-embedding / filesystem） |
| 上下文 | `context-harvest-service.ts` | 上下文采集/物化/检索 |
| L4 分层记忆 | federation-v1 (P2) | 设计中有，编译产物未实现 (回忆 c-858) |

| 缺失 | 说明 |
|---|---|
| **跨 agent 共享记忆层** | ProjectBrain 是"项目级"，不是"群组级 agent 共享" |
| **mem0 接入** | 用户建议用 memo0（跨会话 agent 记忆），未接入 |
| **obsidian 作为资料沉淀分组** | adapter 有了，但没接到"群组资料分组"使用场景 |

## 2. 设计

### 2.1 分层记忆模型（复用 federation-v1 P2 的 "Layered memory"）

```
L1: task brain        — 单任务上下文 (已有)
L2: project brain     — 项目知识库 (已有: ProjectBrain + qdrant)
L3: group memory      — 群组共享记忆 (缺: mem0 + 群组维度)
L4: cross-node memory — 跨节点共享 (缺: federation P2 未实现)
```

### 2.2 复用方案（§1.5 最短路径）

| 需求 | 复用 | 新增 |
|---|---|---|
| 群组共享记忆 | **mem0** (用户建议, 现成开源) | mem0 adapter（agent 记忆读写） |
| 资料沉淀分组 | **obsidian** (adapters-obsidian 已实现) | 群组 → obsidian vault 分组映射 |
| 项目知识库 | ProjectBrain (已有) | 无 |
| 跨节点 | federation P2 设计 | 实现 L4 |

### 2.3 mem0 adapter 设计（规划）

```
GroupMemoryService (core)
  ├── mem0 adapter (packages/adapters-mem0/)
  │     ├── mem0-client  (REST/本地 SDK)
  │     └── memory-scope  (group_id 维度)
  └── 接入点:
        agent 完成任务 → 经验写 mem0 (group_id = 群组)
        agent 开始任务 → 从 mem0 检索相关记忆 (同群组)
        obsidian vault → 沉淀为长期资料分组
```

## 3. 验收

1. 同一群组两个 agent：A 完成任务写经验 → B 新任务检索到 A 的经验
2. 群组资料沉淀到 obsidian vault 指定分组
3. 跨节点（3 台机）共享记忆（federation P2 L4）

## 4. 未决

- mem0 部署形态（本地 docker / 云端 / REST）
- 群组维度 ↔ ProjectBrain 项目维度的关系（并存 or 统一）
- 记忆写入触发策略（任务完成时？定期？agent 主动？）
- obsidian 分组与 agora 群组/项目的映射规则
