# Action audit and runtime enforcement walkthrough

## What this adds

The collaboration governance chain now has an explicit runtime boundary:

```text
CollaborationPlan + ExecutionBaseline + DelegationAuthority
                           │
                           ▼
                    ActionAttempt (admit/deny)
                           │
                           ▼
                    ActionReceipt (terminal fact)
```

`ActionAttempt` records the provider-neutral operation and the authorization references used to admit or deny it. `ActionReceipt` records a terminal success, failure, or denied admission. Both are durable, task-scoped, idempotent, and safe to replay after a restart.

## REST flow

Create an admitted attempt after creating a task, requirement/spec, authority, plan and (when required) approved execution baseline:

```http
POST /api/tasks/<task-id>/action-attempts
Content-Type: application/json

{
  "collaboration_plan_id": "<plan-id>",
  "execution_baseline_id": "<baseline-id>",
  "delegation_authority_id": "<authority-id>",
  "subtask_spec_id": "<spec-id>",
  "actor_ref": "agent:researcher",
  "action": "delegate_subtask",
  "subject_ref": "agent:analyst",
  "idempotency_key": "attempt-001"
}
```

On a valid request the response has `decision: "admit"`. A missing, expired, cross-task or insufficient authority produces `decision: "deny"` and immediately persists a receipt with `outcome: "denied"`; no provider adapter is called.

Record one terminal provider outcome:

```http
POST /api/tasks/<task-id>/action-receipts
Content-Type: application/json

{
  "attempt_id": "<attempt-id>",
  "outcome": "succeeded",
  "provider_ref": "runtime-dispatch:<id>",
  "evidence_refs": ["artifact:<id>"],
  "summary": "Worker returned the requested report",
  "created_by": "runtime:node-home-linux",
  "idempotency_key": "receipt-001"
}
```

An attempt can have only one terminal receipt. Replaying the same idempotency key and payload is safe; changing the payload or adding a second outcome is rejected.

Read the audit trail with:

```http
GET /api/tasks/<task-id>/action-attempts
GET /api/tasks/<task-id>/action-receipts
```

## CLI flow

The CLI accepts JSON files so it does not invent approval identity or provider side effects:

```text
agora audit attempt admit <task-id> --file attempt.json --idempotency-key attempt-001
agora audit attempt list <task-id>
agora audit attempt show <attempt-id>
agora audit receipt record <task-id> --file receipt.json --idempotency-key receipt-001
agora audit receipt list <task-id>
agora audit receipt show <receipt-id>
```

The JSON shape is the same as the REST request body. Dashboard human approval remains the approval authority; `request_approval` is recorded as an action request and never treated as approval.

## Current boundary and next slice

Core only validates references and persists audit facts. It does not know Matrix, OpenClaw, Hermes, Google, TickTick, or any other provider. Existing runtime adapters can call the service at their composition boundary. Automatic instrumentation of every adapter, provider-side readback, and richer evidence extraction are intentionally deferred to the next implementation slice.
