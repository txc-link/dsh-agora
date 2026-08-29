#!/usr/bin/env bash
# build-contracts.sh — build @agora-ts/contracts dist so dashboard (vite/vitest) can resolve it.
#
# Why this exists
# ===============
# dashboard/vite.config.ts aliases `@agora-ts/contracts` to the BUILT dist
# (`../agora-ts/packages/contracts/dist/index.js`), NOT the source.
#
# Rationale: the contracts source imports `zod`, but the contracts package has no
# `node_modules/` of its own (it relies on the workspace root). When vite/vitest
# tries to walk up from a contracts source file to resolve `zod`, the resolver
# walks out of `agora-ts/` before finding any `node_modules/`, so `zod` resolution
# fails and every import path explodes.
#
# Building contracts first emits `.d.ts` declarations into `dist/`; vite reads
# declarations instead of source, so `zod` resolve never triggers.
#
# When to run
# ===========
# - Once per worktree, after `git worktree add`.
# - After any change to `agora-ts/packages/contracts/src/`.
#
# Side effects
# ============
# - Installs zod into `agora-ts/packages/contracts/node_modules/`.
# - Writes `agora-ts/packages/contracts/dist/` (gitignored, never committed).
#
# Usage
# =====
#   bash dashboard/scripts/build-contracts.sh
#
# Or via package.json:
#   npm --prefix dashboard run dashboard:setup

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONTRACTS_DIR="${REPO_ROOT}/agora-ts/packages/contracts"
NPM_CACHE="${NPM_CACHE:-${REPO_ROOT}/.npm-cache-install}"

if [ ! -d "${CONTRACTS_DIR}" ]; then
  echo "ERROR: contracts dir not found: ${CONTRACTS_DIR}" >&2
  echo "  Are you running this from a git worktree of the dsh-agora superproject?" >&2
  exit 2
fi

echo "==> Contracts dir: ${CONTRACTS_DIR}"
echo "==> npm cache:     ${NPM_CACHE}"

# Install contracts deps (zod). NODE_ENV=production hides devDeps in npm by default
# in this sandbox, so always force --include=dev here.
cd "${CONTRACTS_DIR}"
echo "==> npm install --include=dev"
NODE_ENV=development npm install --include=dev --cache "${NPM_CACHE}" >/dev/null

echo "==> npm run build"
NODE_ENV=development npm run build >/dev/null

if [ ! -f "dist/index.js" ]; then
  echo "ERROR: dist/index.js not produced by build. Build script may have failed silently." >&2
  exit 3
fi

echo "==> Contracts dist ready: ${CONTRACTS_DIR}/dist/"
