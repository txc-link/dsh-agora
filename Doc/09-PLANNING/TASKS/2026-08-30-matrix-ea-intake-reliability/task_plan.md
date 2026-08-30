# Matrix EA intake reliability

## Goal

Make the human Matrix slash-command path reliably create an Executive Assistant request, dispatch it through the organization model, and always return an actionable receipt or error.

## Scope

- Agora REST accepts ISO-8601 due times with an explicit UTC offset.
- `dsh-matrix-connector` does not reuse a DSH node id as a Core project id for organization requests.
- Matrix command failures are returned to the room instead of becoming silent log-only failures.
- Real Matrix → connector → Core → organization/runtime dispatch smoke coverage.

## Plan

1. Pin the three failures with tests.
2. Implement the smallest adapter/Core corrections.
3. Run strict/unit gates in both repositories.
4. Deploy the connector and Core changes.
5. Re-run read-only commands, valid intake, invalid intake, deduplication, and task-status checks.

## Workspace

- Agora repository: `E:/Learn AI Agent/dsh-agora`, branch `master`.
- Connector repository: `E:/Learn AI Agent/dsh-matrix-connector`, branch `main`.
- No new worktree: this is a continuation of the same live Element/Company OS deployment session, the connector tree is clean, and the Agora tree only contains related uncommitted operator-sample documentation that must be preserved.

## SSoT

- `Doc/Agora-实施排期-Agora-TS.md` change log.
- Walkthrough: `Doc/10-WALKTHROUGH/2026-08-30-matrix-ea-intake-reliability.md`.

