# Executive intake idempotency walkthrough

## Outcome

Executive Assistant intake is now safe for PAOS and other clients to retry. A caller may send a stable `idempotency_key`; Agora persists it at the Executive Request boundary and guarantees that the same organization cannot create two requests with that key.

## Behavior

1. Core trims the request fields, normalizes capabilities, and calculates a stable SHA-256 digest over every routing-relevant field.
2. SQLite inserts the request under a unique `(organization_id, idempotency_key)` constraint.
3. The first call continues through Position routing, Task/TaskClaim/RuntimeDispatch creation, and Commitment creation.
4. An identical replay returns the existing Request and Commitment without invoking the task port.
5. Reusing the key with different normalized input returns `idempotency_conflict`; REST maps this to HTTP 409.
6. Callers that omit the key keep the original create-on-every-call behavior.

REST field: `idempotency_key`. CLI flag: `agora assistant ask ... --idempotency-key <key>`.

## Verification

- Windows focused feature and migration coverage: 29/29 tests.
- Windows CLI forwarding coverage: 1/1 test; scenario CLI budget suite: 7/7.
- Windows architecture/build checks: Lint, build, and all-workspace typecheck passed.
- Isolated Linux gate: core architecture, barrel governance, Lint, build, and all-workspace typecheck passed.
- Isolated Linux full regression: 285/286 files and 1708/1709 tests passed on the first run. The only failure was the pre-existing full scenario text test exceeding its 30-second budget after the Vitest 4.1.11 dependency refresh.
- After setting both full scenario matrix integration tests to 60 seconds, the affected Linux file passed 7/7 and the Windows file passed 7/7.

## Deployment state

The implementation is committed and verified only in isolated worktrees. No production checkout, service, configuration, credentials, or production SQLite database was changed.
