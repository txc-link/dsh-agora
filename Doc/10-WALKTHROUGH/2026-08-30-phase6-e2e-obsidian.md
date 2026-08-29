# Walkthrough — Phase 6 E2E + S4 obsidian 沉淀

> 日期: 2026-08-30 · develop `92a56b0` + `61a3b6c`
> Planning: checklist Phase 6 / S4 段

## 1. server 全链 E2E（matrix 通道）

- 架形: 隔离 HOME + `AGORA_CONFIG_PATH`（im.provider=matrix, 真 Synapse 凭据 deploy/node-a.env）→ 一次性 server :18018（受管后台任务）
- 链路: CLI create task → outbox 行（binding.conversation_ref=真实 roomId）→ `POST /api/notifications/scan` → NotificationDispatcher → **MatrixIMMessagingAdapter**（composition matrix 分支）→ Synapse 落盘
- 结果: `{delivered:1, failed:0}`; GET /messages 回读 `Task OC-… — craftsman_completed | matrix E2E…` ✅
- 新规则（`92a56b0`）: targetRef 以 `!` 开头（roomId, conversation_ref 语义）直接发该房间; 否则 roomByRef→default

## 2. obsidian 资料沉淀分组（S4, `61a3b6c`）

- 用户语义（turn 160）: "资料沉淀分组可以用 obsidian"
- `ForumVaultWriter`: 帖子 → vault markdown; 分组 `<vault>/<base=Agora>/<project>/<category>/<date>-<slug>.md`; frontmatter（agora_id/category/author/created/project/tags）; 评论线程; `.agora-forum-index.json` 幂等; 同名冲突 -2 序号
- CLI: `agora forum export --vault <dir> [--project-id --base-folder]`
- vault = 本地文件夹, Obsidian 打开即刷新, 不依赖 REST plugin
- 冒烟: smoke db 真帖导出 tmp vault, 分组/命名/frontmatter 验证 ✅（套件 10/10）

## 3. 发现

- 存量: `apps/cli` errors.test 7 个 locale 断言（"Usage Error" vs "用法错误"）在 develop 既有失败 — 1239 基线 scope 不含 apps/cli, 非本轮回归; 修法 = 断言改 locale 无关 key 或固定 locale env（后续 hygiene 轮）
- apps/server vitest 需可写 HOME（runtime-assets 复制 skills → ~/.agora）

## 4. 剩余

- federation P3 / Discord R-G（环境）; 实机部署 + live server wiring（用户侧）; S4 mem0 token（用户）
