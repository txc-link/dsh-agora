# Findings

- `RuntimeNodeRegistryService` is the shared composition boundary used by server and CLI coordination dispatches; instrumenting it covers DSH node dispatch without importing provider code into Core.
- Existing dispatch callers do not all have governance references yet. An opt-in `metadata.action_audit` context is therefore required for this phase; silently manufacturing an authority would weaken the security boundary.
- Runtime result envelopes already expose stable evidence references, so receipts can record dispatch/evidence identifiers without copying answer text.
- Cancellation is a terminal runtime outcome and should produce a failed receipt, while repeated cancellation must not create a second receipt.
