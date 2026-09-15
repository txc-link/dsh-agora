# Dependency security refresh

## Objective

Remove currently fixable npm advisories with compatible dependency updates,
without mixing feature work or major-version migrations into the change.

## Work context

- Worktree: `F:\MyObsidianFiles\跨机器协同\paos-implementation\worktrees\dsh-agora-dependency-refresh`
- Branch: `chore/dependency-security-refresh`
- Base: `9816a79` (`origin/master` on 2026-09-14)
- Public contribution: this task uses the allowed `Doc/` contributor surface.

## Plan

1. Record the clean-install audit and outdated dependency baseline.
2. Apply only versions allowed by the repository's existing semver ranges.
3. Re-run audit and inspect package/lockfile scope.
4. Run the strict repository check on Linux.
5. Keep major upgrades such as ESLint 10, Vitest 5, and TypeScript 7 out of
   scope unless a compatible update cannot close an advisory.
6. Prepare an independent PR and delivery summary.

## Exit criteria

- `npm audit` has no remaining fixable advisory, or every residual is documented.
- Package changes stay within existing compatible ranges.
- The strict Linux check passes.

