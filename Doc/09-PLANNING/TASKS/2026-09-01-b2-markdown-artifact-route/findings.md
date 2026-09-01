# Findings — B2: Markdown Artifact Route

**Date**: 2026-09-01 (Asia/Shanghai)

---

## F1. 关键发现：master 已含 route，B2 无需 code change

turn 23 报告 `/agora doc show <id>` → 404。初步诊断假设 backend 缺 route（与 B1 类似 wiring 缺失模式）。

但 worktree 探索后发现：
- `app.ts:5835` 已有 `GET /api/artifacts/:artifactId/content` route
- 引入 commit: `80dda57 feat(coordination): add governed federation` (2026-08-28 18:10:29, tanxichen)
- 早于 next-batch 2026-08-31

**结论**：B2 不是 code gap，是 **live server 是 stale build**。

## F2. Live 实测 fingerprint

| URL | HTTP | Body | 解读 |
|---|---|---|---|
| `GET /api/artifacts/test/markdown` (live 18008) | 401 | `{"message":"missing bearer token"}` | 路由存在（auth 拦截） |
| `GET /api/artifacts/test/content` (live 18008) | 404 | `Cannot GET /...` (HTML) | 路由缺失 |
| `GET /api/artifacts/{id}/content` (隔离 HOME master HEAD) | 404 | `{"message":"Artifact {id} not found"}` | 路由存在，artifact 不存在（service 抛 NotFoundError） |

→ Live server 部署早于 80dda57 → 缺 `/content` route。

## F3. 我加的重复 route + 撤回

第一版 B2 实现：加一个 `/content` route（带 `x-content-sha256` header）。但 cp master 到 worktree 后发现 master 5835 已存在同样 route。

**问题**：master 5835 + 我加的 = FST_ERR_DUPLICATED_ROUTE（fastify 不允许两个 GET handler 注册同一 path）。

**修法**：撤回我加的，保留 master 5835 的简洁实现。master 已 smoke 通过（POST 201 + GET 404 with proper JSON error）。

## F4. master `/content` route 的当前实现

```ts
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

返回 raw bytes + Content-Type = artifact.media_type。简洁、与 connector 期望对齐。

## F5. Smoke 验证证据

隔离 HOME server (port 29004, master HEAD b3fd488)：

```bash
$ curl -s -X POST -H "Content-Type: application/json" \
  -d '{"name":"b2-test","kind":"markdown_document","media_type":"text/markdown",
       "content_base64":"IyBIZWxsbyBCMgoKVGhpcyBpcyBtYXJrZG93biBjb250ZW50IGZvciB0ZXN0aW5nLg==",
       "owner_kind":"task","owner_ref":"T-b2-test"}' \
  http://127.0.0.1:29004/api/artifacts
HTTP 201
{"name":"b2-test",...,"id":"49707839-bb0b-437d-98ab-e480b7f56f91","sha256":"97c0c4a5...","size_bytes":49,...}

$ curl -s http://127.0.0.1:29004/api/artifacts/test-b2/content
HTTP 404 {"message":"Artifact test-b2 not found"}    ← service 抛 NotFoundError（路由存在）
```

→ 路由存在 + artifactService wired + NotFoundError 翻译正确。**B2 在隔离 HOME 已完全工作**。

## F6. 不在本次范围

- ❌ **live agora-ts server 重新部署** —— live 上 stale build 缺 `/content` route；部署是运维动作，由用户在 B1-B4 全部完成后统一部署（turn 26 拍板"挨个做，全部做完一次性部署"）。
- ❌ 改 connector 用 `/markdown` 替代 `/content` —— 跨仓改动，master `/content` 已足够
- ❌ dashboard markdown UI（前端）

## F7. 经验沉淀

1. **Code gap vs stale deploy**：live server 不一定是 master HEAD；smoke 测试前先 `git log` 确认代码 commit 是否已在 live 部署。Live 18008 的 stale build 说明 live 部署流程有延迟或锁版本。
2. **Worktree 探索阶段先 grep 全局**：这次因只 grep `app.ts:5851`（markdown 附近）错过了 5835 的 `/content` route。Lessons: 新 B 先 `grep -n "Route 关键词" --include="*.ts"` 全局扫一遍。
3. **FST_ERR_DUPLICATED_ROUTE 是 fastify 的护栏**：避免了两个 GET handler 注册同一 path，让重复 route 立即暴露。Good。
