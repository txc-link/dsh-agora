# Task Plan: Group Memory via mem0 (org-aware-work-os S4)

> 日期: 2026-08-30 · 来源: 用户愿景 "群组 agent 共享记忆" + turn 160 "记忆共享可以用 mem0" + checklist S4
> 蓝图: Doc/03-ARCHITECTURE/org-aware-work-os/03-shared-memory.md

## Worktree

- 路径: `.dsh/workspaces/group-memory` · 分支: `feat/group-memory`（基于 develop 3f50115）

## 部署探测结论（本机实测）

- mem0 REST server **运行中: http://127.0.0.1:8888**（openapi title "Mem0 REST APIs"）
- 栈: postgres + JWT auth（已初始化, 注册已关闭）+ LLM=本机 vLLM Qwen2.5-0.5B (host:8082) + embedder=本机 bge-m3 (host:8081)
- API: POST /memories {messages[{role,content}], user_id, metadata, infer} · POST /search {query, user_id, top_k} · GET /memories?user_id=&limit=
- **凭据缺口**: 管理员账号用户自建（dashboard）, agora 无 token → 真实写冒烟待用户提供 API key; 本轮先交付代码 + 401 错误路径冒烟

## 设计（§1.5 最短路径）

- core 端口: `GroupMemoryPort`（add/search/list, scopeRef+kind+agentRef 语义）— core 零平台名
- core 服务: `GroupMemoryService`（record/recall/list + 校验; S6 论坛与任务生命周期的接入缝）
- adapter: `@agora-ts/adapters-mem0` — `Mem0RestAdapter implements GroupMemoryPort`（fetch 注入可测; infer=false 保真存储经验原文）
- scopeRef 映射 mem0 user_id（如 project:OC-x / group:dev / agent:x）
- CLI: `agora experience {add,search,list}`（§2 Agent→CLI 入口）
- obsidian 分组映射 + 跨节点 L4 → 后续轮

## 轮次

| 轮 | 内容 | 状态 |
|---|---|---|
| R1 | core 端口+服务 TDD | pending |
| R2 | adapters-mem0 包 TDD（fake fetch） | pending |
| R3 | CLI experience 命令 + 回归 | pending |
| R4 | 冒烟（401 错误路径 + 待 token 后补全链路）+ merge + 回写 | pending |
