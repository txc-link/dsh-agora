# dsh-matrix-connector Roadmap (2026-08-30)

> 来源: turn 117 用户授权把 tier1/2/3 列入未来开发计划; baseline matrix main `71c01f6`.
> 详见 `02-current-state.md` 盘点, `01-roadmap.md` 完整条目.

## 1. 排期建议 (按推荐顺序)

| 轮 | 条目 | 价值 | 估计工作量 | 依赖 |
|---|---|---|---|---|
| **R-A** | T-0: thread WorkSite resolver (Phase 1 留的 stub) | ★★★★ | 半 PR / 1-2h | 无 (dsh-agora core + matrix thread metadata) |
| **R-B** | T-1: 真实 MatrixTransport (matrix-js-sdk adapter) | ★★★★★ | 1-2 PR / 4-6h | homeserver 测试实例 |
| **R-C** | T-1.5: thread ↔ Task 双向 state 投影 | ★★★★★ | 1 PR / 3-4h | R-B |
| **R-D** | T-3: matrix reply-to → agora inbox/comment | ★★★★ | 1 PR / 2-3h | R-B |
| **R-E** | T-4: matrix Space 层级 (嵌套 thread) | ★★★★ | 1-2 PR / 4-6h | R-B + Worksite resolver 支持嵌套 |
| **R-F** | T-5: edit/delete 同步到 agora artifact 修订 | ★★★ | 半 PR / 1-2h | R-B |
| **R-G** | T-7: matrix E2EE | ★★★ | 1-2 PR / 高 (crypto 复杂) | R-B + key backup 决策 |
| **R-H** | T-2: thread → WorkSite scope 治理 (P3.5-3a) | ★★★★ | 1 PR / 3-4h | T-0 |
| **R-I** | T-9: attachment / file upload | ★★ | 1 PR / 2-3h | R-B |
| **R-J** | T-8: Webhook 入站 | ★★ | 1 PR / 2-3h | R-B |
| **R-K** | T-10: app-service 模式 (非 bot 身份) | ★★ | 1 PR / 3-4h | R-B + agora model 决策 |
| **R-L** | T-11: reaction → progress markers | ★ | 半 PR / 1-2h | R-B |
| **R-M** | T-12: rate limit / retry / circuit breaker | ★ | 半 PR / 1-2h | R-B |

## 2. 关键依赖

- **R-B 是 gate**: 后续所有 T-2 ~ T-12 都依赖真实 transport. 不做 R-B, 其他都是纸上谈兵.
- **R-A 是 hygiene**: Phase 1 留的 stub 不补, WorkSite 抽象的全地址空间承诺漏一角; 与 R-H (P3.5-3a scope 接入) 直接对接.
- **R-C / R-D / R-E 互相独立但都依赖 R-B**, 可并行.

## 3. 推荐执行顺序

```
R-A (hygiene, 1-2h)
   ↓
R-B (真实 transport, 4-6h) ← 一切后续的前提
   ↓
R-C (双向 state) → R-D (reply-to) → R-E (Space) ← 并行
   ↓
R-F / R-G / R-H / R-I / R-J / R-K / R-L / R-M ← 按需
```

## 4. 与 P3.5 / agora 主线交叉

- **T-0 (R-A)** + **T-2 (R-H)** = P3.5-3a scopeAuthResolver worksite 接入的 matrix 侧基础
- **T-1 (R-B)** + **T-1.5 (R-C)** 让 P3.5 borrow/stuck 决策落地后能真正驱动 thread 行为
- **T-3 (R-D)** = matrix reply 是 agora Task 的 feedback channel, 让 IM 用户能"批注"task
- **T-4 (R-E)** = matrix Space 与 agora multi-project topology 的天然对应

## 5. 未决事项 (用户拍板状态)

| # | 问题 | 用户决定 | 影响 |
|---|---|---|---|
| 1 | 真实 homeserver 测试环境 | ✅ **服务器已有真实 homeserver** | T-1 立即可做, 无需 docker/公共账号 |
| 2 | E2EE 优先级 | ⏳ **待解释后拍板** (见 `01-roadmap.md` §T-7 解释) | T-7 + T-1 crypto 决策 |
| 3 | federation | ✅ **要支持扩展** (要做 T-6) | agora model 扩展为 multi-tenant/federated seam |
| 4 | app-service vs bot | ✅ **都要支持** (T-10 都做) | bot 默认 + app-service 留 seam |
| 5 | multi-homeserver 凭证 | ✅ **我决定 (per-project)** | 默认 per-project bridge config, 单 homeserver; multi-homeserver 通过 project-level 多 robot 配 |
| 6 | attachments storage | ✅ **S3** (T-9 用 S3) | agora artifact 用 S3 backend |

## 6. 与现有 doc 的关系

- `Doc/03-ARCHITECTURE/2026-08-30-ecosystem-design-inputs/decisions.md` §U1 (agora URI scheme) + §U2 (stuck v2.1) — 当前设计原则
- `Doc/10-WALKTHROUGH/2026-08-30-phase-3-phase-4-borrow-stuck.md` — 已实现 P3.5-1/2 走通, 真实 thread 落地依赖 R-B/R-C
- `Doc/09-PLANNING/TASKS/2026-08-30-phase-3-5-borrow-store/` — Phase 3.5 起点