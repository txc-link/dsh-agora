# 未决问题 — dsh-matrix-entry-adapter

## U1：v0.1 交付周期

- 资深建议：6 周（5/2 节奏，7.5 工作日）
- 用户内心时间表未知
- **决策点**：用户是否接受 6 周 v0.1？

## U2：v0.2 / v1.0 优先级

- v0.2 = 卡片 + E2EE 评估
- v1.0 = 富交互 + 工作流 + 权限
- 资深建议：v0.1 跑通后再评估
- **决策点**：用户是否同意 v1.0 推到远期？

## U3：agora 中央 events 接口

- 未验证 `/api/events?since=<seq>` 是否真存在
- 退化为 polling `/api/dispatch` 或 `/api/tasks` 是 fallback
- **决策点**：v0.1 阶段 5（smoke）才能确认

## U4：自然语言 fallback

- v0.1 只认 `/agora ...` 前缀
- 用户可能想 "在 Element 里 @dsh-bridge 帮我问问 node-b REMOTE_OK" 也触发
- **决策点**：v0.2 还是 v1.0 加入？

## U5：thread registry 持久化

- v0.1 方案：connector 内存持有
- 进程重启 → registry 丢失
- 影响：edit 占位消息依赖 placeholderMsgId，重启后无法 edit
- **决策点**：v0.1 接受重启丢占位（重新 dispatch 即可）还是用 sqlite 持久化？

## U6：matrix 中央多 homeserver

- v0.1 假设单 homeserver（`8.136.15.147:8008`）
- 未来 homeserver 联邦 / 自建多 homeserver 是否需要支持？
- **决策点**：v0.2 评估还是 v1.0 ？

## U7：DSH Agent prompt 中的 mxid 显示

- v0.1 actor 字段是 mxid 原文（不透明）
- Agent 看到 `actor: '@user:homeserver'`，不知道是 display_name
- 用户预期：Agent 知道是谁
- **决策点**：v0.1 connector 在 prompt 里注 display_name（违规吗？还是只是 metadata？）？

## U8：cc-connect 与 connector 的消息路由冲突

- 如果用户同时装了 cc-connect 和 connector，都连同一个 Synapse？
- cc-connect 是 fork 本地 agent，connector 走 agora 中央
- **决策点**：README 明说 "矩阵场景只装 connector，不装 cc-connect"？

## U9：openclaw / 第三方 adapter 与 connector 的协调

- agora 中央已有 adapters-openclaw、adapters-discord、adapters-obsidian 等
- dsh-matrix-connector 与这些是 sibling 关系
- **决策点**：adapter 间是否需要 routing / priority？还是各自独立？

## U10：CI 怎么跑 smoke

- smoke-matrix.mjs 必须真 Synapse
- CI 跑不起（除非配 test homeserver）
- **决策点**：CI 只跑单测，smoke 留给本地 / 预发布环境？
