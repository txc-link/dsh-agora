# DSH Agora Coordination and Federation v1

Status: implementation baseline
Date: 2026-08-28
Source: user-requested P1/P2 follow-up in Codex task `01a0386a-d3f0-7260-a8ce-9d6bdb688974`

## Objective

Turn the existing reliable runtime dispatch path into a governed multi-agent run while keeping Agora Core independent of DSH, Discord, model vendors, and the A2A transport.

The implementation extends existing task, runtime dispatch, Project Brain, worktree, and extension surfaces. It does not introduce a second task engine.

## Confirmed design

### P1: coordination run

A `coordination_run` is a durable orchestration record that owns a bounded set of existing runtime dispatches.

Supported strategies:

- `single`: one selected worker;
- `fanout`: independent workers with deterministic evidence aggregation;
- `review`: a primary worker followed by a reviewer;
- `debate`: independent workers followed by a verifier focused on disagreements;
- `council`: independent workers followed by an arbitrator that produces the final decision.

Every run declares hard limits for agents, dispatches, wall-clock time, tokens, tool calls, and estimated cost. Unknown usage is not treated as zero: it is reported as unavailable and limits that depend on it cannot be claimed as verified. The coordinator stops creating new work when a hard limit is reached or when new results add less evidence/claim information than the configured threshold.

The coordinator stores member roles and dispatch references, but the runtime-node dispatch table remains the execution source of truth. Reconciliation is idempotent and may be driven by REST, CLI, or the server scheduler.

### Evidence reconciliation and verification

Runtime result envelopes remain provider-neutral. The coordinator compares normalized claims and evidence fingerprints, classifies agreements, unsupported claims, environment drift, and conflicts, and stores a deterministic synthesis. `review`, `debate`, and `council` may create a second-stage dispatch carrying only bounded result envelopes and conflict facts.

The verifier/arbitrator is another runtime target. Agora does not call a model directly. A completed verifier only resolves conflicts whose linked claims are supported by its result; completion alone never upgrades a run to `verified`.

### Agent scorecard

Selection uses runtime presence/capability matching plus historical observations keyed by runtime target and task type. The scorecard exposes success, failure, cancellation, median/P95 latency, evidence yield, verifier acceptance, environment drift, unique-information yield, token usage, and estimated cost when reported.

Scorecards are projections of immutable run/dispatch observations. They are not self-reported agent rankings.

### First-party command adapter

Agora defines `dsh-agora.command-adapter/v1`, a normalized command event and response protocol. DSH commands, the local HTTP endpoint, and optional IM providers all call the same command executor. The adapter may use `dsh-im.bridge/v1` only for delivery; it does not require or modify `dsh-im.command-gateway/v1`.

This gives platform adapters a stable integration point without putting Discord or another IM in Core. Ordinary dsh-im conversations continue to work through the existing DSH tool path.

### P2: A2A boundary

The A2A adapter implements the released A2A 1.0 HTTP+JSON boundary:

- `/.well-known/agent-card.json`;
- `POST /a2a/message:send`;
- `GET /a2a/tasks/:id`;
- `POST /a2a/tasks/:id:cancel`.

Agent Cards are projections of registered runtime targets. A2A tasks map to runtime dispatches. A2A DTOs never become Agora Core task records, and authentication is declared in the card and enforced at the adapter boundary.

### Artifact store

Artifacts have immutable, content-addressed bytes and mutable-free metadata. Core owns artifact identity and references; a content-store port owns bytes. The default server adapter stores SHA-256-addressed files outside the repository. Results, memories, coordination runs, validations, and merge proposals may reference artifacts.

### Layered memory

Memory entries have one of five scopes: `task`, `agent_private`, `project_shared`, `decision`, or `episodic`. Each entry records its source, visibility, optional TTL, and evidence/artifact references. Retrieval always applies scope selectors; expired records are omitted. Project Brain remains the project knowledge engine, while the memory ledger stores concise orchestration memories and provenance.

### Governed sandbox and merge

Existing task worktrees remain the isolation mechanism. A merge proposal pins base and head revisions, validation artifact references, and a diff summary. Only an authenticated human Dashboard action may approve or reject it. Execution rechecks a clean base repository, both pinned revisions, and every validation artifact's content hash before performing a non-fast-forward merge; drift or conflict returns the proposal to a failed/conflicted state instead of silently changing the target.

### Node credentials

Runtime nodes may use individually issued bearer credentials. Only token hashes are stored. Credentials are scoped (`heartbeat`, `dispatch`, `delivery`), expirable, rotatable, and revocable. The existing administrator bearer remains the bootstrap/control credential and is not returned through node APIs.

### Extension security and conformance

`dsh-agora.extension-manifest/v1` declares version, integrity, capabilities, permissions, publisher, and optional Ed25519 signature. Registry policy can require trusted signatures and package-byte integrity verification for third-party extensions. The SDK conformance suite checks manifest shape, capability/permission/resource alignment, runtime protocol behavior, unique agent identities, and deterministic agent descriptions. Runtime cancellation remains an optional advertised capability and is exercised by the runtime integration suite when present.

## Main flow

1. A caller creates a coordination run with a strategy, candidates, and budget.
2. Core scores eligible runtime targets and creates bounded dispatches.
3. Workers report lease heartbeat, work progress, structured results, and usage independently.
4. Reconciliation records observations, updates the scorecard projection, and computes conflicts/information gain.
5. If required and budget permits, Core creates a verifier/reviewer/arbitrator dispatch.
6. The run reaches a terminal state with a deterministic synthesis and optional final agent answer.
7. IM, Dashboard, CLI, REST, and A2A render the same run state through adapters.

## Security boundaries

- Public Agent Cards never expose credentials, workspace paths, or private metadata.
- Artifact content and memory routes use the normal Agora API authentication boundary.
- Node credentials cannot call administrative routes.
- Credential issuance, listing, rotation, and revocation require the global control bearer or an authenticated Dashboard admin session.
- IM command events require a local trusted caller or a configured adapter token and use idempotency keys.
- A merge approval must come from an authenticated Dashboard session; an agent cannot provide an approver identity in JSON.
- Extension signatures cover canonical manifest content without the signature field.

## Acceptance criteria

- A real multi-node fan-out run is created, progresses, reconciles evidence, and terminates without fixed wait-time assumptions.
- A deliberately conflicting result produces a conflict record and verifier stage when budget allows.
- Agent selection is explainable through score components and respects hard budgets.
- A2A discovery and task lifecycle pass adapter conformance tests.
- Artifact hashes are verified on write/read; expired or out-of-scope memory is not returned.
- Node token scope, rotation, expiration, and revocation tests pass.
- An untrusted or over-privileged extension manifest is rejected by strict policy.
- Existing runtime dispatch, dsh-im bridge, DSH command/tool, 3080, 13080, and delivery-outbox paths remain operational.

## Deferred decisions

- PostgreSQL/HA coordination locks and regional scheduling remain P3.
- Automatic learned team formation remains P3; v1 uses deterministic score weights.
- A2A streaming and push notifications are intentionally not advertised until durable event subscriptions exist.
- Binary artifact multipart upload and external object-storage adapters are deferred; v1 uses bounded JSON upload plus content download.
- Platform-native buttons require the corresponding IM adapter to translate interactions into the normalized command event; Core does not own platform component payloads.
