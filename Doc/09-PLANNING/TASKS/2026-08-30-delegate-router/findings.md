# Findings: DelegateRouter

- 语义对齐蓝图 02 §2.2: 认领(agent 侧 poll) → 委派(router 子树下发) → 群发(notify 端口→IM Phase 6 绑定) → 下级执行
- 环检测策略: resolver.chainToRoot 静默截断环; router 显式检测并拒绝 (委派失败要可见, 不能静默丢)
- 深度 = team 距根链长 (chainToRoot.length), 默认上限 4
- python str.replace 静默 no-op 坑: 必须 assert anchor in s
- commander: 父命令 option 不传给 subcommand action
