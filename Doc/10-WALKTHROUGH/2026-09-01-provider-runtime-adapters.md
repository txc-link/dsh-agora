# Provider-neutral planning and external runtimes walkthrough

## Outcome

Agora can now project one durable Agora Task into TickTick and/or Google Calendar while retaining Agora as the task and policy system of record. A DSH node can also execute a governed dispatch through OpenClaw or Hermes using the existing runtime extension contract. This delivery changes code only: it does not deploy, alter server profiles, or connect real accounts.

## Architecture

- Core owns provider-neutral `CalendarProviderPort`, `ExternalTaskProviderPort` and `PlanningService`.
- `@agora-ts/adapters-calendar` supplies Google Calendar and Radicale implementations.
- `@agora-ts/adapters-tasks` supplies the TickTick Open API implementation.
- migration `045_planning_bindings.sql` persists opaque provider/object references and the `work` or `life` domain; it stores no access token.
- the server composition root selects providers and exposes planning projection routes.
- `dsh-agora-plugin` 0.7.0 registers OpenClaw and Hermes beside the native DSH runtime. They execute one Agora dispatch and cannot become a second organization-wide scheduler.

## Server configuration

Google Calendar requires explicit separated calendars:

```dotenv
CALENDAR_PROVIDER=google
GOOGLE_CALENDAR_ACCESS_TOKEN=<short-lived-or-broker-supplied-token>
GOOGLE_CALENDAR_WORK_ID=<work-calendar-id>
GOOGLE_CALENDAR_LIFE_ID=<life-calendar-id>
```

TickTick task projection is enabled when a token is present:

```dotenv
TICKTICK_ACCESS_TOKEN=<oauth-access-token>
TICKTICK_API_BASE_URL=https://api.ticktick.com/open/v1/
```

Radicale remains available by selecting `CALENDAR_PROVIDER=radicale` and keeping the existing `RADICALE_*` variables. Partial provider configuration fails at startup rather than silently choosing the wrong provider.

## Planning API

```text
GET  /api/planning/tasks/:taskId
POST /api/planning/tasks/:taskId/external-task
POST /api/planning/tasks/:taskId/calendar-event
```

Each create first verifies the Agora Task and the existing binding. Repeating an already-bound projection returns that binding rather than deliberately creating a duplicate. A binding cannot change from `work` to `life` or the reverse. External writes are assessed by `ActionRiskService`; when it returns `require_human_gate`, only an authenticated Dashboard human may proceed.

## DSH runtime configuration

```yaml
openClawRuntime:
  agents:
    - id: researcher

hermesdRuntime:
  baseUrl: http://127.0.0.1:8642
  profiles:
    - id: analyst
```

Dispatch targets are `dsh:node-mac:openclaw/researcher` and `dsh:node-home-linux:hermes/analyst`. OpenClaw is invoked with the official `openclaw agent` CLI and a stable session identity. Hermes uses the Runs API served by `hermes gateway`; `hermesdRuntime` is only the plugin configuration name. Hermes receives the stable Agora dispatch key as `Idempotency-Key`, and `requires_action` is surfaced as a failed dispatch instead of silently approving it.

## Verification

- Agora focused regression: 8 files, 21 tests passed.
- Agora TypeScript workspace build passed.
- Core architecture and barrel governance gates passed.
- All changed Agora source files passed ESLint with zero errors; `app.ts` retains one pre-existing unused-disable warning.
- `dsh-agora-plugin`: 33 tests passed, typecheck passed, and `npm pack --dry-run` succeeded for 0.7.0.
- Full Agora regression was attempted but is not green on this Windows checkout: legacy SQLite tests leave file handles open and their `afterEach` temp-directory deletion fails with `EPERM`. A single legacy test reproduces the cleanup failure; the focused provider/planning suite has no such failure.

## Deferred live work

- register/configure Google OAuth and decide whether refresh lives in Agora or a local credential broker;
- verify the user's TickTick/滴答 account host and token scope;
- configure actual OpenClaw agents and a `hermes gateway` profile on selected nodes;
- perform live create/read/cancel smoke tests after credentials and deployment are approved;
- optionally bridge Hermes approval requests into Agora Human Gate rather than failing closed.

Official protocol references: [OpenClaw agent CLI](https://github.com/openclaw/openclaw/blob/main/docs/cli/agent.md), [Hermes programmatic integration](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/developer-guide/programmatic-integration.md), [Hermes API server](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/api-server.md), and [TickTick Open API](https://developer.ticktick.com/docs/index.html#/openapi).
