# Runtime dispatch audit instrumentation

The runtime registry now provides the first concrete composition-boundary integration for the ActionAuditService.

When a dispatch carries `metadata.action_audit`, `RuntimeNodeRegistryService.createDispatch`:

1. validates the provider-neutral audit context;
2. admits the action through the task/plan/baseline/authority checks;
3. persists the resulting `attempt_id` beside the dispatch metadata; and
4. refuses to create a runtime dispatch when admission is denied.

Terminal completion and cancellation automatically write one provider-neutral receipt. Evidence is limited to the dispatch identifier and safe result-envelope references; prompt contents and secrets are not copied into the audit tables.

The context is opt-in for backward compatibility: dispatches created without `metadata.action_audit` retain the existing behavior until their caller has a governed plan and authority to reference. Server and CLI compositions now share the same audit service instance with their runtime registry.

Still deferred: instrumentation of non-DSH provider adapters, provider-side readback/reconciliation, and automatic derivation of governance references for legacy dispatch callers.
