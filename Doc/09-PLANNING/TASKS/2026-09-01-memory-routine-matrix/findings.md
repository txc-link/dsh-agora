# Findings

- `GroupMemoryService` 已存在，但只有 `record/recall/list`，没有从任务上下文生成摘要的统一入口。
- `MemoryService` 的 SQLite ledger 与 `GroupMemoryPort` 是两套职责：本阶段摘要写入群组记忆端口，摘要产物本身不绑定 Mem0。
- `RelationshipProfileService` 已提供不可变人格/关系版本；`RelationshipInitiativeService` 已提供带 quiet-hours、每日上限、lease 的主动投递 outbox。通用例行应复用这些安全语义，不复制一套 companion-only 状态机。
- Matrix connector 已有 task status panel、post-mortem、stuck alert，但 `/agora task` 只能显示简短状态，房间里缺少协同上下文/下一步动作聚合；这些属于 adapter 投影，不进入 Core。
- 任务完成状态由 `TaskRepository.listTasks('done')` 等读取，server 已有后台 observation scheduler，可作为自动摘要扫描触发点。
