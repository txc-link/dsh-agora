# Action audit and runtime enforcement

This slice adds the runtime evidence boundary after collaboration planning:

`CollaborationPlan + ExecutionBaseline + DelegationAuthority → ActionAttempt → ActionReceipt`

`ActionAttempt` is the admission record for one provider-neutral operation. `ActionReceipt` is the append-only outcome, including denied admissions and provider failures. Neither record stores secrets or raw personal payloads; they carry references, action kinds and safe metadata.

Admission is deterministic: task/plan/baseline references must line up, the authority must be active and unexpired, and the requested delegation action must be allowed. `request_approval` only records an approval request; Dashboard human approval remains the sole approval authority.

The service is deliberately invoked at composition/runtime boundaries. Existing adapters can adopt it incrementally without moving provider semantics into Core.

Deferred: automatic instrumentation of every existing adapter, provider readback, and richer evidence extraction.
