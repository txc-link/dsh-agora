# 2026-08-29 — dsh-matrix-connector v0.2b: citizen routing

## Outcome

| | |
|---|---|
| Goal | `/agora dispatch @<citizen> <prompt>` lets the user pin a task to a specific citizen |
| Scope | plugin-side only; agora central schema already supported `team_override` |
| Commit | `1e3354c` → merged `c4bff9e` on master |
| Worktree | `.worktrees/feat-v02b-citizen-routing/` — created, used, removed |

## Why this is so small

Turn 31-32 already discovered that the agora central `createTaskRequestSchema`
exposes `team_override.members[]` with `agentId` + `member_kind`. v0.1.1 simply
didn't fill it. v0.2b is the missing bridge between the slash command and the
already-present schema — no Core change, no new contract.

## What changed

### `src/dispatch-args.ts` (new)
Pure function `parseDispatchArgs(args)`:

```
['@code-reviewer', '帮我', 'PR']
  → { citizen_id: 'code-reviewer', prompt: '帮我 PR' }   (case 1, explicit)

['code-reviewer', '帮我', 'PR']
  → { citizen_id: 'code-reviewer', prompt: '帮我 PR' }   (case 2, bare-word)

['帮我', 'PR']
  → { citizen_id: undefined,    prompt: '帮我 PR' }     (case 3, plain)
```

Case 3 keeps v0.1.1 behavior intact.

### `src/bridges.ts` — DispatchBridge.dispatch()
When `citizen_id` is set, fills `team_override.members[0]`:

```ts
{
  role: 'executor',
  agentId: '<citizen_id>',
  member_kind: 'citizen',
  model_preference: ''
}
```

Placeholder gains `→ @<citizen>` suffix so the user sees who they pinned to.

### `src/agora-rest.ts` — CreateTaskInput
Adds optional `team_override` to the type so the call type-checks.

### Tests
- `tests/dispatch-bridge.test.mjs` — 5 unit tests for parseDispatchArgs
- `tests/bridges.test.mjs` — updated existing test (Chinese prompt to avoid
  the bare-word fallback ambiguity) + new @mention dispatch test
- `tests/plugin-flow.test.mjs` — adds `streamEvents` to the agora mock
  (the v0.2 follow-up already needed it; left over from that work)

## Verification

- **55/55 unit tests green** (was 49/49 + 5 new + 1 updated)
- **Typecheck clean** (`tsc -p tsconfig.build.json`)
- **Real smoke** (`tests/smoke-v02b-citizen-routing.mjs`):

  ```
  == smoke-v02b-citizen-routing ==
  target citizen_id: smoke-v02b-1787934650610
  task_id: OC-1787934650636
  response.team.members[0]: {
    "role": "executor",
    "agentId": "smoke-v02b-1787934650610",   ← pin confirmed
    "member_kind": "citizen",
    ...
  }
  OK smoke-v02b-citizen-routing passed.
  ```

- **§1 boundary preserved** — `task.threadKey` and `task.actor` are not
  echoed in the response (asserted in smoke). agora central never sees
  the IM thread.

## What is NOT in v0.2b

- Multi-agent teams (`team_override.members.length > 1`)
- Fuzzy citizen name matching ("reviewer" → "code-reviewer")
- Default fallback when the citizen doesn't exist
- Routing by role (e.g. `/agora dispatch @role:executor`)

These are deliberate omissions per §1.5 (shortest path).

## v0.3+ direction

The most natural next step is **per-room membership projection**: each Matrix
room maps to an agora `project_id`, and `/agora citizen list` returns the room's
member roster. That removes the friction of typing `@<id>` — users just
`/agora dispatch reviewer 帮我审 PR` and `reviewer` resolves against the room
roster. Held for v0.3.