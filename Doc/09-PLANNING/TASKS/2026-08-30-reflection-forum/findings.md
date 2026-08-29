# Findings: Reflection + Forum

- 未决默认拍板: 存储=SQLite forum_posts/comments (039); 频率=手动 CLI; 进化=建议+显式应用 (不静默改配置); 可见性=项目作用域
- node:sqlite prepare(sql, [args]) 第二参数被忽略 → INSERT 静默不执行; 必须 .run(...args) — 最隐蔽的一类静默失败
- runtime_agent_observations.member_id UNIQUE: 每 member 一条聚合观察 (recordObservation INSERT OR IGNORE 语义)
- FK 链: observations→coordination_members→(coordination_runs→tasks + runtime_node_dispatches→runtime_nodes); 冒烟造数需全链
- 反思规则纯确定性 (阈值: score 70/50, rate 0.7/0.3), 无 LLM — core 不做润色 (adapter 层职责)
