progress: R1: core 端口+服务 ✅ (7 测试)
R2: adapters-mem0 ✅ (4 测试)
R3: CLI ✅ + 回归 629/629 + 双 gate
R4: 冒烟 ✅ (真实 401 路径 3/3 + stub 全链路 3/3); merge 993e7b6

## R4 冒烟记录 (2026-08-30, develop 993e7b6)

- 真实 mem0 :8888（无 token）: add/search/list 均干净暴露 `mem0 auth failed (401)` — 网络/协议链路已通, 仅缺凭据
- mem0-schema stub 全链路: add(m-1)→search(score 0.9)→list(scopeRef/kind 反解) 3/3
- npm 环境注意: 本机 npm 全局 `omit=dev`, worktree 内重装依赖必须 `npm install --include=dev`（vitest 被剪已踩坑, 记入 findings）
- **待用户提供**: mem0 管理员在 dashboard 建 API key → `export AGORA_MEM0_TOKEN=...` 即可真实写入
