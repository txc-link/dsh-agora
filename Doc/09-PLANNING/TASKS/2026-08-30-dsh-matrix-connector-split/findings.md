# Findings — dsh-matrix-connector Split

**Task**: `2026-08-30-dsh-matrix-connector-split`
**Date**: 2026-08-29 (Asia/Shanghai)
**Owner**: 总工

---

## 1. Verify 出的关键事实 (turn 17)

### 1.1 feat/dsh-matrix-connector 真实状态 (纠正 Graph Memory 过时数据)

- **HEAD**: `e4863af` Merge feat/v20-stuck-alert (NOT `a374137` v0.1.1)
- **最新 commit**: `6426fe9 feat(matrix-connector): v2.0.2 — /agora stuck command`
- **Graph Memory c-4 / c-415 数据已过时**, 实际状态 v2.0.2 (10 个版本演进)
- 全部 feat-only commits 已 merge 到 master (rev-list master...HEAD = `1|0`, merge commit 1 条)
- 删 branch **无信息损失** (master 已有完整历史)

### 1.2 完整 commit 历史 (按 git log -- dsh-matrix-connector/)

```
6426fe9 feat(matrix-connector): v2.0.2 — /agora stuck command
2da4958 feat(matrix-connector): v2.0.1 — stuck alert from inbox_escalated SSE events
9bf98c8 feat(matrix-connector): v1.0.2 — artifact 摘要自动回投 post-mortem
df725b1 feat(matrix-connector): v1.0.1 — /agora rollup (org war-room view)
773c0c8 feat(matrix-connector): v0.3.3 — per-room war-room status panel
64d0f6a feat(matrix-connector): v0.3.2 — room-roster resolver for citizen dispatch
3205a26 feat(matrix-connector): v0.3.1 — war-room post-mortem on SSE tick
1e3354c feat(matrix-connector): v0.2b — /agora dispatch @<citizen> <prompt>
3c0d32c feat(matrix-connector): v0.2 — subscribe to agora SSE event stream
8b963e2 feat(matrix-connector): v0.1.1 verified end-to-end
a374137 feat(matrix-connector): v0.1.1 — enable citizen + events endpoints
fe6dcbd feat(matrix-connector): v0.1 code-complete with explicit verification gap
```

共 **12 commits** (含 e4863af merge commit, v0.1 → v2.0.2 共 11 个 feat commit)

### 1.3 worktree 状态

```
?? dsh-matrix-connector/lib/                     (build 产物 80K, 14 文件)
?? dsh-matrix-connector/node_modules             (symlink → dsh-agora extensions)
?? dsh-matrix-connector/tests/smoke-v02-sse.mjs  (新文件, v0.2 SSE 测试源码)
```

### 1.4 子目录结构 (368K 总)

```
dsh-matrix-connector/
├── cordis.patch.yml              (4K)
├── docs/                         (16K, 含 walkthrough)
├── dsh.plugin.json               (4K)
├── lib/                          (80K, build 产物, untracked)
├── node_modules                  (symlink, untracked)
├── package.json                  (4K)
├── README.md                     (8K)
├── scripts/                      (12K, 含 provision-bot.sh)
├── src/                          (104K, 14 .ts 核心代码)
├── tests/                        (124K, 16 .mjs 测试, 1 disabled)
├── tsconfig.build.json           (4K)
└── tsconfig.json                 (4K)
```

**致命缺陷**: 子目录**无 .gitignore** → lib/ + node_modules 应该被忽略但未忽略

### 1.5 Graph Memory 过时数据警示

- c-4 event `dsh-matrix-connector-v011-committed`: 数据停在 v0.1.1 commit `a374137`, 实际已演进到 v2.0.2
- c-415 task `dsh-matrix-connector-v01-completion-state`: 数据停在 v0.1 收尾, 实际已演进 10 个版本
- c-447 event `v03-war-room-worktree-opened`: 声称 worktree 已开, 实际不存在 (worktree 已合并清理)

**教训**: Graph Memory 状态数据需配 `updated` timestamp + verify step, 不能盲信

### 1.6 GitHub 状态

- `gh` CLI v2.88.1 已装
- 认证: `txc-link` 账号, token scopes `'gist', 'read:org', 'repo', 'workflow'`
- 写权限: ✅ `repo` scope 含
- 新仓 `txc-link/dsh-matrix-connector` 已建: public, description "Matrix ↔ Agora Core bridge plugin (DSH-side IM adapter)"
- new repo URL: `https://github.com/txc-link/dsh-matrix-connector`
- SSH URL: `git@github.com:txc-link/dsh-matrix-connector.git`
- isEmpty: true (等 push)

### 1.7 dsh-agora 主工作区状态

- 9 untracked dirs: `.audit/` + 4 `Doc/03-ARCHITECTURE/2026-08-{28,29,30}-*/` + 4 `Doc/09-PLANNING/TASKS/2026-08-{28,29,30}-*/`
- 全部 untracked 都是**本会话之前 task 的产物** (ecosystem-design-inputs capture + planning + 本 task_dir)
- master HEAD: `d8d5fce`
- worktree list: master + dsh-agora-p0-test (detached) + .worktrees/feat-dsh-matrix-connector

