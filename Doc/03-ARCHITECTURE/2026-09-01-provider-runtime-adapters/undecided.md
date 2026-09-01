# Undecided

1. Whether Google OAuth refresh should be handled by Agora itself or by a dedicated local credential broker. This change accepts an access-token supplier but does not persist refresh tokens.
2. Whether the user's Chinese-region 滴答 account exposes the same TickTick Open API host. The adapter base URL is configurable; live validation waits for credentials.
3. Which external writes should be denied rather than gated by domain and risk level. Current wiring assesses every external task/event write and requires an authenticated Dashboard human whenever `ActionRiskService` returns `require_human_gate`.
4. Whether Hermes approvals should be bridged into Agora's Human Gate. v1 fails a run that enters `requires_action`; it does not auto-approve.
5. Whether OpenClaw should later use the Gateway WebSocket directly. The CLI is the smaller and officially supported initial integration.
6. Whether runtime targets should later become a four-part/provider-typed central contract. Namespaced `agent_ref` keeps v1 backward compatible.
