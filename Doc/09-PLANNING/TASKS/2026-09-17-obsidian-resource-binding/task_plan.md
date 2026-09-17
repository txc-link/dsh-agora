# Obsidian resource binding for runtime dispatch

## Scope

Bind the administrator-configured Obsidian vault to `node-home-linux` runtime dispatches so common aliases (`obsidian`, `Obsidian`, `obsiandian`) resolve to a read-only source instead of being rejected as an unknown entity. Keep credential material out of prompts and results.

## Worktree

- Path: `dsh-agora-wt-obsidian`
- Branch: `fix/obsidian-resource-binding`

## Acceptance

1. Runtime prompt contains an explicit, node-scoped resource binding and safe operation boundary.
2. Existing generic dispatch behavior remains unchanged for other runtime nodes.
3. Tests cover alias normalization and absence of credential material.
4. A real `node-home-linux` dispatch can read the configured vault and report evidence without the repeated authorization refusal.
