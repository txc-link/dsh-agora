# Progress

- [x] Confirmed the failure is authorization/entity resolution, not dispatch transport.
- [x] Created isolated worktree and branch.
- [x] Added a node-scoped Obsidian alias/resource binding to the runtime prompt.
- [x] Replaced the node-only special case with a configurable resource registry and research-subject fallback.
- [x] Added result-level redaction for prose, tables, URLs, PEM blocks, and secret-looking object keys.
- [x] Added regression coverage for aliases, research fallback, and credential redaction.
- [x] Added the same registry shape for GPU/Mac/Windows-work/Tencent-JP SSH resources without storing credentials.
- [x] Deployed the runtime files and registry to node-home-linux; service restarted successfully.
- [x] Real dispatch smoke: Obsidian typo alias completed with Markdown and redacted password cells.
- [x] Real dispatch smoke: unregistered research subject completed with Markdown/evidence instead of refusing.
- [x] Real dispatch smoke: explicit password-display request completed without secret-shaped output.
