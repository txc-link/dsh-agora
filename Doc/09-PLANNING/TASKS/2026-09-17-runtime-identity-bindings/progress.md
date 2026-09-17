# Progress

- [x] Extend runtime agent config metadata and roster rendering.
- [x] Add docs/config examples.
- [x] Run tests/typecheck/build (connector 299/299; plugin typecheck and focused runtime tests pass; full plugin suite has one pre-existing/flaky HTTP session assertion).
- [x] Apply safe home GPU metadata and verify live roster (no password/private key written).
- [x] Implement Matrix no-mention fallback: `agent9` is the sole manager, reads all role cards, and may emit bounded structured delegation messages.
- [ ] Obtain confirmation before creating Matrix users or changing existing account bindings.

## Live changes

- `matrix-agentd.service`: `AGENTD_DEFAULT_ROLE=agent9`; `AGENTD_CALLERS=root,agent9`.
- `/home/ailink/matrix-agentd/agentd.mjs` and `runners/_preamble.sh` were backed up with the suffix `.bak-manager-20260917` before the live edit.
- Existing `AGENTD_ROOMS` whitelist and fail-closed behavior remain unchanged.
