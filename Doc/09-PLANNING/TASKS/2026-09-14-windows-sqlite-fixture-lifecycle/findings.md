# Findings

## Initial evidence

- The full Windows suite previously reported 233 failures concentrated around temporary SQLite fixtures.
- Focused fixes that explicitly call `db.close()` pass, which points to fixture ownership rather than SQLite query semantics.
- `better-sqlite3` keeps the database file open until `close()`; Windows refuses recursive removal while the handle remains open, whereas Linux commonly allows unlinking an open file.

## Constraints

- Production database lifetime must remain owned by the application composition root.
- The fix belongs in tests or testing helpers, not in Agora Core semantics.
- Dependency advisories are a separate change stream.

## Root cause

- Test helpers created `node:sqlite` `DatabaseSync` handles but several callers
  removed their temporary directories without closing those handles.
- Linux permits unlinking many open files, so the ownership bug was masked there.
  Windows correctly returned `EPERM` while the SQLite database or WAL handle was
  still open.
- Some tests launch detached IM provisioning work. Closing immediately in a
  global `afterEach` races that work, so the harness yields one event-loop turn
  before closing any remaining handles.
- The first Linux full-suite attempt exposed a fake-timer interaction: reading
  global `setImmediate` inside `afterEach` deadlocked when a test left fake
  timers active. The setup now imports and captures Node's native timer before
  test code can replace globals, with a dedicated regression case.

## Implemented seam

- `observeAgoraDatabases()` reports new handles without transferring production
  ownership. Production installs no observer.
- The Vitest setup tracks handles, makes fixture closes idempotent, and closes
  leaked fixtures in LIFO order before test-local directory cleanup hooks.
- Tests whose helper deletes a directory inside its own `finally` block still
  close the explicit fixture first; the global harness is the final safety net.

## Windows verification evidence

- Original focused reproduction: 3 files, 35 failures, all at temporary SQLite
  directory removal.
- After the fix: the same 3 files pass 35/35; task-service background-work sample
  passes 3/3 without post-test database warnings; explicit-cleanup sample passes
  24/24 across 7 files.
- `npm run build`, `npm run lint`, and `npm run typecheck` pass on Windows.
- Full suite was split into four shards. Completed shards 2, 3, and 4 reported
  no SQLite file-lock failures. Their remaining 29 failures are unrelated Windows
  portability cases: POSIX path expectations, shell wrappers, Nomos path guards,
  symlink permission, ports, and fixture lookup. Shard 1 did not terminate after
  producing only progress output and was stopped; this is recorded rather than
  counted as a pass.

## Linux strict verification

- The final isolated Linux worktree passed `npm run check`: architecture and
  barrel governance gates, lint, build, typecheck, and all 286 test files.
- Final test result: 1706/1706 passed with no skips or failures.
- A first full-suite run exposed one intentional suite-scoped CLI database. Its
  fixture now creates and closes a fresh database per test, preserving the
  per-test ownership rule instead of weakening the global cleanup safety net.

## Out of scope follow-ups

- Normalize remaining Windows path assertions and Nomos containment checks.
- Replace or skip Unix-only shell/symlink tests on Windows with equivalent native
  coverage.
- Diagnose the shard-1 child-process hang independently.
- Upgrade advisory-bearing dependencies in a separate PR.
