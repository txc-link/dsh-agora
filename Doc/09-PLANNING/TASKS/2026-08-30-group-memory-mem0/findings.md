# Findings: Group Memory via mem0

## 部署探测（2026-08-30 实测）

- ss -tlnp 扫出 25+ 监听口 → openapi.json 逐一识别 → **8888 = Mem0 REST APIs**
- mem0 源码仓在 /root/mem0-deploy/mem0（含 server/main.py 可读语义）:
  - add: 至少一个 user_id/agent_id/run_id 必填(400); messages [{role,content}]; infer 默认走 LLM 抽取 → 机器经验记录应 infer=false 保真
  - list: GET /memories?user_id= (limit 默认 1000); search: POST /search {query,user_id,top_k}
  - 序列化: {id, memory, user_id, metadata, created_at}; metadata 保留自定义键
- 认证: JWT (auth/login) + API keys (POST /api-keys 需登录态); 注册已关闭 → **需要用户提供 admin 凭据或 dashboard 建 API key**
- LLM/embedder 均为本机服务 (host.docker.internal:8081/8082) → 写入不依赖外部 API

## 设计决策

### D1: scopeRef → mem0 user_id
- mem0 的 user_id 就是隔离维度; agora 的 scope (project:/group:/agent:) 直接映射, 语义兼容
### D2: infer=false 默认
- 经验记录 = agent 结构化产出, 应原文保真 + 不烧本机 LLM; mem0 推断留给会话式记忆场景
### D3: adapter 用全局 fetch + fetchImpl 注入
- Node 25 全局 fetch; 测试注入 fake, 无新依赖
### D4: GroupMemoryService 不做本地缓存
- 共享记忆的 SSoT 在 mem0 (群组共享); 本地缓存是跨节点 L4 的事, 不做

### D5: npm omit=dev 全局坑
- 本机 npm `omit=dev`（全局配置）→ worktree 内 `npm install` 会剪掉 vitest 等 devDeps; 必须 `--include=dev`。修复: node_modules 用复制法 + 需要新依赖时 `npm install --include=dev`
