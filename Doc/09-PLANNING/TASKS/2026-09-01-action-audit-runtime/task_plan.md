# Runtime dispatch audit instrumentation

## Objective

Turn the provider-neutral ActionAttempt/ActionReceipt contract into an actual runtime boundary for DSH dispatches while preserving compatibility for legacy ungoverned callers.

## Scope

1. Define the serialized `metadata.action_audit` context and the admission-to-dispatch correlation field.
2. Wire `RuntimeNodeRegistryService.createDispatch` to admit governed dispatches before persistence.
3. Record succeeded, failed and cancelled runtime outcomes as terminal receipts with safe evidence references.
4. Share the audit service in server and CLI composition so runtime dispatches and audit commands observe the same SQLite records.
5. Add focused runtime registry tests and update architecture/SSoT/walkthrough documentation.

## Invariants

- A denied admission never creates a `runtime_node_dispatches` row.
- The dispatch stores the generated `ActionAttempt.id`; callers cannot supply an attempt id as an authorization substitute.
- Completion/cancellation receipt writes are replay-safe and do not include prompt contents, result secrets or raw personal payloads.
- Dispatches without `metadata.action_audit` keep legacy behavior until their caller opts into governed execution.
- Core remains provider-neutral; Matrix, OpenClaw, Hermes and external provider semantics stay outside the audit service.

## Non-goals

- Rewriting every provider adapter in this slice.
- Inferring missing authority, plan or baseline references.
- Adding automatic provider readback or reconciliation.
- Changing the runtime node lease/fencing state machine.

## Delivery order

1. Add runtime audit context and registry admission/receipt hooks.
2. Wire server/CLI composition and add focused tests.
3. Run build, architecture/barrel gates and runtime regressions.
4. Update documentation, merge and push.
