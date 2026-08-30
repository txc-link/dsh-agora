# Findings

## Live evidence

- `/agora im health` returned `health: ok` in 592 ms.
- `/agora assistant inbox` and `/agora company show` both returned successfully.
- The full research request was persisted by Matrix but produced no bot receipt and no Core request.
- A short assistant request reached Core but was blocked with `Project not found: node-home-linux`.
- The live Core has no Project records; prior successful organization requests use `projectId: null`.

## Root causes

1. The connector sets `ExecutiveAssistantBridge.defaultProjectId` to `config.nodeId`, coupling the runtime node identity to the optional Core Project identity.
2. The public REST schema uses `z.string().datetime()` for `due_at`, which rejects the explicit `+08:00` offset used by the Matrix command example.
3. Timeline command failures are logged but not sent back to Matrix, so REST validation errors look like a dead bot.

## Architecture boundary

- Organization remains independent of Project.
- A connector node id identifies a runtime node, not a Core project.
- Offset acceptance belongs to the REST entry adapter; Core continues to consume a valid provider-neutral datetime string.

