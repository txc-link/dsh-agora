# Runtime dispatch audit instrumentation walkthrough

## Governed dispatch input

Add an `action_audit` object to the dispatch metadata when the caller has a collaboration plan, execution baseline and active delegation authority:

```json
{
  "task_id": "task-123",
  "runtime_target_ref": "dsh:node-home-linux:researcher",
  "prompt": "Prepare the research brief",
  "idempotency_key": "dispatch-task-123-researcher",
  "metadata": {
    "action_audit": {
      "collaboration_plan_id": "plan-123",
      "execution_baseline_id": "baseline-123",
      "delegation_authority_id": "authority-123",
      "subtask_spec_id": "spec-123",
      "actor_ref": "agent:assistant",
      "action": "dispatch_subtask",
      "subject_ref": "dsh:node-home-linux:researcher",
      "idempotency_key": "audit-task-123-researcher"
    }
  }
}
```

The registry calls `ActionAuditService.admit` before creating the dispatch. On success it adds the generated `attempt_id` to the persisted `action_audit` metadata. On denial it returns a conflict and leaves no runtime dispatch row; the ActionAuditService still keeps the denied attempt and denied receipt.

## Automatic terminal receipt

When the node completes the dispatch, the registry derives a provider-neutral receipt:

- `succeeded` for a completed dispatch;
- `failed` for a failed dispatch;
- `failed` with `RUNTIME_DISPATCH_CANCELLED` for a cancellation;
- `provider_ref` set to `runtime-dispatch:<dispatch-id>`;
- `evidence_refs` limited to that dispatch and stable result-envelope evidence identifiers.

The receipt uses a deterministic idempotency key, so a repeated completion callback or cancellation does not create a second terminal receipt.

## Compatibility rule

Dispatches that do not carry `metadata.action_audit` continue to follow the legacy runtime path. This is intentional: the system must not guess an authority or human approval. Once a caller has a governed plan, it can add the context without changing the Matrix/OpenClaw/Hermes provider implementation.

## Next slice

Extend the same boundary to non-DSH provider adapters and add provider-side readback/reconciliation. That work should consume the existing attempt/receipt records rather than add provider fields to Core contracts.
