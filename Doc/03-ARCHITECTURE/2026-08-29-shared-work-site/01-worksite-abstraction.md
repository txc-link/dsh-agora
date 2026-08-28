# 01: WorkSite 抽象

## 目的

把 agora 现有的 Task + matrix Thread + git Commit + sentinel Watch **统一到 1 个地址空间**, 任何 agent / 人能通过 URI 引用任何工作现场对象, 不需要"中间人转述"。

## 设计原则

- §1: WorkSite 是 Core 内的纯抽象, 不绑 IM/git/sentinel — 移除 Discord/sentinel 也不变
- §1.5: 最短实现, 不做兼容层
- 可地址: 每个工作现场对象有唯一 ID
- 可 pull: 任何 adapter 都能 fetch 这个对象, 拿到完整原始内容
- 可 ACL: 按 agora 现有 participant 权限

## WorkSite 对象类型

| type | 来源 | 内容 | 例子 |
|---|---|---|---|
| `task` | agora Task | state machine + history + participant + artifact | `agora://task/abc123` |
| `thread` | matrix room | 完整消息流 + SSE 当前事件 | `agora://thread/!room:server` |
| `commit` | git | diff + 关联 task + author | `agora://commit/d8d5fce` |
| `watch` | dsh-sentinel | 当前 state + 历史触发 + 关联 task | `agora://watch/sentinel-123` |
| `workspace` | git worktree | 当前改动 + 关联 task + branch | `agora://workspace/feat-v21` |
| `session` | DSH | 当前 turn + history + context | `agora://session/turn-456` |

## 数据结构 (草案)

```ts
interface WorkSite {
  type: 'task' | 'thread' | 'commit' | 'watch' | 'workspace' | 'session';
  id: string;            // unique within type
  uri: string;           // agora://<type>/<id>
  content: object;       // full original content (JSON-serializable)
  refs: string[];        // outgoing agora:// URIs (cross-references)
  acl: AclRef;           // participant-based, via agora central
  updated_at: ISODateTime;
}
```

## 跟 agora 现状的关系

- agora Task 表已经是 SQLite 持久化, **不需要新表** — WorkSite 是一个**视图** (computed union), 不复制数据
- `agora://task/<id>` 内容 = 现在 `GET /api/tasks/<id>` 返回值
- `agora://thread/<key>` 内容 = matrix-connector 当前 SSE buffer
- `agora://commit/<sha>` 内容 = `git show <sha>` + 关联 task 查询
- `agora://watch/<id>` 内容 = dsh-sentinel 当前 state JSONL + 历史
- `agora://workspace/<path>` 内容 = `git status` + 关联 task 查询
- `agora://session/<ref>` 内容 = DSH session 当前 context (需要 agent 自愿暴露)

## 跟 §1 的关系 — Core 内抽象 vs Adapter 投影

**Core 内**:
- WorkSite type 枚举 + 抽象接口 `resolve(uri) -> WorkSite`
- 不绑任何具体数据源
- 不绑任何具体传输协议

**Adapter 层** (每个 adapter 实现 `WorkSiteResolver`):
- agora Task adapter
- matrix Thread adapter
- git Commit adapter
- sentinel Watch adapter
- workspace Worktree adapter
- session Session adapter

**关键**:
- WorkSite 是 **Core 内抽象** (§1)
- 每个 adapter 是 **Core 外的 projection** (§1.5 不绑平台)
- 如果明天换 Discord, 只换 Thread adapter, Core 不变
- 如果明天换 code review tool, 只换 Commit adapter, Core 不变

## 实施顺序 (Phase 1 拆分)

| Step | 内容 | 谁做 |
|---|---|---|
| 1.1 | Core 内加 WorkSite type + 抽象接口 | Core 开发 |
| 1.2 | agora Task adapter (第一个, 验证模式) | Core 开发 |
| 1.3 | matrix Thread adapter | matrix-connector 开发 |
| 1.4 | git Commit adapter | workspace adapter 开发 |
| 1.5 | sentinel Watch adapter | sentinel 适配 |
| 1.6 | workspace Worktree adapter | workspace adapter 开发 |
| 1.7 | session Session adapter | session adapter |

每个 adapter 单独 shippable, 不阻塞。

## 验收

- [ ] `GET /api/worksites/agora://task/<id>` 返回完整 Task state machine + history
- [ ] `GET /api/worksites/agora://thread/<key>` 返回完整 thread 消息流
- [ ] 移除 matrix adapter 后, `agora://task/<id>` 仍 work (Core 不变)
- [ ] 移除 git adapter 后, `agora://thread/<key>` 仍 work
- [ ] 没有"中间人转述"路径 — URI 是直接 pull

## 不做的事

- 不建 SaaS Room (Tutti 的中央 Room)
- 不做多租户
- 不做实时协作 (Tutti 的实时编辑)— 我们是 pull, 不是 push
- 不做"对象版本控制" (Tutti 的版本历史) — 我们用 git 做版本