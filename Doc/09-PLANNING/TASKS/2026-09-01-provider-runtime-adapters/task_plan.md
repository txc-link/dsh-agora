# Provider and runtime adapters

## Goal

Make Agora use external calendars and task managers through provider-neutral ports, preserve a durable Agora Task ↔ external planning-object ledger, and let a DSH node execute governed dispatches through OpenClaw or Hermes without making either runtime an orchestrator.

## Scope

- Google Calendar read adapter alongside the existing Radicale adapter.
- TickTick Open API task adapter.
- Durable planning binding for an Agora Task, an external task and an optional calendar event.
- OpenClaw CLI runtime adapter and Hermes API-server Runs adapter in `dsh-agora-plugin`.
- Unit/integration tests, public docs, SSoT update and commits.

## Out of scope

- Deployment or server/profile modification.
- Creating OAuth applications, collecting tokens or running a live external-account smoke test.
- Automatic payment, automatic human approval or provider-specific policy in Core.
- Nested OpenClaw/Hermes swarms; Agora remains the only cross-runtime scheduler.

## Plan

1. Record the architecture decision and verify upstream protocols.
2. Add provider-neutral ports and test them before concrete adapters.
3. Add Google Calendar and TickTick adapters with injected HTTP transports.
4. Add durable planning binding migration/repository/service and API surface.
5. Add OpenClaw and Hermes runtime adapters using the existing extension SDK.
6. Run focused tests, workspace checks and plugin pack verification.
7. Update SSoT/walkthrough and commit. No deployment.

## Workspace note

The work is being done in the current checkout because the user explicitly requested a direct code change. The checkout was clean at task start; no unrelated user changes were present.
