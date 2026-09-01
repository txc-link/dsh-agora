# Walkthrough — B2: Markdown Artifact Route

**Date**: 2026-09-01 (Asia/Shanghai)
**Branch / Worktree**: `feat/agora-ts-markdown-artifact-route` (created then removed, no diff)
**Author**: 总工
**Status**: ✅ done — code already in master, only live redeploy pending

---

## 1. TL;DR

v0.1.1 slash smoke (turn 23) 报告 `/agora doc show <id>` → 404。初步诊断假设 backend
缺 route（B1 类似 wiring 缺失模式）。Worktree 探索发现：

**master HEAD `b3fd488` 上 `app.ts:5835` 已有 `GET /api/artifacts/:artifactId/content` route**
（由 commit `80dda57 feat(coordination): add governed federation` 2026-08-28 引入）。

B2 **不需要新 code change**。live server 18008 返 404 是 **stale build**（不包含 80dda57
之后代码），属部署问题。

## 2. 关键发现（recalibration）

| 来源 | 路径 | 状态 |
|---|---|---|
| Connector 发 (`agora-rest.ts:266`) | `GET /api/artifacts/:id/content` | 期望 raw bytes |
| Backend 提供 (`app.ts:5835`) | `GET /api/artifacts/:artifactId/content` | master 已实现 |
| **对齐** | ✅ **OK** | — |

| Live 18008 | `/api/artifacts/test/content` | **404 (route missing)** |
| 隔离 HOME master HEAD | `/api/artifacts/test/content` | 404 with `{"message":"Artifact test not found"}` (route 存在) |

→ Live 缺 route 是 **stale build**，不是 code gap。

## 3. Code 改动

**None**。master HEAD `b3fd488` 已含 route。Worktree 创建后立即发现无 diff，撤掉 worktree（无 commit 残留）。

## 4. 验证

### 4.1 TypeScript build

主工作区 `npx tsc -b tsconfig.workspace.build.json` → 0 errors ✓

### 4.2 隔离 HOME smoke (port 29004, AGORA_ARTIFACTS_DIR=/home/ailink/.agora-b2-smoke/artifacts)

```
$ POST /api/artifacts (create markdown artifact)
HTTP 201
{"id":"49707839-bb0b-437d-98ab-e480b7f56f91","sha256":"97c0c4a5...","size_bytes":49,...}

$ GET /api/artifacts/test-b2/content
HTTP 404 {"message":"Artifact test-b2 not found"}
# ↑ route 存在，service 抛 NotFoundError (被 translateError 转 404 + JSON)
```

### 4.3 接口对齐确认

- connector 发 `/content` → master 提供 `/content` → 部署后通
- `/markdown` (next-batch JSON API) 仍在 → 两个 endpoint 并存（结构化访问 vs raw bytes）

## 5. Sandbox 限制记录

- 隔离 HOME 用 `/home/ailink/.agora-b2-{smoke,skills}/`（不在 `/tmp`，避免 bwrap tmpfs reap）
- `AGORA_SKILL_TARGET_DIRS=/home/ailink/.agora-b2-skills` 避开 `/root/.agora/skills/acpx-agent-delegate` EROFS
- Server 进程在 bash 调用结束后被 reap（sandbox 行为），但 smoke 数据已采集

## 6. 部署契约

live agora-ts server 重启（用 master HEAD `b3fd488` 或更新 commit）即可获得 `/content` route：
- **无需新 env / 新配置**
- 重启后 `/agora doc show <id>` 立即可通
- 运维动作由 B1-B4 全部完成后统一执行（turn 26 用户拍板"全部做完一次性部署"）

## 7. Files Changed（本轮）

| File | 改动 |
|---|---|
| `Doc/09-PLANNING/TASKS/2026-09-01-b2-markdown-artifact-route/{task_plan,findings,progress}.md` | 新建 task_dir 三件套 |
| `Doc/10-WALKTHROUGH/2026-09-01-b2-markdown-artifact-route.md` | 本 walkthrough |
| `Doc/Agora-实施排期-Agora-TS.md` | §1 row 10 + §7 entry 回写 |
| `agora-ts/apps/server/src/app.ts` | **无 code change**（master 已含 route） |

## 8. Lessons / 后续

1. **Code gap vs stale deploy**：live server 不一定是 master HEAD。每次 backlog 调查先 `git log -S "<关键词>"` 全局扫一遍代码 + `curl` 实测 live 行为对比。
2. **FST_ERR_DUPLICATED_ROUTE 是 fastify 护栏**：让我加的重复 route 立即暴露。Good。
3. **Grep scope 教训**：B1 grep `app.ts:5851` 范围太窄错过 5835 的 `/content` route。**新 B 先 `grep -n "Route 关键词" --include="*.ts"` 全局扫**。
4. **Live server stale build 治理**：live 18008 缺 commit 80dda57 (2026-08-28) 之后的代码 —— 说明 live 部署流程有锁版本或部署延迟。**建议加 docs/11-REFERENCE/deploy-hygiene-standard.md** 规范 live 部署必须保持 master HEAD。
5. **后续 B3/B4 调查前先 grep 全局**：避免重复 B2 的"误以为 code gap"。

## 9. References

- task_dir: `Doc/09-PLANNING/TASKS/2026-09-01-b2-markdown-artifact-route/`
- SSoT: `Doc/Agora-实施排期-Agora-TS.md` §1 row 10 + §7 entry
- prior backlog source: `Doc/10-WALKTHROUGH/2026-09-01-v011-slash-command-smoke-closeout.md` §6 B1-B4
- prior B1: `Doc/10-WALKTHROUGH/2026-09-01-b1-wire-adapters-calendar.md`
- connector source: `dsh-matrix-connector/src/agora-rest.ts:266`
- backend route source: `agora-ts/apps/server/src/app.ts:5835`
- commit: `80dda57 feat(coordination): add governed federation` (2026-08-28, tanxichen)
