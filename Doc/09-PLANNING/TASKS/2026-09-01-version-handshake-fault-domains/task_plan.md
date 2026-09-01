# 阶段计划：版本握手、三节点故障回归与安全域激活

- Agora worktree: `E:/Learn AI Agent/dsh-agora/.worktrees/phase-version-handshake-fault-domains`
- Connector worktree: `E:/Learn AI Agent/dsh-matrix-connector/.worktrees/phase-version-handshake-fault-domains`
- 分支：`feat/phase-version-handshake-fault-domains`

## 阶段
1. 盘点现有节点协议、插件启动与安全域边界。
2. TDD 实现通用 Runtime 握手及兼容性结果。
3. 增加三节点断线、重启、重复消息测试。
4. 增加 Life/Health/Companion 独立安全域激活门禁（仅代码/配置就绪，不直接上线）。
5. 更新 SSoT、walkthrough，运行 focused/build/gate 测试，提交并推送两个仓库。
