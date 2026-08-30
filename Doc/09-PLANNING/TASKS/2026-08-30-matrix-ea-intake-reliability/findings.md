# Findings

## Live evidence

- `/agora im health` returned `health: ok` in 592 ms.
- `/agora assistant inbox` and `/agora company show` both returned successfully.
- The full research request was persisted by Matrix but produced no bot receipt and no Core request.
- A short assistant request reached Core but was blocked with `Project not found: node-home-linux`.
- The live Core has no Project records; prior successful organization requests use `projectId: null`.
- After the fixes, request `d00d30bb-a56a-4aca-bc99-baf7a71d3a0d` completed through task `OC-1788084614467` on `node-mac`; its commitment was fulfilled and an executive-deliverable artifact was created.
- The live result contained credential-shaped data copied from runtime memory. This exposed a missing output-DLP boundary: information-domain routing constrained the task prompt, but did not sanitize the runtime completion before persistence.
- Connector `0.3.3` makes ordinary room conversation inert and reserves execution for an explicit `/agora` prefix.
- Connector `0.3.4` resolves task artifacts through the durable Artifact collection; `0.3.5` sends downloads as standard Matrix `m.file` events.
- The original `AI学习` room had E2EE enabled and no Company Space parent. The Node connector deliberately has no durable crypto store, so it could neither decrypt commands nor send replies there.
- Production exposed two Space discovery defects: plugin composition read the SDK room cache before initial sync, and the child-state listener was attached to `Room` instead of `Room.currentState`. Connector `0.3.6` fixes both and passes 236 tests.
- Request `57f9b246-4ac1-4659-bedc-b4fc04f46cc6` completed through task `OC-1788087729753` on `node-mac` in about 29 seconds and produced artifact `441f2302-18f3-40d2-a2e5-5a227a5990a5` (Markdown, 6,434 bytes).
- Final live matrix: three Core runtime nodes online; one expected bot reply in each tested operational room; zero company bots in all Personal Life, Health, and Companion rooms.

## Root causes

1. The connector sets `ExecutiveAssistantBridge.defaultProjectId` to `config.nodeId`, coupling the runtime node identity to the optional Core Project identity.
2. The public REST schema uses `z.string().datetime()` for `due_at`, which rejects the explicit `+08:00` offset used by the Matrix command example.
3. Timeline command failures are logged but not sent back to Matrix, so REST validation errors look like a dead bot.
4. Runtime result envelopes and generated artifacts were persisted verbatim, allowing secrets present in an agent's retrieved context to escape into task evidence.
5. Matrix E2EE is immutable per room and the connector intentionally disables ephemeral Node crypto; an encrypted operations room therefore cannot be repaired in place.
6. Space discovery ran before the first Matrix sync and subscribed to the wrong event emitter, so newly linked child rooms required a static allow-list entry or restart.

## Architecture boundary

- Organization remains independent of Project.
- A connector node id identifies a runtime node, not a Core project.
- Offset acceptance belongs to the REST entry adapter; Core continues to consume a valid provider-neutral datetime string.
- Information-domain authorization and output DLP are separate controls. Runtime completion data must be recursively sanitized before it enters dispatch history, progress logs, delivery payloads, or artifacts.
- Company automation rooms must be unencrypted until a durable Matrix crypto store and recovery procedure pass their gate. Personal/Health/Companion remain separate top-level security projections, not Company Space departments.
- The Central Assistant is the only bot in normal Company rooms. Node-specific rooms remain available for direct health diagnostics without creating multi-bot replies in daily work.
