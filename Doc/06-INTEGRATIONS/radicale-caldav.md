# Radicale — Calendar / Commitment Center (2026-08-31)

> Lightweight CalDAV/CardDAV server (~20 MB RAM, no external DB) that backs
> the commitment calendar projection. v0.1 of the Agora calendar line.

## Why Radicale

- Single-user / few-user scope matches Agora's current posture (per-user
  or per-deployment bot identity).
- File-backed storage; trivial backup/restore.
- ~20 MB resident, no PHP / DB / heavy runtime.
- Apache 2.0 / MIT-compatible license.

## Deploy (docker compose snippet)

`docker-compose-files/radicale.yml` (drop into the existing compose stack):

```yaml
services:
  radicale:
    image: tomsquest/radicale:3.2
    container_name: agora-radicale
    restart: unless-stopped
    environment:
      RADICALE_CONFIG: |
        [auth]
        type = plain
        # production: htpasswd or ldap
        [rights]
        type = owner_only
        [storage]
        type = multifile
        filesystem_folder = /data/collections
        [logging]
        level = info
    volumes:
      - ./radicale-data:/data/collections
    ports:
      - "5232:5232"   # bind on the host so the connector / agora-ts can reach it
```

Bootstrap a user (one-time):

```sh
docker exec -it agora-radicale \
  htpasswd -nbB alice 'change-me-now' > radicale-data/users.htpasswd
# then mount or volume-bind that file and switch auth.type = htpasswd
```

> Health probe: `curl -fsSL http://127.0.0.1:5232/` should return 401
> (auth required) when the server is up. The current sandbox probe
> returns 000 (not deployed) — see `Doc/09-PLANNING/TASKS/2026-08-31-next-batch/task_plan.md` §C_calendar.

## Agora wiring (env)

The connector / agora-ts calendar layer reads:

| env var | meaning | default |
|---|---|---|
| `RADICALE_URL` | base URL, e.g. `http://127.0.0.1:5232` | (required) |
| `RADICALE_USER` | CalDAV principal | (required) |
| `RADICALE_PASSWORD` | basic-auth password | (required) |
| `RADICALE_WORK_COLLECTION` | work calendar path | `/<user>/work/` |
| `RADICALE_LIFE_COLLECTION` | life calendar path | `/<user>/life/` |
| `RADICALE_TIMEZONE_OFFSET_MINUTES` | "today" boundary offset (Asia/Shanghai = 480) | 0 (UTC) |

When any of the three required vars is missing, the REST routes return
503 with `"Calendar service is not configured"`, and the CLI prints a
matching error — no silent fallback (per AGENTS.md §1.5).

## Domain isolation

- `work` collection: EA / schedule agents may read+write (via agora
  authorization); the calendar adapter exposes a thin projection.
- `life` collection: only Life Gateway + authorized companion agents may
  access; commitment → CalDAV projection keeps Agora commitment as the
  authoritative ledger (CalDAV is downstream).
- `health`: never projected into the Matrix channel; only `todo /
  conflict / confirm` summaries reach the room (verdict §3 / §3.4).

## Open / follow-up

- commitment → CalDAV bidirectional sync (verdict §6 #6: trigger source).
- CalDAV → commitment reverse direction is manual-confirm only.
- Grafana widget + Matrix alert relay see `monitoring-relay` (this batch).