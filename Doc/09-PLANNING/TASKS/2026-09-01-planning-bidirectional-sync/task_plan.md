# Planning bidirectional state sync

## Goal

Keep terminal state consistent across an Agora Task, its bound external task, and its bound calendar event without turning Google or TickTick into the system of record.

## Scope

- External task state: `open | completed | deleted`.
- Calendar event state: `scheduled | cancelled`.
- Monotonic propagation between provider state and Agora `done | cancelled`.
- Durable sync consent, last outcome, error and timestamp.
- Conflict detection before mutation when providers or terminal states disagree.
- Manual REST/CLI sync and optional interval polling.
- Google Calendar and TickTick implementations, tests, docs and SSoT update.

## Out of scope

- Bidirectional title, description, due-time or attendee editing.
- Reopening terminal Agora tasks or completed TickTick tasks.
- Google push notification channels/webhooks; polling is the first delivery mechanism.
- Deployment, OAuth setup or live-account smoke testing.

## Plan

1. [x] Lock state mappings, consent and conflict rules.
2. [x] Write failing adapter and reconciliation tests.
3. [x] Extend provider-neutral ports and concrete adapters.
4. [x] Add migration 046 and sync-aware repository/service methods.
5. [x] Wire REST, CLI and an opt-in polling scheduler.
6. [x] Run focused regression, build, lint and architecture gates.
7. [x] Update walkthrough and SSoT; leave deployment and commit decisions to the user.

## Workspace note

The work continues in the current checkout because the user requested a direct implementation. The tree was clean at task start (`defd859`).

## Result

Code complete and not deployed. Focused regression is 21/21; workspace build, relevant workspace typechecks, architecture gates and changed-source lint pass. Full historical typecheck/test suites retain pre-existing failures documented in `progress.md`.
