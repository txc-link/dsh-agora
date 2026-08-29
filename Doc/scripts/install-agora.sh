#!/usr/bin/env bash
# install-agora.sh — one-line Agora installer.
#
# Wraps `agora init --non-interactive` + `agora serve` into a single command
# suitable for first-time installation on a fresh machine / CI runner / Docker
# layer. Detects the host OS and dispatches to the right agora CLI subcommand.
#
# Usage:
#   curl -sSL https://agora.dev/install.sh | bash -s -- \
#     --admin-password "$(openssl rand -base64 16)"
#
#   AGORA_ADMIN_PASSWORD=... ./install-agora.sh
#
#   ./install-agora.sh --admin-password-stdin < my-secret.txt
#
#   ./install-agora.sh --platform docker --port 8080
#
# Exit codes:
#   0 = installed and started
#   1 = generic failure
#   2 = invalid arguments
#   3 = agora CLI not on PATH (see "Prerequisites")
#
# Prerequisites:
#   - `agora` CLI on PATH (run `npm i -g @agora-ts/cli` after build, or use
#     the `npm run cli:install-global` script from this repo).
#   - For --platform systemd: root (or sudo); systemctl available.
#   - For --platform launchd: launchctl available (macOS).
#   - For --platform windows: sc.exe available; run from elevated shell.
#   - For --platform docker: docker compose available.
#   - For --platform bare: bash + nohup (Linux/macOS) or any POSIX shell.
#
# Security:
#   - --admin-password echoes the password into the agora config; shell
#     history will contain it. Use --admin-password-stdin in CI / production.
#   - The default install echoes a cleartext "ready" line with the listen URL
#     but does NOT echo the admin password.

set -euo pipefail

# ---- defaults --------------------------------------------------------------
ADMIN_USERNAME="admin"
ADMIN_PASSWORD=""
ADMIN_PASSWORD_FROM_STDIN=0
PLATFORM_OVERRIDE=""
PORT=18008
HOST="127.0.0.1"
UNIT_NAME="agora"
SERVER_ENTRY=""
WORKING_DIRECTORY=""
SKIP_ASSETS=0
ENABLE_SERVICE=1
INIT_ONLY=0
SERVE_ONLY=0
AGORA_BIN="${AGORA_BIN:-agora}"

# ---- helpers ---------------------------------------------------------------
log() { echo "[install-agora] $*" >&2; }
fail() { log "ERROR: $*"; exit "${EXIT_CODE:-1}"; }

usage() {
  cat >&2 <<'USAGE'
Usage: install-agora.sh [options]

Options:
  --admin-username <name>       Admin username (default: admin)
  --admin-password <pwd>        Admin password (must be ≥8 chars)
  --admin-password-stdin        Read admin password from stdin
  --platform <systemd|launchd|windows|docker|bare>
                                Override platform detection
  --port <port>                 Listen port (default: 18008)
  --host <host>                 Bind host (default: 127.0.0.1)
  --unit-name <name>            OS service name (default: agora)
  --server-entry <path>         Override server entry path
  --working-directory <path>    Override server working directory (default: cwd)
  --skip-assets                 Skip ensureBundledAgoraAssetsInstalled
  --no-enable                   Write descriptor but do not start the service
  --init-only                   Only run agora init; do not install service
  --serve-only                  Only run agora serve; skip init
  --agora-bin <path>            Path to agora CLI (default: agora on PATH)
  -h | --help                   Print this help

Environment:
  AGORA_ADMIN_PASSWORD          Same as --admin-password
  AGORA_ADMIN_USERNAME          Same as --admin-username
  AGORA_BIN                     Same as --agora-bin
  AGORA_PLATFORM                Same as --platform
USAGE
  exit 2
}

detect_platform() {
  case "$(uname -s)" in
    Linux*)   echo "systemd" ;;
    Darwin*)  echo "launchd" ;;
    MINGW*|MSYS*|CYGWIN*) echo "windows" ;;
    *)        echo "bare" ;;
  esac
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "required command not found: $1"
  fi
}

