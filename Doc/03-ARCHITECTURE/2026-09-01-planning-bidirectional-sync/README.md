# Planning bidirectional state sync

## Decision

Agora remains authoritative for organization, execution and policy. Provider state may advance an already-bound Task to a compatible terminal state; it may not rewrite workflow topology or reopen a terminal task.

| Agora | External task | Calendar event | Reconciliation |
|---|---|---|---|
| non-terminal | completed | scheduled | advance Agora to `done` when transition is valid |
| non-terminal | open | cancelled | advance Agora to `cancelled` when transition is valid |
| `done` | open | scheduled | complete the external task; keep the event scheduled |
| `cancelled` | open | scheduled | delete the external task and cancel the event |
| `done` | any | cancelled | conflict; no mutation |
| `cancelled` | completed | any | conflict; no mutation |
| non-terminal | completed | cancelled | conflict; no mutation |

`done` intentionally does not cancel a calendar event: attendance and task completion are different semantics. Google event cancellation does represent abandonment of the linked plan and therefore maps to Agora cancellation.

## Consent boundary

- A binding stores `manual` or `bidirectional` sync mode.
- migration 046 marks all existing bindings `manual`.
- enabling `bidirectional` is a governed external-side-effect action and requires an authenticated Dashboard human.
- manual and scheduled sync only execute writes for a binding already carrying that consent.
- credentials remain adapter configuration and never enter the sync ledger.

## Conflict and recovery

- All provider states are read before any mutation.
- Contradictory terminal states persist `conflict` plus a safe error summary.
- Provider/transport errors persist `failed`; the next tick retries from current durable state.
- Successful monotonic operations are naturally idempotent: completed/deleted/cancelled states are observed before writes.
- No last-writer-wins policy is used for terminal disagreement.

## Polling

`PLANNING_SYNC_INTERVAL_MS` enables a single non-overlapping server poller. Zero or omission disables background polling; REST and CLI manual sync remain available. Google collection sync tokens and push channels are deferred until bound-object polling becomes a measured scalability problem.
