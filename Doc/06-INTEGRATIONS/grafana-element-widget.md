# Grafana Alerting + Matrix Relay (2026-08-31)

> Wires Grafana Alerting webhooks to a Matrix "system-ops" room via the
> `@agora-ts/monitoring-relay` service. Includes the dashboard JSON
> scaffold and Element widget allowlist entry.

## Components

- **monitoring-relay** (`apps/monitoring-relay`): Node HTTP service (~100
  LoC). Accepts Grafana webhook payloads at `POST /webhook/grafana`,
  verifies a shared bearer secret, formats the alert, and forwards it as
  a Matrix `m.room.message` (`m.text`) to the ops room.
- **Grafana dashboard** (`Doc/06-INTEGRATIONS/grafana-ops-dashboard.json`):
  Panels for REST health, task state counts, blocked tasks, connector
  heartbeat, GPU memory, media disk watermark, and port liveness.
- **Element widget** (this doc): embed the dashboard as a Matrix widget
  with a read-only token or anonymous iframe.

## Deploy (monitoring-relay)

Env:

| var | meaning | default |
|---|---|---|
| `MATRIX_HOMES_URL` | homeserver base URL | (required) |
| `MATRIX_ACCESS_TOKEN` | bot access token | (required) |
| `MATRIX_OPS_ROOM_ID` | ops room id (`!abc:matrix.example.org`) | (required) |
| `MATRIX_RELAY_TOKEN` | bearer secret Grafana sends in `Authorization: Bearer …` | (required) |
| `PORT` | listen port | 8089 |

Run:

```sh
cd agora-ts/apps/monitoring-relay
pnpm install
pnpm build
MATRIX_HOMES_URL=https://matrix.example.org \
MATRIX_ACCESS_TOKEN=syt_xxx \
MATRIX_OPS_ROOM_ID='!ops:matrix.example.org' \
MATRIX_RELAY_TOKEN=$(openssl rand -hex 32) \
PORT=8089 \
  node dist/server.js
```

## Grafana Alerting → relay (per contact point)

Grafana Alerting → Contact points → "Webhook" with:

- URL: `http://127.0.0.1:8089/webhook/grafana`
- Authorization: `Bearer ${MATRIX_RELAY_TOKEN}`
- Optional template: leave default (Grafana pushes the standard
  `{ alerts: [...], message, title }` payload).

Recommended rules:

| rule | threshold | severity |
|---|---|---|
| agora_rest_down | `up == 0` for 1m | critical |
| blocked_task_storm | `blocked_tasks >= 5` for 5m | high |
| connector_heartbeat_lost | `last_seen > 90s` | high |
| gpu_memory_critical | `gpu_mem_free < 4000 MiB` (node-a GPU 0) | high |
| media_disk_high | `used_pct > 85` for 30m | medium |

## Element widget allowlist (matrix-widget-api)

Add to `homeserver.yaml` (`app_config` / Element web config) the
dashboard URL with a read-only token or limited scope:

```yaml
# element-web config.json (customWidgets)
"customWidgets": {
  "io.element.system-ops": {
    "url": "http://grafana.example.org/d/agora-system-ops/system-ops?kiosk",
    "type": "customwidget",
    "name": "System Ops",
    "creatorUserId": "@ops:matrix.example.org"
  }
}
```

In the ops room, run `!widget add io.element.system-ops`. Element
loads the iframe via the matrix-widget-api handshake; the dashboard
renders with the embedded Grafana token (anonymous or read-only).

> Security note (verdict §2 risk): the iframe is anonymous / read-only.
> Sensitive panels (e.g. token reveals) MUST be excluded from this
> dashboard or placed under a separate "operator-only" dashboard with a
> per-session token, never the global embed.

## Open follow-ups

- Per-deployment alert rules (Grafana Alerting JSON in this folder is a
  template; each environment supplies its own contact-point secrets).
- Live probe → Influx pipeline (the panels assume measurements are
  written to `agora_*` measurements; deployments wire host probes
  accordingly).
- Element widget creator-user-id provisioning.