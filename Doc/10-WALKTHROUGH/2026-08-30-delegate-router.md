# Walkthrough — DelegateRouter (S3)

> 日期: 2026-08-30 · develop `349a04d`
> Planning: `Doc/09-PLANNING/TASKS/2026-08-30-delegate-router/`

## 1. 交付

| 内容 | 位置 |
|---|---|
| `DelegateRouter.delegateSubtree`（子树全员委派, 排除发起者, 深度+环守卫） | `core/src/delegate-router.ts` |
| `DelegateRouter.escalateUp`（上报链最近 lead 路由） | 同上 |
| 通知端口 notify（`IMMessagingPort.sendNotification` 形状, 可选注入; 事件 `task_delegated`/`task_escalated`） | 同上 |
| CLI `agora delegate subtree --team --task [--from] [--max-depth]` / `agora delegate escalate --agent [--task]` | `apps/cli/src/index.ts` |

## 2. 设计要点

- **委派链 = team parent 链**（S1 resolver）; depth = chainToRoot 链长, 超过 maxDepth（默认 4）拒绝
- **环检测**: resolver.chainToRoot 静默截断环 → router 层显式 visited 检测并**拒绝**（委派失败必须可见, 不能静默丢）
- **群发**: notify 端口逐 target 发 `task_delegated`; 未注入时仅解析路由返回 recipients（IM 实通道 Phase 6 绑定, 同 S5 D4）

## 3. 验证

- TDD 7 新测试; core+db 回归 **645/645**; build + 双 gate
- 冒烟 4/4: 子树委派（recipients/depth 正确, 发起者排除）→ escalate 链 [dl, root] → 深度限制拒绝 → 孤儿 agent 拒绝
- 踩坑记录: commander 父命令 option 不传 subcommand action（--max-depth 移到子命令）; python str.replace 静默 no-op 须 assert

## 4. 下一轮

S6 反思论坛（ReflectionService/ForumService/AgentEvolutionService/学习注入 + CLI）→ Phase 6。
