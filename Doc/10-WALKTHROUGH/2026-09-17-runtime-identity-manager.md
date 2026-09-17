# Runtime identity roster + no-mention manager routing

## Outcome

- `/agora roster` now projects safe identity metadata: identity handle, machine label, harness label, and SSH locator (`protocol/host/port/user/reachability`).
- Existing `node_id` and `dsh:<node>:<agent>` target refs remain unchanged.
- Home GPU node metadata is live as `gpu-home` over an SSH public tunnel; no password, key, token, or cookie was written.
- Plain messages in the shared Matrix agent room now go only to `agent9` (the existing Team Dispatcher / Hermes role) when no role is addressed. The manager receives all role cards and can emit a bounded structured delegation block. The daemon validates every target and sends explicit Matrix mentions.
- Direct `@role` messages keep their previous behavior.

## Verification

- dsh-agora plugin TypeScript typecheck passed; focused runtime/node-worker tests passed.
- dsh-matrix-connector build and full test suite: 299/299 passed.
- Live `dsh-web.service` restarted and resolved dsh-agora-plugin `0.7.2` / dsh-matrix-connector `0.6.4`.
- Live runtime inventory reports `node-home-linux` online with the expected non-secret machine metadata.
- `matrix-agentd.mjs` passed `node --check`; `_preamble.sh` passed `sh -n`; service is active with `AGENTD_DEFAULT_ROLE=agent9` and `AGENTD_CALLERS=root,agent9`.

## Safety and pending decisions

- The requested new Matrix localparts are not created or renamed in this change. Doing that requires an explicit account mapping and fresh per-identity credentials.
- The supplied plaintext SSH passwords should be rotated; only SSH-key references belong in machine metadata.
- The Mac value supplied as an HTTPS URL remains unclassified as SSH until the protocol is confirmed. Work Windows remains local-only.
