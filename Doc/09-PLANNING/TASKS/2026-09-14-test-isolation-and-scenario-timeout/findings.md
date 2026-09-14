# Findings

## Baseline evidence

The isolated Linux checkout at `9816a79ea167` passed architecture, barrel, lint, build, and workspace typecheck gates. Its default suite reported 1704 tests with 1698 passing and 6 failing.

- Three failures used deterministic `.agora-task-worktrees/<project>/<task>` paths directly below the shared system temporary root. The same cases passed with a private `TMPDIR`.
- Two tmux craftsman adapter cases constructed the registry with its production default `/tmp/agora-ts-tmux-registry`. The same cases passed in a private mount namespace.
- The full text scenario matrix exceeded Vitest's default 5-second timeout. The file passed 7/7 with `--testTimeout=30000`; the matrix took about 15 seconds.

## Static diagnosis

- `TaskWorktreeService` intentionally places task worktrees beside the configured project state root. The affected tests create that state root directly under `tmpdir()`, accidentally making their worktree targets global and deterministic.
- `TmuxPaneRegistry` correctly accepts `registryDir`; the two affected tests simply do not use the existing seam.
- The JSON full-matrix test already carries a local 30-second timeout, while the equivalent text-rendering test does not.

## Design decision

Fix only the fixtures: nest each project state root below a unique temporary parent, inject a unique tmux registry, and put the timeout on the one long-running text matrix test. Do not change production defaults or globally relax test timeouts.

The three worktree integration cases also receive a local 30-second timeout. They perform real Git repository initialization, commit, worktree creation, inspection, removal, and SQLite setup. They complete in about one second on Windows and 15–16 seconds each on the available WSL2 instance; a global timeout change is not justified.

## Additional platform findings

- The initial Windows focused baseline had 4 failures and 2 passes: the three worktree cases failed during cleanup with SQLite/Git-related `EPERM`, while the text matrix timed out at 5 seconds. The two tmux assertions passed because the local shared registry was writable.
- Tracking and closing the three databases plus unregistering the created Git worktrees before recursive removal makes those cases pass on Windows.
- A Windows default-suite diagnostic showed a much wider pre-existing problem: many TaskService, CLI, and server tests leave SQLite databases open, so their successful assertions are reported as failures when `afterEach` removes temporary directories. This is a separate repository-wide fixture lifecycle task.
- WSL2 uses native `/usr/bin/git` 2.43.0. The three patched worktree cases pass serially, but the full text scenario matrix hangs for more than 90 seconds in that environment. The same matrix passes in about 14 seconds on Windows. On the central Linux host, the complete patched suite passed 285/285 files and 1704/1704 tests; its JSON and text full-matrix cases completed in about 16.7 and 15.6 seconds respectively under local 30-second budgets.
- `npm ci` reports 22 existing dependency advisories: 1 low, 4 moderate, 13 high, and 4 critical. No automatic audit fix was applied because it would alter the lockfile outside this task.
