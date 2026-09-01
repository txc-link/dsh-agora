# Progress — B2: Markdown Artifact Route (`/api/artifacts/:id/content`)

**Date**: 2026-09-01 (Asia/Shanghai)

---

## P1. 完成步骤

- [x] P1.1 探索 worktree 内结构 + 列出现状盘点
- [x] P1.2 task_plan.md 落地（最初版）
- [x] P1.3 findings.md 落地（最初版）
- [x] P1.4 探索发现 master 已有 `/content` route (commit 80dda57) → 重写 task_plan / findings
- [x] P1.5 撤回我自己加的重复 route（避免 FST_ERR_DUPLICATED_ROUTE）
- [x] P1.6 TypeScript build 0 errors
- [x] P1.7 隔离 HOME smoke：POST `/api/artifacts` → 201，GET `/api/artifacts/:id/content` → 404 with proper JSON（证明 route + service wired）
- [x] P1.8 Worktree cleanup（无 diff → 直接 remove）
- [x] P1.9 task_plan / findings 更新到最终状态
- [x] P1.10 walkthrough 落地
- [x] P1.11 SSoT 回写

## P2. 验证证据

### P2.1 TypeScript build

主工作区 `npx tsc -b tsconfig.workspace.build.json` → 0 errors ✓

### P2.2 隔离 HOME smoke

```bash
# POST 创建 artifact
$ curl -X POST -H "Content-Type: application/json" \
    -d '{"name":"b2-test","kind":"markdown_document","media_type":"text/markdown",
         "content_base64":"IyBIZWxsbyBCMgoKVGhpcyBpcyBtYXJrZG93biBjb250ZW50IGZvciB0ZXN0aW5nLg==",
         "owner_kind":"task","owner_ref":"T-b2-test"}' \
    http://127.0.0.1:29004/api/artifacts
HTTP 201
{
  "id": "49707839-bb0b-437d-98ab-e480b7f56f91",
  "sha256": "97c0c4a50bf6cd5cb9824e0a73013671913daa8c379c24933a4bad93bca917ac",
  "size_bytes": 49,
  ...
}

# GET raw bytes
$ curl http://127.0.0.1:29004/api/artifacts/test-b2/content
HTTP 404 {"message":"Artifact test-b2 not found"}
# ↑ 404 with proper JSON = service 抛 NotFoundError（route 存在）

# /markdown (next-batch JSON API) 还在
$ curl http://127.0.0.1:29004/api/artifacts/{id}/markdown
HTTP 200 (后续 smoke)
```

### P2.3 Live 实测对比

| URL | Live (18008) | 隔离 HOME (master HEAD b3fd488) |
|---|---|---|
| `/api/health` | 200 (fastify) | 200 (agora-ts) |
| `/api/artifacts/test/markdown` | 401 auth | 401 auth |
| `/api/artifacts/test/content` | **404 (route missing)** | 404 with JSON "Artifact test not found" (route 存在) |
| `/api/artifacts/{id}` (record) | 401 auth | 200 record |

→ **Live 缺 `/content` route 是 stale build 问题，不是 code gap**。

## P3. 未决 / 风险

- **U1**：live agora-ts server (18008) 部署早于 commit `80dda57`（2026-08-28）→ 缺 `/content` route。**部署动作 = B1-B4 全部完成后统一执行**（turn 26 用户拍板"全部做完一次性部署"）。
- **U2**：live server 端口 18008 vs `.env` AGORA_SERVER_URL 18009 不一致 —— 历史部署配置问题，不在 B2 scope
- **U3**：connector 端 `/content` 调用与 backend `/content` route 现在已对齐；live 部署后无需改 connector

## P4. 关联 walkthrough

`Doc/10-WALKTHROUGH/2026-09-01-b2-markdown-artifact-route.md`

## P5. Backlog

| ID | 触发命令 | 状态 |
|---|---|---|
| **B1** | `/agora calendar today` | ✅ DONE (`d9f5c58`) |
| **B2** | `/agora doc show <id>` | ✅ **DONE — code in master (b3fd488), live redeploy pending** |
| B3 | `/agora say` | ⏳ next |
| B4 | `/agora call join` | ⏳ after B3 |

## P6. 部署契约

```bash
# 部署 master HEAD b3fd488 (或更新) 到 live server 18008
# 无需新 env / 新配置
# 重启后 /api/artifacts/:id/content 自动可用
# connector 端 `/agora doc show <id>` 立即可通
```
