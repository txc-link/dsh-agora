# Provider-neutral planning and runtime adapters

## Decision

Agora remains the system of record for organization, authority, Task state, policy, budgets, audit and cross-runtime coordination. Google Calendar, TickTick, OpenClaw and Hermes are adapters at the edge; none becomes a second Core or a cross-team scheduler.

```text
                              +-> Google Calendar adapter
Agora Core -> provider ports -+-> Radicale adapter
             + durable ledger +-> TickTick adapter

Agora dispatch -> DSH node extension registry
                  +-> native DSH runtime
                  +-> OpenClaw runtime
                  +-> Hermes runtime
```

## Confirmed design

1. Core depends on `CalendarProviderPort` and `ExternalTaskProviderPort`, never provider clients.
2. An opaque planning binding records the Agora Task ID plus provider/object refs. It does not store OAuth tokens.
3. Work and life remain distinct domains. A binding carries its domain and must not create a cross-domain projection implicitly.
4. OpenClaw and Hermes execute one Agora dispatch at a time. Their own local tools and short-lived delegation may run inside that dispatch, but Agora alone owns organization-wide fan-out, budgets and stop policy.
5. Runtime targets keep the compatible three-segment envelope: `dsh:<node>:openclaw/<agent>` and `dsh:<node>:hermes/<profile>`.
6. External writes are explicit service calls. Inferred preferences do not create or complete external tasks/events.
7. Credentials are composition-root configuration and are never copied into metadata, result envelopes, logs or planning bindings.
8. Planning writes are assessed by the existing `ActionRiskService`. When the assessment requires a human gate, the request must come from an authenticated Dashboard human; a bearer-only agent cannot bypass that gate.
9. Terminal state synchronization is implemented separately from projection. Its consent, monotonic mapping and conflict rules are recorded in [the bidirectional state-sync decision](../2026-09-01-planning-bidirectional-sync/README.md).

## Failure and recovery rules

- Calendar and task HTTP reads may be retried by callers only when safe.
- Provider create operations use an Agora-side durable binding to avoid intentional duplicate projection, but an ambiguous upstream timeout is reported for reconciliation instead of being blindly replayed.
- OpenClaw cancellation terminates the tracked CLI process; its gateway-backed CLI propagates the abort.
- Hermes create sends the stable Agora dispatch key as `Idempotency-Key`; a replay resolves to the original Run. Cancellation calls `POST /v1/runs/{id}/stop`.
- Runtime progress is projected into the existing dispatch progress ledger; final answers and usage use `agora.runtime-result/v1`.

## Security boundary

- Google/TickTick bearer tokens and Hermes API keys live only in process configuration.
- Personal calendar/task providers are not projected to Company Space by default.
- Work and life use separate Google calendar IDs, and an existing planning binding cannot silently change domains.
- Provider adapter tests use injected HTTP/process runners and contain no real credentials.

See [undecided.md](./undecided.md) for deferred product choices.
