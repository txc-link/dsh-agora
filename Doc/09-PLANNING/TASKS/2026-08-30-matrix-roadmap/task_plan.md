# Task: matrix 平台未来开发计划 (2026-08-30)

## 1. 目标

把 dsh-matrix-connector 仓尚未实现的功能盘点成正式 roadmap, 让"接下来做什么"有据可循. 用户指令 (turn 117): "先做 tier1 tier2 和tier3列入未来开发计划".

## 2. 范围

### 必须
1. `Doc/03-ARCHITECTURE/2026-08-30-matrix-roadmap/01-roadmap.md` — 完整 Tier 0/1/2/3 列表 (目标 + 价值 + 成本 + 依赖 + 未决事项)
2. `Doc/03-ARCHITECTURE/2026-08-30-matrix-roadmap/02-current-state.md` — matrix 仓当前 baseline 盘点
3. `Doc/03-ARCHITECTURE/2026-08-30-matrix-roadmap/README.md` — 索引 + 排期建议

### 不做
- ❌ 任何代码改动
- ❌ P3.5-3 (kill switch) — 单独 task_dir
- ❌ 真实 transport 实现 — 等用户从 roadmap 选条目后再开 task_dir

## 3. 来源

- turn 117 用户授权
- turn 116 盘点基础: matrix main `71c01f6` 含 #1 #2 PR, stub transport 未实现

## 4. worktree

不需要 (§3 例外条款: 纯文档小修).

## 5. 验证

- 文档写入 + commit
- README 与两个子文档可读