# 风险清单 — v0.1 必须承认

## 风险 1：Synapse 注册关闭

**事实**（已验证）：
```
POST /_matrix/client/v3/register → 403
```

**后果**：任何新 DSH 节点要 matrix bot 账号**没有自动化路径**，必须 admin 手动开。

**缓解**：
- v0.1 必须配套 `provision-bot.sh`
- 用 homeserver 管理员 access_token 调 `_synapse/admin/v1/register`
- 输出 bot mxid + access_token + device_id
- README 必须明说 "新节点先跑 provision-bot"

**专家评价**（C）：没有 provision-bot = v0.1 不可用。

## 风险 2：access_token 生命周期

**事实**：Synapse access_token 不会自动续期。设备重启 / token 过期 → 进程无法连 homeserver。

**v0.1 策略**：
- 启动时验证 token（`/_matrix/client/v3/account/whoami`）
- 失败 → fail-fast，DSH 启动报错
- 不自动重连 / 不自动续期（避免不可预测状态）
- 用户 / admin 手动 re-login

**v0.2 评估**：是否支持 `_matrix/client/v3/login` 替代 register（如果 admin 配了密码登录路径）。

## 风险 3：device_id 唯一性

**事实**：matrix-js-sdk 默认随机 device_id。多进程共享 device_id 会冲突 E2EE key bundle。

**v0.1 策略**：
- `cordis.patch.yml` 显式配置 `deviceId: 'DSH-MATRIX-CONNECTOR-<nodeId>'`
- 每 DSH 节点独立 device_id
- E2EE v0.1 不开，不受影响

## 风险 4：E2EE 可选但配置复杂

**事实**（已验证）：
- Synapse v1.12 + `org.matrix.e2e_cross_signing` 在 unstable_features
- matrix-js-sdk E2EE 路径要 `@matrix-org/olm`（WASM）
- olmcrypto 资源 ~10MB，启动慢

**v0.1 策略**：
- ❌ 不支持 E2EE 房间
- README 明说 "v0.1 不支持 E2EE 房间；如需加密房间消息，请使用 Element 客户端"
- 加密房间消息会被 matrix-js-sdk 静默丢弃

## 风险 5：agora 中央事件流接口

**事实**（未完全验证）：dsh-agora 0.6.0 + agora 中央的 events 接口是否真存在 /api/events?since=<seq>？

**v0.1 缓解**：
- 第一阶段先 curl `/api/events` 验证接口存在
- 不存在 → 退化为 polling `/api/dispatch?since=<seq>` 或 `/api/tasks?since=<seq>`
- **agora 中央代码完全不改**，只读已存在接口

## 风险 6：双中央时间同步

**事实**：两个中央服务器时钟不同步 → dispatch_id 时间戳漂移，影响事件排序。

**缓解**：
- agora 中央事件流已有 `since=<seq>` 序号机制（dsh-agora 0.4+ ledger）
- 不依赖 wall clock
- v0.1 验证 `seq` 严格单调

## 风险 7：matrix 中央故障域

**事实**：matrix 中央挂了 → connector 失去 /sync，但 agora 中央仍可工作。

**降级策略**（v0.1）：
- matrix /sync 断连 → matrix-js-sdk 内置指数退避
- 长时间断连 → connector 标记 `matrix_bridge=degraded`，但 DSH node 仍在线（依赖 dsh-agora）
- agora 中央可独立工作

## 风险 8：cc-connect 兼容

**事实**：cc-connect 在矩阵场景下被 connector 替代。但 cc-connect Go 代码不删，仍服务 Discord/飞书/slack。

**缓解**：
- v0.1 不动 cc-connect 代码
- README 明说 "matrix 走 dsh-matrix-connector，其他 IM 走 cc-connect"
- 用户可选择性安装

## 风险 9：测试依赖真 Synapse

**事实**：smoke-matrix.mjs 必须跑在真 Synapse 上，本机 8.136.15.147:8008 是远端。

**缓解**：
- 单测全部用 mock（matrix-js-sdk mock + fetch mock）
- smoke 用远端 Synapse（已有）
- CI 不能跑 smoke（除非配 test homeserver）
- README 明说 "smoke 必须有 homeserver"

## 风险 10：v0.1 用户预期管理

**事实**：用户问 "类飞书体验"。v0.1 = 文本 + markdown，**远低于用户预期**。

**资深架构师 B 的不安**（已表达）：
- 如果用户内心时间表 = 3 个月内要类飞书，v0.1 是浪费
- 必须**在交付时配 doc / 视频演示**让用户看到 v0.1 = 跑通骨架

**缓解**：
- README 含 "v0.1 vs v0.2 vs v1.0 路线图"
- walkthrough 含 demo 截图
- 不要承诺 v0.1 之外能力

## 风险 11：扩展点未验证

**事实**：v0.1 留的 threadKey 抽象 / actor opaque / format 字段等扩展点，**没有 v1.0 验证**。

**诚实评价**：架构合理，但**未来不一定按规划演进**。如果 v1.0 方向变了，扩展点可能重做。

**缓解**：
- v0.2 开始前重新评估扩展点
- v1.0 RFC 时再过一遍设计
