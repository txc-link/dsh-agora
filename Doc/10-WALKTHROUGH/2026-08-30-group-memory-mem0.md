# Walkthrough — Group Memory via mem0 (S4 R1)

> 日期: 2026-08-30 · develop `993e7b6`
> Planning: `Doc/09-PLANNING/TASKS/2026-08-30-group-memory-mem0/`

## 1. 目标

用户愿景"群组 agent 共享记忆"（S4）第一轮: mem0 复用落地（用户 turn 160 指定）。

## 2. 部署探测（本机实测）

- `ss -tlnp` 扫监听口 → openapi.json 逐一识别 → **mem0 REST server 运行于 :8888**
- 栈: postgres + JWT（已初始化, 注册已关闭）+ LLM=本机 vLLM Qwen2.5-0.5B (:8082) + embedder=本机 bge-m3 (:8081)
- 源码仓 `/root/mem0-deploy/mem0` server/main.py 提供精确语义: add 需 user_id/agent_id/run_id 之一; infer 默认走 LLM 抽取

## 3. 交付

| 层 | 内容 |
|---|---|
| core | `GroupMemoryPort`（add/search/list）+ `GroupMemoryService`（校验编排, S6 论坛接入缝） |
| adapter | `@agora-ts/adapters-mem0` `Mem0RestAdapter`（scopeRef→user_id; infer=false 原文保真; Bearer; fetch 注入） |
| CLI | `agora experience add/search/list`（env: AGORA_MEM0_URL/TOKEN, AGORA_GROUP_SCOPE, AGORA_AGENT_REF） |

## 4. 设计决策

- **D2 infer=false**: 经验记录是 agent 结构化产出, 原文保真 + 不烧本机 LLM; mem0 推断留给会话式记忆
- **D1 scopeRef→user_id**: mem0 的 user_id 即隔离维度, 与 agora scope 语义兼容（project:/group:/agent:）
- **D4 无本地缓存**: 共享记忆 SSoT 在 mem0; 跨节点缓存属 L4 联邦, 后续轮

## 5. 验证

- TDD: 11 新测试（service 7 / adapter 4）; core+db+adapters-mem0 回归 **629/629**; build + 双 gate
- 冒烟 6/6: 真实 mem0 401 错误路径 3/3（网络+协议已通, 干净暴露凭据缺口）+ mem0-schema stub 全链路 add→search→list 3/3
- npm 坑记录: 本机全局 `omit=dev`, worktree 重装依赖须 `--include=dev`

## 6. 待用户（不阻塞后续轮）

mem0 管理员（用户 dashboard）建 API key → `export AGORA_MEM0_TOKEN=...` 后 `agora experience` 即真实读写。用户提供后补一轮真实全链冒烟。

## 7. 下一轮

S1 组织模型（TeamService/OrgHierarchyResolver + `agora org`/`agora team`）→ S3 DelegateRouter。
