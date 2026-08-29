# Progress — dsh-matrix-connector 战略讨论

## 2026-08-28 turn 24

### 实测验证
- `curl http://8.136.15.147:8008/_matrix/client/versions` → r0.x + v1.1~v1.12 全在，unstable features 列表长 = Synapse 现代版本
- `curl http://127.0.0.1:18008/api/health` → `{"status":"ok"}`
- `POST /_matrix/client/v3/register` with `m.login.dummy` → **403**（注册关闭）
- `whoami` 无 token → `M_MISSING_TOKEN`（协议正常）
- `find` agora-ts / dsh-agora 仓 → 零 matrix 代码
- `grep matrix` dsh-agora src → 无引用
- `grep matrix` agora Doc/ → 无引用

### 关键发现
matrix 中央协议层活的（v1.12）；**agora-ts + dsh-agora 0 矩阵代码** = 空白画布。
dsh-agora 0.6.0 已绑 nodeId `ailink-web`，runtime RPC `DSH_AGORA_RUNTIME_PROTOCOL` 已就绪。

### 决策依赖
战略 5 题未答：
1. matrix 在产品中是"一个 IM adapter" 还是 "agent 协作骨架"
2. agora 中央是否承担 mxid ↔ agora user 映射
3. "类飞书体验" 在 v1 还是 v0.1
4. matrix 中央是否承载权限/工作流
5. cc-connect 在矩阵场景下是否出局

专家讨论产物落 `Doc/03-ARCHITECTURE/dsh-matrix-entry-adapter/`，待续。
