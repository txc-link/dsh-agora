# DeepSeek Harness Integration

Agora ships a native DeepSeek Harness (DSH) Profile Bundle in [`extensions/dsh-agora`](../extensions/dsh-agora). It is a thin host adapter: Agora Server remains the source of truth for tasks, gates, approvals, audit events, runtime leases, dispatches, and recovery.

For the longer Chinese guide and troubleshooting catalog, see the package [README](../extensions/dsh-agora/README.md).

## Architecture

Deploy one central Agora Server and install `dsh-agora` on every DSH instance that should execute work:

```text
DSH node A + optional dsh-im ─┐
DSH node B                   ├─ Agora Server + SQLite
DSH node C + optional dsh-im ─┘
```

| Component | Responsibility |
| --- | --- |
| Agora Core / Server | Task state, stages, gates, approval authority, audit trail, durable dispatches |
| `dsh-agora` | REST client, runtime node worker, `agora_task`, `/agora`, local Host API |
| DSH | Models, Agents, Sessions, tools, provider selection |
| dsh-im | Discord and other IM transports, message deduplication, thread/Session binding |

`dsh-agora` does not contain a second task database and does not open another Discord Gateway connection.

## 1. Start the central Agora Server

Prerequisites are Node.js 22+ and npm 10+.

```bash
git clone https://github.com/txc-link/dsh-agora.git
cd dsh-agora
./scripts/bootstrap-local.sh
./agora init
./agora start
curl -fsS http://127.0.0.1:18008/api/health
```

Defaults:

- API origin: `http://127.0.0.1:18008`
- health: `http://127.0.0.1:18008/api/health`
- Dashboard: `http://127.0.0.1:33173/dashboard/`

Every DSH host must be able to reach the API origin. Prefer a private network, VPN, or TLS reverse proxy. FRP and SSH tunnels are also valid transports. Configure the origin only; do not append `/api` to `serverUrl`.

If anything other than loopback can reach the API (including FRP), bearer authentication is mandatory. Enable it in `~/.agora/agora.json` and provide the same value to each DSH process as `AGORA_API_TOKEN`:

```json
{
  "api_auth": {
    "enabled": true,
    "token": "replace-with-a-long-random-token"
  }
}
```

Never commit API tokens, model keys, or Bot Tokens.

After restart, `/api/health` remains public, while this probe must return `401` without credentials:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://agora.example.com/api/runtime-nodes
```

## Runtime safety in `dsh-agora` 0.4+

- Claimed dispatches carry a fencing token and are renewed while the destination Agent is running.
- An expired or superseded owner cannot commit a stale result.
- A live `nodeId` cannot be silently replaced by a different process instance.
- The Agent result and an optional provider-neutral delivery intent are committed atomically.
- IM delivery is claimed from a durable outbox and retried with the same message idempotency key.

The 0.4 protocol is intentionally coordinated: upgrade Agora Server and all DSH nodes together while no dispatch is active. Existing completed records migrate in place; an old plugin cannot complete a newly fenced dispatch.

Version 0.5 adds an append-only progress ledger and an evidence-first result envelope. Lease renewal (`claim_renewed_at`) now answers only whether a worker still owns the claim. Meaningful execution is reported separately as ordered `attempt + sequence` events, with `latest_progress` cached on the dispatch for inexpensive polling. A reclaimed dispatch starts a new attempt and clears only the latest summary; prior attempt history remains auditable.

Upgrade the central Server and apply migration 031 before upgrading nodes to 0.5. Existing 0.4 nodes remain accepted by the new Server but do not emit progress or structured evidence.

## 2. Install `dsh-agora` on every DSH node

```bash
git clone https://github.com/txc-link/dsh-agora.git
cd dsh-agora/extensions/dsh-agora
npm install
npm run typecheck
npm test
dsh plugin --profile web add "$PWD"
```

PowerShell uses the absolute current directory:

```powershell
dsh plugin --profile web add (Get-Location).Path
```

The Web management panel additionally needs:

```bash
dsh plugin --profile web add dsh-better-sidebar
```

The Host adapter, runtime worker, commands, tool, and local API still work without the sidebar; only the UI tab is absent.

## 3. Configure a node

The default profile directory is `${DSH_HOME:-$HOME/.dsh}/profiles/web` on Linux/macOS and usually `$HOME\.dsh\profiles\web` on Windows.

Merge the following row into that profile's `cordis.patch.yml`; do not overwrite unrelated plugin rows:

```yaml
- id: agora
  config:
    serverUrl: 'https://agora.example.com'
    requestTimeoutMs: 10000
    nodeEnabled: true
    nodeId: 'node-a'
    maxConcurrent: 2
    runtimeAgents:
      - id: 'default'
        displayName: 'Node A General Agent'
        workspace: '/absolute/path/to/workspace'
        roles: ['general']
        capabilities: ['research', 'coding']
