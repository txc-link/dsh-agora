# DSH Integration

Agora includes a DSH Profile Bundle at `extensions/dsh-agora`. It is a thin host adapter: Agora Server remains the source of truth for tasks, workflow transitions, approvals, audit events, and recovery.

## Responsibilities

| Component | Owns |
| --- | --- |
| Agora Core / Server | task state, stages, gates, approval authority, audit trail |
| `dsh-agora` | Agora REST client, global `agora_task` tool, `/agora`, local host API, optional IM gateway negotiation |
| DSH | model sessions, agent lifecycle, tools, provider/model selection |
| dsh-im | Discord and other IM transports, message deduplication, thread/session binding, approvals and questions from DSH |

The plugin does not contain a second task database or a copy of the Agora state machine. It also does not open a second Discord connection. Its primary integration uses the ordinary DSH tool runtime, so existing dsh-im can remain transport-only and unchanged.

## Install

```bash
cd extensions/dsh-agora
npm install
npm test
dsh plugin --profile web add /absolute/path/to/Agora/extensions/dsh-agora
```

The bundle defaults to Agora's standard `http://127.0.0.1:18008`. Set `AGORA_SERVER_URL` when the server listens elsewhere. `AGORA_API_TOKEN` is forwarded as a bearer token to Agora. Secrets should be supplied through the process environment, not committed in the profile patch.

## Surfaces

The DSH command surface is intentionally compact:

```text
/agora health
/agora list [--state <state>] [--project <project-id>]
/agora show <task-id>
/agora status <task-id>
/agora create [--type <type>] [--priority low|normal|high] [--project <id>] <title>
/agora dashboard
/agora im
```

Human approval and rejection are intentionally absent. They remain on an authenticated Agora surface so authority and audit requirements cannot be bypassed by a convenience adapter.

The host also exposes `ctx.dshAgora` and a loopback-only-by-default JSON API under `/dsh-agora/api`. A non-loopback caller must present `DSH_AGORA_API_TOKEN`.

## dsh-im Contract

No dsh-im change is required for the default path: dsh-im delivers human text to a DSH Session, the Agent calls the global `agora_task` tool, and the model's response returns through dsh-im's existing reply path. This supports natural-language create/list/show/status operations while keeping both plugins unaware of each other's implementation.

The following gateway is an optional enhancement for deterministic `/agora` dispatch, exact IM actor/thread binding, and future unsolicited task notifications.

The plugin negotiates a public, versioned service rather than importing private dsh-im classes:

```text
service: dshImCommandGateway (preferred) or dshImGateway
protocol: dsh-im.command-gateway/v1
operation: registerCommand({ name, description, execute })
```

An invocation carries `actorId`, `provider`, `conversationRef`, and `threadRef`. On task creation those fields become Agora's `im_target`; dsh-im remains responsible for transport and thread ownership.

At the time this adapter was added, dsh-im did not publish that command gateway and its text bridge did not render the `command` value returned from DSH `session.prompt`. Therefore:

- Existing dsh-im works unchanged with natural-language requests that call `agora_task`.
- DSH Web uses `/agora` directly now.
- dsh-im reports `unavailable` through `/agora im` instead of failing plugin startup.
- Full deterministic IM slash-command support needs a small dsh-im change: publish the gateway above, or render the core DSH command result it already receives.
- The adapter does not monkey-patch dsh-im internals; that would create a silent version lock.

## Verification

The package uses strict TypeScript and Node's built-in test runner. Tests cover REST schema/auth/error propagation, command parsing, automatic IM target binding, Cordis registration, and graceful operation without dsh-im.

```bash
npm run typecheck
npm test
npm pack --dry-run
```

## Next Compatible Increments

The next runtime increment should add a DSH execution adapter behind Agora's existing runtime port, with durable Agora task-to-DSH-session bindings and callbacks derived from DSH session events. It should be added as an adapter, not by expanding Core with DSH-specific fields. A management tab can consume the existing host API after the runtime path and dsh-im gateway have stabilized.
