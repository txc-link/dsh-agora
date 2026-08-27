# Versioned dsh-im Agora bridge patches

This directory contains reviewed pnpm patches for exact versions of the third-party `@xmanrui/dsh-im` package.

| Package | Patch |
| --- | --- |
| `@xmanrui/dsh-im@2.1.0` | `@xmanrui__dsh-im@2.1.0.patch` |
| `@xmanrui/dsh-im@2.3.0` | `@xmanrui__dsh-im@2.3.0.patch` |

Each patch adds the public, token-free `dsh-im.bridge/v1` Cordis service used by `dsh-agora`:

- safe Bot identity, connectivity, and capability discovery;
- DSH Session to IM conversation/thread route observation;
- idempotent proactive delivery through a selected Bot;
- Discord outbound delivery without accepting Bot-authored inbound messages.

The patches include a rebuilt upstream `lib/index.js`, so a target host does not need dsh-im development dependencies.

## Version rule

Apply a patch only to the exact package version in its filename. A dsh-im upgrade requires regenerating, reviewing, and testing a new patch. pnpm intentionally rejects a version mismatch.

## Installation

Pin dsh-im first, for example:

```bash
dsh plugin --profile web add @xmanrui/dsh-im@2.3.0
```

Copy the matching patch to the DSH profile:

```bash
PROFILE="${DSH_HOME:-$HOME/.dsh}/profiles/web"
mkdir -p "$PROFILE/patches"
cp @xmanrui__dsh-im@2.3.0.patch "$PROFILE/patches/"
```

Merge the matching declaration into `$PROFILE/pnpm-workspace.yaml` without removing existing `allowBuilds` or other patches:

```yaml
patchedDependencies:
  '@xmanrui/dsh-im@2.3.0': patches/@xmanrui__dsh-im@2.3.0.patch
```

Apply it and make the lockfile reproducible:

```bash
pnpm --dir "$PROFILE" install
pnpm --dir "$PROFILE" install --frozen-lockfile
```

Restart DSH, then verify the local snapshot:

```bash
curl -fsS -X POST http://127.0.0.1:3080/dsh-agora/api/snapshot \
  -H 'content-type: application/json' \
  -d '{}'
```

Expected bridge state:

```text
imBridge.state: connected
imBridge.protocol: dsh-im.bridge/v1
```

`dsh-im.command-gateway/v1` is a separate optional interface and is not added by these patches. Seeing `im.state: unavailable` together with a connected bridge is expected.

## Rebuilding a patch for a new dsh-im version

Use pnpm's patch workflow in an isolated profile or test project:

```bash
pnpm patch @xmanrui/dsh-im@<version>
# edit and rebuild the extracted package
pnpm patch-commit <path-printed-by-pnpm>
```

Review the resulting source and bundled diff, run the dsh-im build/package checks, apply it to a clean exact-version install, and run a real bridge smoke test before adding the artifact here.

Do not disable pnpm's build-script policy globally. If a reviewed dependency needs an install script, add only the exact package key under `allowBuilds`.
