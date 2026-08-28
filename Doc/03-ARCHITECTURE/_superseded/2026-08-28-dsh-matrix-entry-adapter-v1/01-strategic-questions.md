# 战略五题 — 专家架构师判断

## 题 1：matrix 在产品里的真实身份
**结论**：matrix 既是 IM adapter，**也是**未来 agent 协作骨架。v0.1 实现 IM adapter，v0.2/v1.0 演进到骨架。
**依据**：用户 5 轮对话同时出现 "扩展 cc-connect"（H1，IM 视角）和 "类飞书体验 + 组织化"（H2，骨架视角）。**架构上必须保留 H2 扩展点**：
- threadKey 抽象（让 matrix 是 thread 的一个实现）
- actor opaque（让 mxid 不进 agora 中央）
- result envelope `format` 字段（让 v1.0 卡片有协议入口）

## 题 2：agora 中央是否承担 mxid ↔ agora user 映射
**结论**：**绝不在 agora 中央做**。
**理由**：
- §1 红线（IM 概念禁入 core）
- agora 中央看到的是 `actor: '@mxid:homeserver'` 的不透明字符串，**不解析**
- dsh-matrix-connector 内部维护 `mxid → display_name` 的轻量本地缓存
**反模式**：在 agora 中央加 `mxid_mappings` 表 = §1 违规

## 题 3：类飞书体验的版本归属
**结论**：**v1.0**，不在 v0.1 范围。
**v0.1 仅实现**：文本 + markdown HTML + `/agora ...` 命令 + 占位 edit。
**v0.2**：基础卡片（format='card.v1' 协议草案）
**v1.0**：富交互（按钮、回调、状态机）、工作流、审批

## 题 4：matrix 中央是否承载权限/工作流
**结论**：**绝不**。matrix 中央只做 IM。
**理由**：matrix 的 Power Levels 是协议层概念（房间内谁能 ban/kick），**不进业务编排**。权限决策、工作流、审批全部走 agora 中央。
**反模式**：在 matrix 中央建 room_state policy 机器 = 双重真理源

## 题 5：cc-connect 在矩阵场景下是否出局
**结论**：**矩阵场景出局**，其他 IM 继续 cc-connect。
**理由**：
- cc-connect 设计是 fork 本地 agent 子进程（matrix.md 已证实），和 agora 中央调度模型不兼容
- Go + goolm vs TS + matrix-js-sdk，生态成熟度后者高
- cc-connect 在 Discord/飞书/slack 场景仍有效，不浪费

## 综合：5 条决策
1. 矩阵场景 cc-connect 出局
2. agora 中央 = 任务编排 + 状态机；matrix 中央 = IM 协议；双中央正交
3. 边界 = opaque threadKey + adapter 私有 registry（02-adapter-boundary.md）
4. v0.1 严格范围（04-v01-scope.md），6 周交付
5. 必须配套 provision-bot 脚本（06-provision-bot.md）
