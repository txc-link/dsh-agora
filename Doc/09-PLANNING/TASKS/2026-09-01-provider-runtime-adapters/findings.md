# Findings

- `CalendarService` imported the concrete `RadicaleClient`, which violated the documented provider-neutral Core boundary.
- `dsh-agora-plugin` already exposes `dsh-agora.runtime/v1`, explicit `supportsTarget`, deterministic Agent discovery, cancellation and extension trust checks. New runtimes belong there.
- OpenClaw's supported script path is `openclaw agent` with `--agent`, `--session-key`, `--message-file` and `--json`; a process signal aborts the gateway-backed turn.
- Hermes' current daemon-facing entry point is `hermes gateway`/API server, not a `hermesd` executable. Its Runs API supports create, poll, events, approvals and stop.
- Hermes Runs durably reserves `Idempotency-Key` values. The adapter derives that header from Agora's stable dispatch key so a worker retry reattaches to the original Run rather than creating a duplicate.
- TickTick documents bearer/OAuth authentication and task create/update/complete endpoints under `https://api.ticktick.com/open/v1`.
- Existing task/thread bindings provide the repository/service pattern for an opaque provider reference ledger.
