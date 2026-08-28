# undecided.md — 未决问题兜底

## U1: agora 中央 `/api/events` 接口是否存在？

- v0.1 假设 dsh-matrix-connector 订阅 `/api/events?since=<seq>`（5s 间隔）
- 真实接口待验证（agora 中央 dsh-agora 0.6.0 现状）
- 退化为 polling `/api/dispatch?since=...` 或 `/api/tasks?since=...`
- **决策点**：阶段 5 实现时验证

## U2: `/api/citizens` `/api/tasks` 等接口真实路径？

- v0.1 假设 agora 中央 REST 已暴露完整 citizen / task / brain / artifact 接口
- 待 dsh-agora 端确认
- **决策点**：阶段 1 启动时先 curl 验证

## U3: agora 中央 `threadKey` 字段是否存在？

- v0.1 假设 dispatch payload 接受 opaque `threadKey: string` 字段
- agora 中央 schema 待验证
- 如果不存在 → 退化用 task 描述里塞 `<threadKey>...</threadKey>` 编码
- **决策点**：阶段 5 实现时验证

## U4: matrix-js-sdk 版本

- matrix-js-sdk v30+ 默认支持 /sync v3
- v0.1 用最新稳定版
- 风险：matrix-js-sdk 历史 API 变动多，pin 版本号

## U5: cordis 版本

- dsh-agora 用 `cordis@^4.0.0-rc.8`
- dsh-matrix-connector 同步使用
- 验证 plugin entry shape 一致

## U6: dsh-matrix-connector 是否需要复刻 `extension-sdk.ts`？

- dsh-agora 内部有 `extensions/dsh-agora/sdk/extension-sdk.d.ts`
- 暴露 `runtime RPC client` 给 plugin
- dsh-matrix-connector 可能需要类似 client 调 agora 中央
- **决策点**：阶段 1 启动时验证 SDK 是否暴露必要接口

## U7: v0.2 / v1.0 启动条件

- v0.1 完成 + 用户反馈
- v0.2 详细设计在 v0.1 完成前不展开
- v1.0 详细设计在 v0.2 完成前不展开

## U8: room → project_id 映射

- v0.1：matrix room 不知道对应哪个 agora project
- 选项 A：cordis 配置 `matrixRoomId → projectId` 映射（手动）
- 选项 B：从 room topic 解析（约定格式）
- 选项 C：从房间创建事件里查（自动）
- **决策点**：v0.1 阶段 4 决定（暂用 A 简单）

## U9: mxid → agora user 映射（v1.0 议题）

- v0.1 永不做
- v0.2 不做
- v1.0 评估：mxid 是否需要映射到 agora human account
- 如果要做 → §2 红线：必须真实登录态

## U10: multi-bot 同房间（v1.0 议题）

- 一个 room 一个 bot 还是多个？
- v0.1 一个 room 一个 bot
- v1.0 评估：每个 citizen 一个 bot（视觉上不同 bot 发言）
- 风险：消息风暴 / 权限 / 资源占用

## U11: message-router 自然语言 fallback

- v0.1 只认 `/agora` 前缀命令
- v0.2 是否加入自然语言（"@dsh-bridge 帮我问 REMOTE_OK"）？
- **决策点**：v0.1 跑通后看用户实际使用模式

## U12: thread registry 持久化

- v0.1 内存持有（重启丢占位）
- v0.2 评估：sqlite / 落盘
- **决策点**：v0.1 跑通后看实际丢占位频率

## U13: cc-connect 协同 / 替代

- dsh-matrix-connector 和 cc-connect 平级
- 一个用户能不能同时用两者？
- 矩阵房间只装 dsh-matrix-connector，不装 cc-connect（README 明说）
- **决策点**：README 写清楚

## U14: matrix 中央联邦（homeserver 联邦）

- v0.1 单 homeserver
- v0.2 / v1.0 是否支持跨 homeserver
- **决策点**：v1.0 评估

## U15: E2EE 房间

- v0.1 / v0.2 不支持
- 决策：如果用户有加密房间需求 → v0.3 评估
- matrix-js-sdk E2EE 配置复杂 + olm WASM 资源重
- **决策点**：v0.1 跑通后看用户需求

---

**本 undecided.md 按 §3 强制要求保留**——讨论产物不能只记"已确认"，未决也要落盘。