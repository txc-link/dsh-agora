# Findings: Org Model

- 测试 fake 踩坑: contracts 用 snake_case (parent_id), service input 用 camelCase (parentId) — fake 写错字段不报 TS 错 (vitest 不 typecheck), 运行时 parent 全 null; 教训: fake 字段名要对照契约
- 环守卫语义: setParent(dev, worker) 当 worker ∈ dev 子树 → 拒; worker 重挂 root 合法 — 测试按真实状态机写
- getAgentQuestionService 的 assistantRef TODO (S1 落地后从配置读) 仍未动: 助手形态 = U2 用户拍板
