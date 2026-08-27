# dsh-im 2.1.0 Agora bridge patch

`@xmanrui/dsh-im@2.1.0.patch` is the exact patch installed in the `web` DSH profile with `pnpm patch-commit`.

It adds the public, token-free `dsh-im.bridge/v1` Cordis service used by `dsh-agora`:

- safe bot identity and online capability discovery;
- DSH Session to IM conversation/thread route observation;
- idempotent proactive delivery through a selected bot;
- Discord outbound delivery without accepting bot-authored inbound messages.

The patch includes the rebuilt official `lib/index.js`, so the target host does not need dsh-im development dependencies. Apply it only to the exact package version shown in the filename. A dsh-im upgrade requires regenerating and reviewing the patch against the new upstream source.

The active server profile stores the same patch at:

```text
/root/.dsh/profiles/web/patches/@xmanrui__dsh-im@2.1.0.patch
```

and declares it under `patchedDependencies` in the profile's `pnpm-workspace.yaml` (the supported location in pnpm 11). `/usr/local/bin/pnpm install --frozen-lockfile` therefore reproduces the patched installation with the same pnpm major version used by DSH.
