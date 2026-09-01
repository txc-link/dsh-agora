# Findings

- 现有 `ActionAuditService` 已提供 admission/receipt append-only journal，因此 envelope 只负责解析并携带治理引用，不复制审计逻辑。
- `RuntimeNodeRegistryService` 是 Core 到 provider-neutral runtime node 的边界；strict mode 放在这里能覆盖 server、CLI 和未来 adapter，而不触碰 provider 源码。
- Task recovery scheduler 已经会 probe inactive task；本阶段新增只读 timeline 与可审计的 claim takeover，不另造第二套 scheduler。
- Artifact metadata 已是 JSON 扩展点，无需 migration 即可表达 parent、version、diff 和 review 状态。
- Windows 全量 server app 测试仍受既有 SQLite 临时目录清理 `EPERM` 干扰；本阶段的 Core/DB 聚焦测试不受影响。
