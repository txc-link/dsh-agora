# Matrix Channel Provider via cc-connect — Design

**Date**: 2026-08-28
**Owner**: ailink
**Worktree**: `.worktrees/feat-cc-connect-matrix-channel-provider`
**Branch**: `feat/cc-connect-matrix-channel-provider`
**Discussion source**: this session, 2026-08-28
**Status**: Confirmed + Undecided (per `Doc/reference/execution-workflow-standard.md`
"Architecture Capture" rule)

---

## 0. Background

The user's goal is multi-agent collaboration in a Matrix room:

> "Agora can connect to Matrix; multi-agents in a Matrix room collaborate on
> tasks."

Investigation revealed that the work was **not** "build a Matrix adapter inside
Agora" but instead "let Agora recognize `type = "matrix"` in cc-connect's TOML
config, and let cc-connect's runtime carry the Matrix transport". cc-connect
upstream already supports Matrix natively (see Findings F1).

## 1. Confirmed Design

### 1.1 Boundary

- **Agora stays channel-agnostic.** No Matrix SDK in this repo. No
  `matrix?: ...` field on `CcConnectProjectTarget`. No platform-name
  conditionals beyond the existing `currentPlatformType === 'discord'` token
  decode (which exists only because Discord tokens carry the bot user id and
  need to be reversed; Matrix has no analogous requirement).
- **cc-connect upstream owns transport.** Synapse connection, E2EE, room
  state — all live in the cc-connect runtime process. Agora only consumes
  the channel-agnostic bridge WebSocket.
- **No fallback / shim / matrix-specific branch.** If a future platform is
  added (Feishu, Slack, …) the same path works as-is. This was validated by
  reading the parser: `channelProviders.add(value)` is a `Set<string>`
  accumulate.

### 1.2 End-to-end flow (multi-agent in one Matrix room)

```
User (Element / SchildiChat / Cinny)
   │
   ▼
Synapse homeserver (8.136.15.147:8008, deployed separately)
   │
   ▼
cc-connect runtime process (v1.4.0+, matrix channel provider on)
   │  Matrix adapter in cc-connect consumes room events
   │
   ▼
cc-connect bridge WebSocket
   │
   ▼
Agora adapters-cc-connect / bridge-runtime-service.ts
   │  Provider-agnostic (platform: string forwarded as-is)
   │
   ▼
Agora Core IMProvisioningPort.publishMessages
   │  provider: "matrix" — opaque string to Core
   │
   ▼
Task conversation ingest → Task Service dispatcher
   │
   ▼
Multiple DSH Sessions bound to the same task conversation
   │  (multi-agent dispatch is independent of channel choice)
   │
   ▼
Per-session results → adapters-cc-connect → bridge reply
   │
   ▼
cc-connect matrix channel provider → Matrix room
```

### 1.3 Why "no Agora code change" is the correct answer

Reading `config-targets.ts:233-238`:

```ts
if (currentSection === 'projects.platforms') {
  if (key === 'type' && typeof value === 'string') {
    currentProject.channelProviders.add(value);
    currentPlatformType = value;
  }
  continue;
}
```

The parser **already** treats the platform type as opaque. Adding `matrix`
requires zero new code. The orphan RED test was the only thing missing — and
it lives unchanged. Phase 1 of this task is therefore **recover the test file
+ verify it passes + verify no Discord regression**.

This conforms to `Doc/reference/agora-core-decoupling-standard.md`:
> "If Discord disappears, does the concept still hold? — If so, the design is
> too coupled [if you write matrix-specific code]."

Replace "Discord" with "Matrix" in that test and the same answer is "yes, the
concept still holds". That is the design.

### 1.4 What was delivered (Phase 1)

1. `agora-ts/packages/adapters-cc-connect/src/config-targets.matrix.test.ts` —
   the 3-case RED test, preserved byte-for-byte from the dead
   `feat/cc-connect-matrix-platform-type` branch.
2. Verification: 32 tests pass across the cc-connect package; no Discord
   regression.
3. `config-targets.ts` — **unchanged** (zero production code diff).
4. Planning at
   `docs/09-PLANNING/TASKS/2026-08-28-matrix-channel-provider/`.
5. This document.

## 2. Undecided / Deferred

### 2.1 Real-world smoke test

- Owner action: deploy cc-connect v1.4.0+ with matrix channel enabled,
  pointing at the existing Synapse `8.136.15.147:8008`. Put two cc-connect
  agent projects in the same Matrix room. Verify Agora Task Service routes
  the room to both agents and both reply.
- This is **not** in this PR. It depends on the user's Synapse + cc-connect
  runtime deployment, which is out of Agora's control.
- Acceptance: A user types in Matrix → two DSH Sessions bound to the same
  task conversation receive the prompt → both reply → replies arrive back
  in the Matrix room.

### 2.2 Dashboard UI for Matrix

- Dashboard currently surfaces Discord room references. No work scheduled.
- Decision: defer until 2.1 lands and proves the runtime works.

### 2.3 E2EE handling

- cc-connect's matrix channel documentation (per upstream `docs/matrix.md`)
  governs this. Agora sees only post-decryption events.
- If cc-connect exposes encrypted-room-only state, Agora will receive a
  "stub" or empty content. **No fallback will be written.** If users need
  E2EE matrix rooms, the answer is "track cc-connect upstream". Per
  AGENTS.md §1.5: no compatibility shim.

### 2.4 Multi-homeserver / multi-bridge

- Single homeserver today. The TOML allows multiple `[[projects]]` blocks,
  each with its own channel providers, so the surface is naturally multi-
  homeserver at the configuration layer. No abstraction change required.
- Real multi-homeserver federated routing is cc-connect's job; not Agora's.

### 2.5 Rate limiting / backpressure

- Existing cc-connect bridge reply relay already has rate-limit awareness.
  No Agora-side change needed.
- If Matrix event volume becomes a bottleneck, that is a cc-connect tuning
  problem (its `bridge-runtime-service.ts` consumer side).

### 2.6 SSoT cross-reference

- Private `docs/Agora-实施排期-Agora-TS.md` is not mounted in this
  workspace. Public mirror at `Doc/reference/` was substituted for the
  Decoupling Standard and Execution Workflow Standard.
- When the private SSoT is mounted, a one-line cross-reference entry
  pointing to this design doc should be appended there.

## 3. References

- `Doc/reference/agora-core-decoupling-standard.md` — design test applied
  here.
- `Doc/reference/execution-workflow-standard.md` — public-mirror substitute
  for the private SSoT loop.
- `agora-ts/packages/adapters-cc-connect/src/config-targets.ts` — the
  parser; `channelProviders.add(value)` at line 234 is the existing
  generalizing site.
- `agora-ts/packages/core/src/im-ports.ts` — Core IM ports; `provider` is
  an opaque string.
- `agora-ts/packages/adapters-cc-connect/src/bridge-runtime-service.ts` —
  cc-connect bridge consumer; provider-agnostic.
- Upstream cc-connect: <https://github.com/chenhg5/cc-connect> (Matrix
  support confirmed in `docs/matrix.md`, released in v1.4.0-beta.1).
- Planning dir: `docs/09-PLANNING/TASKS/2026-08-28-matrix-channel-provider/`.