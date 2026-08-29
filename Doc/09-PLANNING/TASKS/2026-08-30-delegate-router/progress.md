## R1 完成 (develop 349a04d)

- core DelegateRouter: delegateSubtree (子树委派+排除发起者) / escalateUp (上报链第一个 lead)
- 深度限制 (默认 4) + 显式环检测 (拒绝而非截断)
- notify 端口可选注入 (事件 task_delegated/task_escalated); 未注入时仅路由解析
- TDD 7 测试; 回归 645/645; build+双 gate; 冒烟 4/4 (子树委派/escalate 链/深度限制/孤儿拒绝)
- CLI 坑: commander 父命令 option 不传给 subcommand action — --max-depth 须挂子命令
