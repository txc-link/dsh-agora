# Matrix EA intake reliability walkthrough

## Result

The Element path now works end to end: a human sends an explicit `/agora`
command, the central assistant creates a durable Executive Assistant request,
the organization assigns a resident worker, Core tracks the task and
commitment, and Element receives a downloadable Markdown artifact.

Use the unencrypted `AI学习` room under the `公司团队` Space. The former room is
named `AI学习（旧·加密）`; it contains no bots and should only be retained as old
human-visible history.

## Daily task flow

Send a research request:

```text
/agora assistant ask --capability research --priority normal --due 2026-09-02T18:00:00+08:00 调研主题；说明目标、范围、交付物和判断标准。
```

The receipt returns a request id, task id, assigned position, and commitment.
Use those ids for the remaining steps:

```text
/agora assistant show <request-id>
/agora task <task-id> artifacts
/agora artifact <artifact-id>
```

The final command sends a standard Matrix file event, so Element displays a
normal downloadable attachment instead of an `mxc://` string.

## Safe interaction rules

- Ordinary room messages never create tasks. Commands must start with one
  literal `/agora`; do not type a doubled slash.
- Invalid syntax and invalid due dates return a visible error receipt.
- Due times accept ISO-8601 offsets such as `2026-09-02T18:00:00+08:00`.
- Company rooms contain the central assistant only. Direct node rooms are for
  diagnostics and return one response from their named node.
- Do not put health, intimate, financial, family, or companion material in a
  Company Space room. Personal Life, Health, and Companion are independent
  top-level projections and currently contain no company bots.
- Do not enable E2EE on a bot operations room until the connector has a durable
  crypto store and a tested key-recovery procedure. Matrix encryption cannot
  be disabled after room creation.

## Verified production scenarios

| Scenario | Expected result | Live result |
| --- | --- | --- |
| Ordinary conversation | no bot reply | 0 replies |
| `/agora im health` | one central reply | `health: ok` |
| Unknown command | actionable error | one error receipt |
| Invalid `--due` | validation error, no Core request | passed |
| Organization query | current departments/employments | passed |
| EA research intake | durable request/task/commitment | passed |
| Task status | completed request and done task | passed |
| Artifact list | durable task-owned artifact | passed |
| Artifact download | Element `m.file` attachment | passed |
| Three node health checks | one response per node room | passed |
| Life/Health/Companion isolation | zero company bots | passed |
| Restart recovery | rooms and nodes recover | passed |

## Release evidence

- `dsh-agora` `9393984`: accept offset EA due times.
- `dsh-agora` `993f8be`: recursively redact secrets from runtime results before persistence.
- `dsh-matrix-connector` `0.3.2`–`0.3.5`: reliable intake, command isolation, durable artifacts, and native files.
- `dsh-matrix-connector` `0.3.6` (`0a45ce2`): wait for initial sync and track Space child state on `Room.currentState`.
- `dsh-matrix-connector` `0.3.7` (`c767fb5`): revoke a room immediately when its `m.space.child` state is cleared.
- Connector suite: 237/237 passing; connector `0.3.7` is deployed on Windows, macOS, and Linux.

The package source and version are pushed to GitHub. Publishing `0.3.6` to the
public npm registry still requires an authenticated npm maintainer session;
all three deployed nodes currently use the verified local tarball build.