# ---- argument parsing ------------------------------------------------------
while [ $# -gt 0 ]; do
  case "$1" in
    --admin-username)    ADMIN_USERNAME="$2"; shift 2 ;;
    --admin-password)    ADMIN_PASSWORD="$2"; shift 2 ;;
    --admin-password-stdin) ADMIN_PASSWORD_FROM_STDIN=1; shift ;;
    --platform)          PLATFORM_OVERRIDE="$2"; shift 2 ;;
    --port)              PORT="$2"; shift 2 ;;
    --host)              HOST="$2"; shift 2 ;;
    --unit-name)         UNIT_NAME="$2"; shift 2 ;;
    --server-entry)      SERVER_ENTRY="$2"; shift 2 ;;
    --working-directory) WORKING_DIRECTORY="$2"; shift 2 ;;
    --skip-assets)       SKIP_ASSETS=1; shift ;;
    --no-enable)         ENABLE_SERVICE=0; shift ;;
    --init-only)         INIT_ONLY=1; shift ;;
    --serve-only)        SERVE_ONLY=1; shift ;;
    --agora-bin)         AGORA_BIN="$2"; shift 2 ;;
    -h|--help) usage ;;
    *) fail "unknown argument: $1" ;;
  esac
done

# Env-var fallback (matches AGORA_DASHBOARD_BASIC_PASSWORD-style convention).
if [ -z "${ADMIN_PASSWORD:-}" ] && [ -n "${AGORA_ADMIN_PASSWORD:-}" ]; then
  ADMIN_PASSWORD="$AGORA_ADMIN_PASSWORD"
fi
if [ "${ADMIN_USERNAME:-admin}" = "admin" ] && [ -n "${AGORA_ADMIN_USERNAME:-}" ]; then
  ADMIN_USERNAME="$AGORA_ADMIN_USERNAME"
fi
if [ -z "${PLATFORM_OVERRIDE:-}" ] && [ -n "${AGORA_PLATFORM:-}" ]; then
  PLATFORM_OVERRIDE="$AGORA_PLATFORM"
fi

if [ "${ADMIN_PASSWORD_FROM_STDIN}" = "1" ]; then
  ADMIN_PASSWORD="$(cat)"
fi

# ---- validate --------------------------------------------------------------
if [ -z "${ADMIN_PASSWORD:-}" ] && [ "${SERVE_ONLY}" = "0" ]; then
  fail "--admin-password (or AGORA_ADMIN_PASSWORD env, or --admin-password-stdin) is required"
fi
if [ "${ADMIN_PASSWORD:+set}" = "set" ] && [ "${#ADMIN_PASSWORD}" -lt 8 ] && [ "${SERVE_ONLY}" = "0" ]; then
  fail "--admin-password must be at least 8 characters"
fi
if [ "${INIT_ONLY}" = "1" ] && [ "${SERVE_ONLY}" = "1" ]; then
  fail "--init-only and --serve-only are mutually exclusive"
fi

require_cmd "${AGORA_BIN}"

PLATFORM="${PLATFORM_OVERRIDE:-$(detect_platform)}"
log "detected platform: ${PLATFORM}"

# ---- agora init (CI / first-time onboarding) -------------------------------
if [ "${SERVE_ONLY}" = "0" ]; then
  log "running agora init (non-interactive)"
  INIT_ARGS=(
    init
    --non-interactive
    "--admin-username=${ADMIN_USERNAME}"
    "--admin-password=${ADMIN_PASSWORD}"
    "--im=none"
  )
  if [ "${SKIP_ASSETS}" = "1" ]; then
    INIT_ARGS+=("--skip-assets")
  fi
  "${AGORA_BIN}" "${INIT_ARGS[@]}"
fi

# ---- agora serve (cross-platform OS service install) ------------------------
if [ "${INIT_ONLY}" = "0" ]; then
  log "running agora serve (platform=${PLATFORM})"
  SERVE_ARGS=(
    serve
    "--platform=${PLATFORM}"
    "--port=${PORT}"
    "--host=${HOST}"
    "--unit-name=${UNIT_NAME}"
  )
  if [ -n "${SERVER_ENTRY:-}" ]; then
    SERVE_ARGS+=("--server-entry=${SERVER_ENTRY}")
  fi
  if [ -n "${WORKING_DIRECTORY:-}" ]; then
    SERVE_ARGS+=("--working-directory=${WORKING_DIRECTORY}")
  fi
  if [ "${ENABLE_SERVICE}" = "0" ]; then
    SERVE_ARGS+=("--no-enable")
  fi
  "${AGORA_BIN}" "${SERVE_ARGS[@]}"
fi

# ---- summary ---------------------------------------------------------------
log "agora ready"
log "  listen URL: http://${HOST}:${PORT}"
log "  admin user: ${ADMIN_USERNAME}"
log "  dashboard:  http://${HOST}:${PORT}/dashboard/  (login with ${ADMIN_USERNAME})"
if [ "${INIT_ONLY}" = "0" ]; then
  log "  service:    ${PLATFORM} unit '${UNIT_NAME}'"
fi