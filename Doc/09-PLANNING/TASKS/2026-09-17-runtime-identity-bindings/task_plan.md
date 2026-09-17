# Runtime identity bindings

## Scope

Make runtime roster entries explain the stable identity handle, machine label, harness label, and safe SSH access metadata without storing credentials. Preserve existing `node_id` and target refs for compatibility.

## Worktree

Current clean `master` worktree: `F:\MyObsidianFiles\跨机器协同\paos-implementation\dsh-agora`. No separate worktree because the user asked to continue the already deployed runtime-roster work in the current checkout and the repo is clean.

## Plan

1. Extend DSH runtime agent metadata and Matrix roster projection.
2. Add safe configuration examples for the requested identity handles and machine access.
3. Add tests and run focused/build checks.
4. Apply only non-secret metadata to the home GPU profile; leave Matrix account creation and unreachable work Windows pending explicit confirmation/configuration.

## Safety boundary

Passwords, private keys, access tokens, and session cookies must not enter source, YAML, Git, logs, or Matrix events. Store only host/port/user and a reference to an external SSH key/secret-manager entry.