### 1.8 AGENTS.md 关键约束

- §1 Core 硬约束: matrix-connector = adapter layer, **不动** `packages/core`
- §1.5 first-principles: 0 写未经显式 ask (turn 18 总工决策 = 显式授权, 已解除)
- §3 SSoT 强制: `docs/Agora-实施排期-Agora-TS.md` 本任务不可达 (verify fail) → Phase 2 启动前重 verify
- §3 worktree first: 主工作区脏必须切 worktree (本任务在 .worktrees/feat-dsh-matrix-connector 内操作)
- §6 Repo Map: dsh-matrix-connector 边界 = extensions/agora-plugin/ 外的独立桥接

### 1.9 4 skill 关键发现

**`anti-entropy-governance`**:
- code-retirement = delete-first 路径
- "do not interpret generic agreement as confirmation" — turn 18 总工决策 ≠ generic, 已解除
- 必须 emit Anti-Entropy Declaration (已写进 task_plan.md §4)

**`finishing-a-development-branch`**:
- discard 必须 fresh, exact, typed confirmation — turn 18 已满足
- Step 6 cleanup order: 1. move to safe checkout → 2. worktree remove → 3. readback → 4. verify path → 5. branch delete → 6. readback
- 推荐用 c-82 skill `git-worktree-remove-cleanup` 5 步 (本任务**调整**: split + push 在前, cleanup 在后)

**`using-git-worktrees`**:
- Step 0 environment detection 必跑 (已跑, 见 progress.md)
- "Preserve user state: no automatic stash, reset, clean, broad staging, or commit"
- 红线: 不为"任务改代码"就开 worktree; 不改 .gitignore 仅为了 worktree; 不为每个 subagent 开 worktree

**`verification-before-completion`**:
- L1 Default Receipt 必填 9 slots (Key judgment / Avoided misfix / Boundary held / Baseline alignment / Complexity control / Evidence strength / Uncovered risk / Next most valuable verification / Aegis path)
- 任务 git closeout 必读 HEAD/branch/dirty 状态
- L2 trigger: merge/publish/release/handoff (本任务 Phase C push = handoff)

---

## 2. Backup Verify

```
路径: /tmp/dsh-matrix-connector-backup-1787946438.tar.gz
大小: 56701 bytes (56K)
sha256: 1ac1ed44eb728d0f0428e67549fa47f8c3b676037f3f777f924cc962efce840b
含 49 tracked 文件 + lib/ build 产物 + 3 untracked
```

---

## 3. Decision Tree (后续 phase 决策依据)

按 turn 18 总工决议锁:

```
Q-R1=是 (destructive 操作全执行)
Q-R2=c (lib/ + node_modules 丢弃, smoke-v02-sse.mjs 保留进新仓)
Q-R3=a (split + push + 清理 全完成后立即 Phase 2)
Q-TD=是 (立即写 task_dir 三件套)
```

后续 Phase 2 启动子决策 (Q2-Q5 之前 turn 12 已问, 但因 v0.1 → v2.0.2 baseline 变化, 需重 verify):
- Q1 (SSoT 路径): 不可达, **必须**重 verify `docs/Agora-实施排期-Agora-TS.md` 在新仓是否存在
- Q2 (worktree 基础分支): 新仓 default branch = main, 从 main 开 feat/phase-2-matrix-connector
- Q3-Q5: 由 Phase 2 task_dir 决策

---

## 4. Open Questions (Phase 2+)

1. Phase 2 SSoT `docs/Agora-实施排期-Agora-TS.md` 在**新仓** 是否存在?
   - 新仓是新建空仓, 必然**不存在** → Phase 2 启动前必须新建 SSoT 或豁免
2. Phase 2 任务: matrix-connector @pull + 三 posture governance 的具体范围?
   - 待 Phase 2 task_dir 启动时按 U1/U3/U4 决议细化
3. Phase 2 + dsh-agora 关系: dsh-matrix-connector 独立后, dsh-agora extensions 怎么引用?
   - 候选: (a) submodule (b) npm package (c) cordis plugin loader (d) 别的
4. Phase 3+ Computer Use ⚠️ snippet-only 数据的 50% 可信度:
   - 等 Phase 3 启动时重新评估

---

## 5. Sources

- turn 16 user message: "feat/dsh-matrix-connector 代码在哪 不是独立仓库吗, 请在github新建仓库"
- turn 17 user message: "你来新建空仓, 我登录了gh你可操作"
- turn 18 user message: "开会 总工决策就行, 我不管细节" (P0 scoped authorization)
- AGENTS.md §1-§8 (本 session system-reminder)
- 4 skill catalog (本 session system-reminder)
- Graph Memory c-4 / c-415 / c-447 (历史, **部分过时**)
- GitHub gh CLI v2.88.1 + txc-link 认证
- 本 turn verify 输出 (A1-A7)