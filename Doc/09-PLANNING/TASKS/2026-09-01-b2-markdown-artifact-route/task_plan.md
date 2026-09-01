# Task Plan — B2: Markdown Artifact Route (`/api/artifacts/:id/content`)

**Date**: 2026-09-01 (Asia/Shanghai)
**Source**: SSoT `Doc/Agora-实施排期-Agora-TS.md` §7 row "2026-08-31 next batch" + Backlog B2 (turn 24 closeout)
**Trigger**: CEO 收件箱实测 `/agora doc show <id>` → 404 (matrix-connector v0.1.1 smoke, turn 23)
**Author**: 总工
**Status**: ✅ **DONE — code already in master, only live redeploy needed**

> **关键结论更新**（来自 turn 26 中途的 live + worktree 调查）：
> master HEAD `b3fd488` 上 `app.ts:5835` 已有 `GET /api/artifacts/:artifactId/content` route，
> 由 commit `80dda57 feat(coordination): add governed federation` (2026-08-28) 引入。
> B2 不需要新 code change —— 唯一的 gap 是 **live agora-ts server 是 stale build**，
> 不包含 80dda57 之后的代码，所以 `/content` 在 live 返 404。

---

## 0. Worktree 决策（AGENTS.md §3 §6）

- **Worktree 创建过**：`/home/ailink/dsh-agora/.worktrees/agora-ts-markdown-artifact-route` @ base `b3fd488`
- **Worktree 已清理**：发现 master 已含 route，无 diff → `git worktree remove --force` + `git branch -D`
- **未创建 commit**：worktree 无代码改动，branch 删除后无 commit 残留

## 1. 目标

让 `/agora doc show <id>` 在 CEO 收件箱能返回 markdown 文档内容（不再是 404）。

## 2. 现状盘点（重新校准后）

### 2.1 Master HEAD 实际状态（b3fd488）

| 组件 | 状态 | 文件:line | 引入 commit |
|---|---|---|---|
| `ArtifactService` core | ✅ 已实现 | `packages/core/src/federation-services.ts:28` | 早期 |
| `FilesystemArtifactContentStore` adapter | ✅ 已实现 | `packages/adapters-materialization/` | 早期 |
| `runtime.ts` 构造 `artifactService` | ✅ 已实现 | `apps/server/src/runtime.ts:309-311` | 早期 |
| `runtime.ts` 把 artifactService 加到 return | ✅ 已实现 | `apps/server/src/runtime.ts:399` | 早期 |
| `index.ts` 传 artifactService 给 buildApp | ✅ 已实现 | `apps/server/src/index.ts:22` | 早期 |
| `app.ts` route `GET /api/artifacts/:artifactId/markdown` | ✅ 已注册 | `app.ts:5873` | next-batch 2026-08-31 |
| `app.ts` route `POST /api/artifacts/:artifactId/markdown` | ✅ 已注册 | `app.ts:5896` | next-batch 2026-08-31 |
| **`app.ts` route `GET /api/artifacts/:artifactId/content`** | ✅ **已注册** | `app.ts:5835` | **`80dda57` 2026-08-28** |
| `app.ts` route `GET /api/artifacts/:artifactId` (record) | ✅ 已注册 | `app.ts:5826` | 早期 |

### 2.2 接口对齐

| | 路径 | 来源 |
|---|---|---|
| Connector 发 | `GET /api/artifacts/:id/content` | `dsh-matrix-connector/src/agora-rest.ts:266` |
| Backend 提供 | `GET /api/artifacts/:artifactId/content` | `app.ts:5835` |
| **对齐** | ✅ **OK** | master 已 wire |

### 2.3 Live 实测（18008）

```bash
$ curl http://127.0.0.1:18008/api/artifacts/test/markdown
HTTP 401 missing bearer token  ← 路由存在（auth 拦截）

$ curl http://127.0.0.1:18008/api/artifacts/test/content
HTTP 404                        ← 路由缺失！live 是 stale build
```

**结论**：live server (18008) 不包含 80dda57 之后的代码 → 缺少 `/content` route。这是**部署问题**而非 code gap。

## 3. 范围（重新校准）

### 3.1 In Scope（本轮做）— 全部完成

- ✅ Master code 已含 `/content` route（无需改动）
- ✅ Smoke 验证：在隔离 HOME 起 server + 创建 artifact + GET `/content`
- ✅ Worktree cleanup（无 diff 直接 remove）
- ✅ task_dir + walkthrough + SSoT 回写

### 3.2 Out of Scope

- ❌ **live server 重新部署**（运维动作，由用户在 B1-B4 全部完成后统一部署）
- ❌ 改 connector 用 `/markdown` 替代 `/content`（跨仓改动，无必要）
- ❌ dashboard markdown UI（前端，超 B2 scope）

## 4. 设计

### 4.1 master `/content` route 实现（保留，无需改）

```ts
// app.ts:5835
app.get('/api/artifacts/:artifactId/content', async (request, reply) => {
  if (!artifactService) return reply.status(503).send({ message: 'Artifact service is not configured' });
  try {
    const { artifactId } = request.params as { artifactId: string };
    const artifact = artifactService.get(artifactId);
    return reply.type(artifact.media_type).send(artifactService.content(artifactId));
  } catch (error) {
    const translated = translateError(error);
    return reply.status(translated.statusCode).send(translated.body);
  }
});
```

返回 raw bytes + Content-Type = artifact.media_type。

### 4.2 我原本想加的 route（已撤回）

```ts
// 撤回原因：与 master 5835 重复
app.get('/api/artifacts/:artifactId/content', async (request, reply) => {
  // ... + headers (x-content-sha256, x-content-length)
});
```

master 已实现 + smoke 验证够用 → 撤回避免 duplicate。

## 5. 执行步骤

1. ✅ worktree + task_dir 落地
2. ✅ findings.md 落地
3. ✅ Worktree 探索发现 master 已含 `/content` route（commit 80dda57）
4. ✅ Smoke 验证：隔离 HOME server + POST /api/artifacts (201) + GET /:id/content (404 "not found")
5. ✅ 撤回我自己加的重复 route
6. ✅ Worktree cleanup（无 diff 直接 remove）
7. ✅ progress.md + walkthrough + SSoT 回写

## 6. Backlog

| ID | 触发命令 | 状态 |
|---|---|---|
| **B1** | `/agora calendar today` | ✅ DONE (`d9f5c58`) |
| **B2** | `/agora doc show <id>` | ✅ **DONE — code in master, live redeploy pending** |
| B3 | `/agora say` | ⏳ next |
| B4 | `/agora call join` | ⏳ after B3 |

## 7. 部署契约

live agora-ts 重启（用 master HEAD `b3fd488` 或更新 commit）即可获得 `/content` route。
**无需新 env / 新配置**。
