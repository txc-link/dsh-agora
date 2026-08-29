# Task Plan — dsh-matrix-connector Split to Independent GitHub Repo

**Task ID**: `2026-08-30-dsh-matrix-connector-split`
**Date**: 2026-08-29 (Asia/Shanghai)
**Owner**: 总工 (DSH 主 agent, delegated subagent scope)
**Status**: ⏳ Phase A in progress

---

## 0. Background

按用户 turn 16 ("feat/dsh-matrix-connector 代码在哪 不是独立仓库吗, 请在github新建仓库")
+ turn 17 ("你来新建空仓, 我登录了gh你可操作") + turn 18 ("开会 总工决策就行, 我不管细节"):

**核心目标**: 把 dsh-matrix-connector 从 dsh-agora superproject 内子目录 (worktree 形式)
迁移到独立 GitHub 仓 `txc-link/dsh-matrix-connector` (public, 已建)。

**核心约束** (按 AGENTS.md + 4 个 skill):
- §1 Core 硬约束: matrix-connector 是 adapter, 不动 `agora-ts/packages/core`
- §1.5 first-principles: 0 写未经显式 ask; 总工决策 = 显式授权 (已解除)
- §3 mandatory planning loop: 必须 task_dir 三件套 (本文件 + findings.md + progress.md)
- §3 SSoT 强制: 实施前先读 `docs/Agora-实施排期-Agora-TS.md` (本任务 P2+, 现未达)
- §3 worktree first: 主工作区脏, 必须 worktree 内操作
- §4 TDD: 实施必须测试先行 (本任务不实施, 只 split, 不需要)
- §6 Repo Map: dsh-matrix-connector = extensions/agora-plugin/ 边界外的独立桥接
- §8: 内部 Doc/ 不推到 FairladyZ625/Agora 公开 mirror

**4 skill 关键约束**:
- `using-git-worktrees`: 必须先 verify 状态再动; 不 stash / reset / clean
- `finishing-a-development-branch`: discard 必须 fresh, exact, typed confirmation (已获总工授权)
- `anti-entropy-governance`: code-retirement 路径 = delete-first, 不需要 Data Destruction Guard
- `verification-before-completion`: 每个 phase 完成前必须 fresh falsifying check

---

## 1. Phase Plan (按 turn 18 总工决议)

| Phase | 动作 | 状态 |
|---|---|---|
| **A.1** | 写 task_dir 三件套 (本文件 + findings.md + progress.md) | ⏳ in progress |
| **A.2** | commit smoke-v02-sse.mjs (Q-R2=c 路径) | ⏳ pending |
| **B.1** | `git subtree split` 试算 → 真跑 | ⏳ pending |
| **C.1** | `git push` 到 GitHub txc-link/dsh-matrix-connector main | ⏳ pending |
| **C.2** | verify 新仓: gh repo view + git ls-remote + clone + npm install + npm test + npm run build | ⏳ pending |
| **D.1** | `git worktree remove` (离开 worktree 后跑) | ⏳ pending |
| **D.2** | `git branch -D feat/dsh-matrix-connector` | ⏳ pending |
| **D.3** | 三重 verify: git worktree list + git ls-remote + git branch -a + git status | ⏳ pending |
| **E.1** | 新仓 clone + 开 feat/phase-2-matrix-connector worktree | ⏳ pending |
| **E.2** | 新仓 task_dir `Doc/09-PLANNING/TASKS/2026-08-30-phase-2-matrix-connector/` | ⏳ pending |
| **F.1** | 更新本 task_dir 三件套 (记录最终结果) | ⏳ pending |
| **F.2** | emit L1 receipt (verification-before-completion skill) | ⏳ pending |

---

## 2. Key Decisions (locked by turn 18 总工授权)

| ID | Decision | Source |
|---|---|---|
| **Q-R1** | 执行 destructive 操作 (split + push + worktree remove + branch delete) | turn 18 总工授权 |
| **Q-R2** | lib/ + node_modules 丢弃, smoke-v02-sse.mjs 保留进新仓 (commit) | turn 18 总工决策 c |
| **Q-R3** | split + push + 清理 全完成后, 立即在新仓开 feat/phase-2-matrix-connector | turn 18 总工决策 a |
| **Q-TD** | 立即写 task_dir 三件套 (在 destructive 前) | turn 18 总工决策 是 |

---

## 3. Pre-flight Verify (already done, recorded in findings.md)