```

Use forward slashes in a quoted Windows workspace path, for example `C:/Users/example/workspace`.

Configuration rules:

- `serverUrl` is the Agora API origin, not the Dashboard URL.
- `nodeId` must be stable and unique across the Agora network. When omitted, the hostname is used.
- Agent ids are unique within a node. A target is addressed as `dsh:<nodeId>:<agentId>`.
- `workspace` must be an absolute path accessible to the destination DSH.
- `maxConcurrent` limits simultaneous dispatch execution on that node.
- `dispatchLeaseSeconds` defaults to 120 seconds; the worker renews at one third of the lease. Use `claim_renewed_at` for claim liveness and `latest_progress` for meaningful execution; do not treat `updated_at` as either signal.
- Profile config takes precedence over environment variables.

Environment alternatives, when the corresponding profile fields are absent:

```bash
export AGORA_SERVER_URL=https://agora.example.com
export AGORA_API_TOKEN=replace-with-server-bearer-token
export DSH_AGORA_NODE_ID=node-a
export DSH_AGORA_API_TOKEN=replace-if-remote-callers-need-the-local-host-api
```

`AGORA_API_TOKEN` authenticates the adapter to Agora Server. `DSH_AGORA_API_TOKEN` protects the adapter's own `/dsh-agora/api/*`; without it, that API is loopback-only.

Inspect the final composition before starting:

```bash
dsh --profile web --dump-config
```

## 4. Start and verify

```bash
dsh web --host 127.0.0.1 --port 3080 --no-open
```

Open `http://127.0.0.1:3080`, click the **Agora** button, and check the Overview and Nodes tabs.

The local snapshot endpoint is a useful smoke probe:

```bash
curl -fsS -X POST http://127.0.0.1:3080/dsh-agora/api/snapshot \
  -H 'content-type: application/json' \
  -d '{}'
```

Expected minimum state:

- `node.state` is `online`;
- `serverUrl` is the intended central API;
- all configured DSH nodes eventually appear in the Nodes tab;
- `imBridge.state` is `connected` after the optional bridge patch is installed.

## 5. Optional dsh-im bridge

No dsh-im change is needed for core dispatch. dsh-im can deliver human text to a DSH Session, the Agent can call `agora_task`, and the ordinary model response returns over the existing IM path.

Proactive cross-node IM delivery additionally needs the versioned `dsh-im.bridge/v1` patch. `@xmanrui/dsh-im` is a third-party plugin; pin the exact supported version before applying a patch:

```bash
dsh plugin --profile web add @xmanrui/dsh-im@2.3.0
```

Available artifacts:

| Package version | Patch |
| --- | --- |
| `@xmanrui/dsh-im@2.1.0` | `extensions/dsh-agora/patches/dsh-im/@xmanrui__dsh-im@2.1.0.patch` |
| `@xmanrui/dsh-im@2.3.0` | `extensions/dsh-agora/patches/dsh-im/@xmanrui__dsh-im@2.3.0.patch` |

Copy the exact patch into the profile's `patches/` directory and merge the matching entry into `pnpm-workspace.yaml`:

```yaml
patchedDependencies:
  '@xmanrui/dsh-im@2.3.0': patches/@xmanrui__dsh-im@2.3.0.patch
```

Then update and verify the lockfile:

```bash
PROFILE="${DSH_HOME:-$HOME/.dsh}/profiles/web"
pnpm --dir "$PROFILE" install
pnpm --dir "$PROFILE" install --frozen-lockfile
```

The bridge exposes only safe Bot identity/capabilities, Session-to-conversation routes, and idempotent send. It never exposes Bot Tokens.

### Optional command gateway status

`dsh-im.command-gateway/v1` is an optional enhancement defined by `dsh-agora`; it is not currently provided by the third-party dsh-im package. The following state is therefore expected:

```text
im: unavailable
imBridge: connected
```

This does not affect node heartbeat, dispatch, the DSH Web `/agora` command, natural-language `agora_task` calls, or proactive bridge delivery. It only removes deterministic IM-side parsing of `/agora ...` with direct actor/thread binding.

## Commands and tool

```text
/agora health
/agora nodes
/agora agents
/agora list [--state <state>] [--project <project-id>]
/agora show <task-id>
/agora status <task-id>
/agora dispatch-status <dispatch-id>
/agora create [--type <type>] [--priority low|normal|high] [--project <id>] <title>
/agora dashboard
/agora im
```

The global `agora_task` tool adds `dispatch`, `dispatch_status`, and `attach_session`. Approve/reject are intentionally absent: human gates remain on an authenticated Agora surface.

## Two-node smoke test

1. Open the Agora panel on node A.
2. Select target `dsh:node-b:default` on the Dispatch tab.
3. Use `silent` presentation first.
4. Prompt: `Reply with REMOTE_AGORA_OK and nothing else.`
5. Copy the dispatch id and run `/agora dispatch-status <dispatch-id>`.

The dispatch should reach `completed` on node B, pass through at least `prompt_accepted` and `response_completed`, and contain `REMOTE_AGORA_OK`. Verifiable answers also expose claims and evidence in `result_envelope`.

For Discord delivery, send a natural-language request to the source Bot:

```text
Call agora_task and dispatch to dsh:node-b:default.
Ask it to reply with REMOTE_DISCORD_OK.
Use presentation_mode destination_bot and wait 120 seconds.
```

Do not rely on IM `/agora` slash parsing until a command gateway provider is installed.

## pnpm build-script policy

`ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED` and `ERR_PNPM_IGNORED_BUILDS` are supply-chain policy failures, not network failures. Review and allow only exact dependencies that genuinely require scripts. For example, a trusted `dsh-better-sidebar` installation may require:

```yaml
allowBuilds:
  node-pty: true
```

After fixing `allowBuilds`, rerun the original `dsh plugin add` so the CLI completes both package installation and bundle registration. Do not disable pnpm's build policy globally.

## Troubleshooting checklist

- **404 from Agora**: verify port `18008`, use an origin without `/api`, probe `<serverUrl>/api/health`, and inspect `dsh --profile web --dump-config`.
- **Package present but no Agora button**: verify both `dsh-agora` and `dsh-better-sidebar` are in `dsh.profile.bundles`, restart DSH, and hard-refresh the browser.
- **Node offline**: verify central reachability, `nodeEnabled`, unique `nodeId`, system time, reverse proxy, and the DSH process.
- **Bridge unavailable**: verify the exact dsh-im version, `patchedDependencies`, successful frozen install, restart, and the `dsh-im.bridge/v1` marker in installed `lib/index.js`.
- **`.credentials.yaml` rejects `version` or `refs`**: newer DSH expects a flat top-level mapping of credential names to string values. This is a DSH credential-format migration, not an Agora failure.

## Verification for contributors

```bash
cd extensions/dsh-agora
npm run typecheck
npm test
npm pack --dry-run
```
