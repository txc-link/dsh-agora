# Action audit and runtime enforcement

## Objective

Make the collaboration governance contract observable at runtime without coupling Core to Matrix, Discord, OpenClaw, Hermes or another provider. Every governed operation gets a durable, append-only `ActionAttempt` and a terminal `ActionReceipt`; an attempt is admitted only when its task/plan/baseline/authority references are valid and the requested action is allowed.

## Scope

1. Add provider-neutral contracts for action attempts, receipts, admission status and failure reasons.
2. Add migration `049_action_audit.sql` and SQLite repositories with idempotent lookup and task/attempt listing.
3. Add Core `ActionAuditService` for admission, success/failure receipt recording, replay-safe idempotency and restart recovery.
4. Add REST and CLI read/write surfaces for audit records.
5. Add focused Core/DB/REST/CLI tests and update architecture/SSoT/walkthrough documentation.

## Invariants

- Attempts are immutable; receipts are append-only terminal facts.
- A governed attempt must reference one task and, when supplied, one collaboration plan and one execution baseline for that task.
- A delegation authority must be active, unexpired, scoped to the task or requested subtask, and include the requested action.
- A failed admission creates a denied attempt and a receipt; it never executes a provider side effect.
- The service records provider-neutral references only; provider adapters remain composition/runtime concerns.
- Human approval is not inferred from a payload. A `request_approval` action records the request; it does not approve it.

## Non-goals

- Rewriting every existing runtime adapter in this slice.
- Introducing provider-specific code into Core.
- Automatically allowing irreversible actions or replacing Dashboard human gates.
- Adding ActionAttempt fields that contain secrets, prompt contents or raw personal data.

## Delivery order

1. Contracts and in-memory Core service tests.
2. SQLite migration/repositories and round-trip tests.
3. REST/CLI composition and route/command tests.
4. Build, core/barrel gates, focused tests, docs, merge and push.