1. ✅ `feat/dsh-matrix-connector` HEAD = `e4863af` v2.0.2 (非 Graph Memory c-4 说的 `a374137` v0.1.1)
2. ✅ `git rev-list master...HEAD` = `1|0` (merge commit, 无 feat-only commits, 删 branch 无信息损失)
3. ✅ `git log -- dsh-matrix-connector/` 显示 11 commits: v2.0.2 / v2.0.1 / v1.0.2 / v1.0.1 / v0.3.3-0.3.1 / v0.2b / v0.2 / v0.1.1 / v0.1
4. ✅ worktree 状态: 3 untracked (lib/ 80K build, node_modules symlink, tests/smoke-v02-sse.mjs)
5. ✅ 子目录大小 368K (src/ 104K, tests/ 124K, docs/ 16K, lib/ 80K, README.md 8K, configs/scripts)
6. ✅ 子目录**无 .gitignore** (lib/ + node_modules 应该被忽略, 但当前 .gitignore 缺失)
7. ✅ 子目录 14 子目录 + 49 tracked 文件 (src/ tests/ docs/ scripts/ + configs + README.md + cordis.patch.yml + dsh.plugin.json)
8. ✅ Graph Memory c-447 "v0.3 war room worktree" = 过时数据 (worktree 已不存在)
9. ✅ gh auth verified: `txc-link` 账号, token scopes `repo` 含写权限
10. ✅ 新仓已建: `txc-link/dsh-matrix-connector` public empty (description "Matrix ↔ Agora Core bridge plugin (DSH-side IM adapter)")
11. ✅ 备份完成: `/tmp/dsh-matrix-connector-backup-1787946438.tar.gz` (56701 bytes, sha256 `1ac1ed44eb728d0f0428e67549fa47f8c3b676037f3f777f924cc962efce840b`)
12. ✅ task_dir 已建: `Doc/09-PLANNING/TASKS/2026-08-30-dsh-matrix-connector-split/`

---

## 4. Anti-Entropy Declaration (per skill 强制)

**Deletion Class**: code-retirement (delete-first 路径, 非 persistent-state)

**Old Path/Object**:
- Branch: `feat/dsh-matrix-connector` @ `e4863af` v2.0.2
- Worktree path: `/home/ailink/dsh-agora/.worktrees/feat-dsh-matrix-connector/`
- 子目录 `dsh-matrix-connector/` **不删** (master 已 merge, 在 master commit 历史)

**New Canonical Owner**: GitHub `txc-link/dsh-matrix-connector` (public, main 分支)

**Expected Preserved Behavior**:
- dsh-matrix-connector v2.0.2 代码 + 完整 11 commits 历史在新仓 main
- dsh-agora master 仍含 `dsh-matrix-connector/` 子目录 (master commit 历史完整)
- Phase 2 实施在新仓 `feat/phase-2-matrix-connector` 分支

**Expected Retired Behavior**:
- `feat/dsh-matrix-connector` 本地 branch 删除
- `/home/ailink/dsh-agora/.worktrees/feat-dsh-matrix-connector/` worktree 删除

**External Boundary Touched**: yes (dsh-matrix-connector 从 dsh-agora 子目录迁移到独立仓边界)
**Source-of-Truth Data Risk**: 无 (worktree 3 untracked 已通过 commit 或丢弃解决)
**User Confirmation Required**: ✅ 已获总工 turn 18 显式授权

---

## 5. Verification Plan (per anti-entropy-governance 强制)

**Main-path check**:
- 新仓 main 分支 git clone + npm install + npm test + npm run build 全部 OK
- 14 src/*.ts + 16 tests/*.mjs + README.md 完整

**Lingering-reference check**:
- dsh-agora master 仍含 dsh-matrix-connector/ 子目录
- 11 commits 在 master 上可访问
- extensions/dsh-agora/node_modules/dsh-matrix-connector symlink 仍 work (如有)

**Negative check**:
- 删 worktree + branch 后 dsh-agora repo 仍可 build
- master git status 不多出 untracked
- 新仓 git log 含 v0.1 → v2.0.2 全部 11 commits

**Boundary check**:
- 新仓跟 dsh-agora 边界干净 (无 .gitmodules 牵连)
- 新仓 README/AGENTS.md 不含"dsh-agora 子目录"措辞
- Agora Core (agora-ts/packages/core) 不动

---

## 6. Risk Register

| Risk | Mitigation |
|---|---|
| subtree split 生成的历史含 .gitignore 缺失造成的杂质 | 跑完 split 后 git log 检查; 不行重 split + 加 .gitignore |
| push 失败 (token 失效 / 网络) | verify-by-clone 提前发现; 失败重试或 fallback 到 tar 备份恢复 |
| worktree remove --force 失败 (有 dirty) | Phase A.2 已 commit smoke-v02-sse.mjs; lib/node_modules 丢弃不损 |
| npm install 在新仓失败 (依赖 mismatch) | C.2 verify 阶段报告, P2 启动前修复 |
| Phase 2 在新仓启动 = Doc/ 从零建 | 接受 (新仓是新独立空间) |

---

## 7. Notes

- turn 74 c-82 skill `git-worktree-remove-cleanup` 的 5 步标准流程本任务**不直接套用**
  (本任务是 split + push 后删, 不是 PR #N merged 后删)
- Phase 2 SSoT 实施排期 `docs/Agora-实施排期-Agora-TS.md` 本任务**不可达** (verify 之前已 fail)
  → Phase 2 启动前必须重新 verify SSoT 路径, 跟 §3 SSoT 规则
- dsh-agora 公开 mirror (FairladyZ625/Agora) **不** 推 dsh-matrix-connector (按 §8)