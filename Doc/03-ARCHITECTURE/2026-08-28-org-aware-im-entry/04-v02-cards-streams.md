# 04 — v0.2 范围：matrix 房间 = agora 上下文投影屏

## 1. 一句话定义

v0.2 让 matrix 房间不仅能"看到 / 触发" Core 能力，还能把 agora 的上下文 / 知识 / 资源以 **卡片** 和 **流** 形式可视化投影到房间。

## 2. v0.2 能力清单（v0.1 基础上增量）

### 2.1 卡片（matrix card v1）

matrix v1.1+ 支持 `format: 'org.matrix.custom.html'` + 自定义 widget / interactive card。v0.2 启用 `format: 'card.v1'`，由 agora 中央 result envelope 携带结构化 payload。

| 场景 | 卡片内容 |
|---|---|
| task 完成 | 标题 + 描述 + 工件链接 + duration + usage |
| brain 检索 top 3 | kind / slug / score / excerpt |
| artifact 上传 | 缩略图 / metadata / owner_kind / size |
| inbox 通知 | 通知类型 / 来源 / 触发时间 / 操作按钮（v1.0 才接 callback） |

### 2.2 context 流（订阅）

| 流 | 含义 | matrix 房间表现 |
|---|---|---|
| `task_state_changed` | task 状态变化 | 占位消息编辑 |
| `artifact_created` | artifact 创建 | 房间自动发消息（卡片） |
| `inbox_new` | 收件箱新通知 | 房间发消息 |
| `coord_run_progress` | coordination run 进度 | 房间发消息 |

### 2.3 工件上传 mxc 预览

- v0.1：artifact 只显示文字 + 下载链接
- v0.2：调 `/api/artifacts/:id/content` → mxc 上传 → 房间显示缩略图

### 2.4 inbox 通知桥

- v0.2：人类在 Element 房间能看见自己的 inbox
- `/agora inbox list` → 显示 inbox 通知列表
- `/agora inbox <id>` → 显示通知详情

### 2.5 room 主题/描述同步

- agora project 名字变更 → 自动同步到 matrix room topic
- agora project 描述变更 → 自动同步到 matrix room topic

## 3. 卡片协议（card.v1）草案

```ts
// agora 中央 result envelope
type CardV1 = {
  format: 'card.v1';
  title: string;
  fields: Array<{ label: string; value: string; emphasis?: 'muted'|'strong'|'danger' }>;
  actions?: Array<{ id: string; label: string; kind: 'link'|'button'; href?: string }>;
  footer?: { metadata?: Record<string, string> };
};
```

dsh-matrix-connector 收到 card.v1 payload → 渲染为 matrix HTML（org.matrix.custom.html）：

```html
<div class="agora-card">
  <h3>${title}</h3>
  <table>
    ${fields.map(f => `<tr><td>${f.label}</td><td>${f.value}</td></tr>`).join('')}
  </table>
  ${actions?.map(a => `<a href="${a.href}">${a.label}</a>`).join(' ') ?? ''}
</div>
```

## 4. 数据流（v0.2 增量）

```
agora 中央事件流
  ├─ task_state_changed → edit 占位
  ├─ artifact_created → 房间发卡片
  ├─ inbox_new → 房间发通知
  └─ coord_run_progress → 房间发进度

dsh-matrix-connector 收到事件
  → 查 thread registry → 找到对应房间
  → 解析 envelope.format
    ├─ 'text' / 'html' → text 路径
    └─ 'card.v1' → 卡片路径（v0.2）
```

## 5. v0.2 严格不做

| 不做 | 推到 |
|---|---|
| matrix widget / interactive button callback | v1.0 |
| multi-bot in same room | v1.0 |
| A2A message in room | v1.0 |
| host resource 实时面板 | v1.0 |
| merge proposal 审批 | v1.0 |
| voice / STT / E2EE | 远期 / 不做 |

## 6. v0.2 工作量估算

| 任务 | 工作日 |
|---|---|
| 卡片渲染器（HTML + 字段 + actions） | 3 |
| context 流订阅（4 类事件） | 3 |
| artifact mxc 上传 + 预览 | 2 |
| inbox 桥 | 1 |
| room topic 同步 | 0.5 |
| 单测 + smoke | 3 |
| README + walkthrough | 1.5 |
| 总计 | **14 工作日 ≈ 8 周（v0.1 之后）** |

## 7. v0.2 验收

1. 卡片协议 schema 在 contracts 包落地
2. dsh-matrix-connector 渲染器单测全绿
3. smoke-matrix 跑过 artifact_created / inbox_new 事件
4. README 含 "card.v1 使用说明"

## 8. v0.2 → v1.0 边界

v0.2 交付时，再评审是否进入 v1.0 多 agent 协同 / attention routing / merge proposal 流程。

---

**v0.2 暂未详细讨论，本节为 outline**，完整设计在 v0.1 跑通后启动（避免过早设计）。