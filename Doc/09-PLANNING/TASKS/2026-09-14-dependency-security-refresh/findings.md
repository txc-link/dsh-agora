# Findings

## Baseline

- Clean install: 339 packages.
- `npm audit`: 22 advisories — 1 low, 4 moderate, 13 high, 4 critical.
- Direct advisory-bearing packages: `@vitest/coverage-v8`, `concurrently`,
  `vitest`, `fastify`, `ws`, and `discord.js`.
- Every reported advisory currently advertises an available fix.

## Upgrade policy

- Use the repository's current semver ranges and refresh the lockfile.
- Accept compatible direct/transitive updates only.
- Defer major framework/toolchain changes to dedicated migration work.

## Compatible update result

- The final refresh changed only `agora-ts/package-lock.json`; package manifests and
  declared semver ranges are unchanged. A broad compatible update was rejected
  after it exposed Qdrant and Inquirer compile regressions; the final lockfile
  was rebuilt from HEAD with `npm audit fix` plus the narrow `tsx` update needed
  to move transitive `esbuild` past its fixed version.
- Direct security-relevant versions now resolve to:
  `@vitest/coverage-v8@4.1.11`, `vitest@4.1.11`,
  `concurrently@9.2.4`, `fastify@5.12.4`, `ws@8.21.3`, and
  `discord.js@14.27.0`, and `tsx@4.23.13`.
- The final clean tree contains 344 packages. Only the lockfile changed; it
  includes the compatible transitive fixes selected by npm's audit resolver.
- Post-update `npm audit` reports 0 vulnerabilities; Windows build, lint, and
  typecheck all pass.
- The final isolated Linux worktree passed architecture and barrel governance
  gates, lint, build, typecheck, and all 285 test files (1704/1704 tests).
- A final `npm audit --audit-level=low` on that Linux worktree also reported 0
  vulnerabilities.
- Major migrations remain deferred: ESLint 10, Vitest 5, TypeScript 7,
  Commander 15, and `https-proxy-agent` 9.
