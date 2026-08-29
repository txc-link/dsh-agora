/**
 * `agora serve` — install and start the agora-ts server as a managed OS service.
 *
 * Cross-platform. Detects the host platform and writes the native service
 * descriptor (systemd unit / launchd plist / Windows service / docker-compose
 * stack / bare-process launcher). Each platform ships its own happy path —
 * no compatibility / fallback layer (§1.5 hard rule).
 *
 * Companion to `agora start`:
 *   - `agora start`   = local dev helper (runs scripts/dev-start.sh)
 *   - `agora serve`   = production service install (writes OS-native descriptor)
 *
 * Supported platforms:
 *   - systemd (Linux: debian / ubuntu / rhel / fedora / arch / ...)
 *   - launchd (macOS)
 *   - windows (sc.exe; requires admin)
 *   - docker (docker compose managed)
 *   - bare (nohup-style launcher for read-only environments)
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { platform as osPlatform } from 'node:os';

export type ServePlatform = 'systemd' | 'launchd' | 'windows' | 'docker' | 'bare';

export interface RunServeCommandOptions {
  /** Platform override; auto-detected when omitted. */
  platform?: ServePlatform;
  /** Server listen port. Default 18008. */
  port?: number;
  /** Server bind host. Default 127.0.0.1. */
  host?: string;
  /** OS user to run the server as (systemd / bare). Default: current user. */
  user?: string;
  /** Server working directory. Default: process cwd. */
  workingDirectory?: string;
  /** Path to compiled server entry. Default: <workingDirectory>/agora-ts/apps/server/dist/index.js */
  serverEntry?: string;
  /** Service / unit / label name. Default: agora. */
  unitName?: string;
  /** Override the platform-default descriptor output path. */
  descriptorPath?: string;
  /** Override the platform-default log path. */
  logPath?: string;
  /** Override the platform-default pidfile path. */
  pidfilePath?: string;
  /** Auto-start the service after install. Default: true. */
  enable?: boolean;
  /** Extra environment variables to set in the service Environment= block. */
  env?: Record<string, string>;
  /** When true, do not execute any platform commands — just emit descriptors. */
  dryRun?: boolean;
  /**
   * When true, do not actually write the descriptor file — return what would
   * have been written. Useful for tests and for `agora serve --print`.
   */
  printOnly?: boolean;
}

export interface RunServeCommandResult {
  platform: ServePlatform;
  descriptorPath: string;
  descriptorContent: string;
  installed: boolean;
  started: boolean;
  message: string;
}

export async function runServeCommand(options: RunServeCommandOptions = {}): Promise<RunServeCommandResult> {
  const platform = options.platform ?? detectPlatform();
  const ctx = resolveServeContext(options);
  const descriptorContent = renderDescriptor(platform, ctx);

  if (options.printOnly || options.dryRun) {
    return {
      platform,
      descriptorPath: ctx.descriptorPath,
      descriptorContent,
      installed: false,
      started: false,
      message: `dry-run: would write ${platform} descriptor to ${ctx.descriptorPath}`,
    };
  }

  mkdirSync(dirname(ctx.descriptorPath), { recursive: true });
  writeFileSync(ctx.descriptorPath, descriptorContent, { mode: 0o644 });

  if (options.enable !== false) {
    await startPlatformService(platform, ctx);
  }

  return {
    platform,
    descriptorPath: ctx.descriptorPath,
    descriptorContent,
    installed: true,
    started: options.enable !== false,
    message: `${platform} service ${ctx.unitName} installed at ${ctx.descriptorPath}${options.enable !== false ? ' and started' : ''}`,
  };
}

interface ServeContext {
  platform: ServePlatform;
  port: number;
  host: string;
  user: string;
  workingDirectory: string;
  serverEntry: string;
  unitName: string;
  descriptorPath: string;
  logPath: string;
  pidfilePath: string;
  env: Record<string, string>;
}

export function detectPlatform(): ServePlatform {
  const p = osPlatform();
  if (p === 'linux') return 'systemd';
  if (p === 'darwin') return 'launchd';
  if (p === 'win32') return 'windows';
  return 'bare';
}

function resolveServeContext(options: RunServeCommandOptions): ServeContext {
  const platform = options.platform ?? detectPlatform();
  const port = options.port ?? 18008;
  const host = options.host ?? '127.0.0.1';
  const user = options.user ?? process.env.USER ?? process.env.USERNAME ?? 'agora';
  const workingDirectory = options.workingDirectory ?? process.cwd();
  const serverEntry = options.serverEntry
    ?? join(workingDirectory, 'agora-ts', 'apps', 'server', 'dist', 'index.js');
  const unitName = options.unitName ?? 'agora';
  const env: Record<string, string> = {
    NODE_ENV: 'production',
    AGORA_SERVER_HOST: host,
    AGORA_BACKEND_PORT: String(port),
    AGORA_SERVER_URL: `http://${host}:${port}`,
    ...(options.env ?? {}),
  };

  const descriptorPath = options.descriptorPath
    ?? defaultDescriptorPath(platform, unitName, workingDirectory);
  const logPath = options.logPath ?? join(workingDirectory, `.agora-serve.${unitName}.log`);
  const pidfilePath = options.pidfilePath ?? join(workingDirectory, `.agora-serve.${unitName}.pid`);

  return {
    platform,
    port,
    host,
    user,
    workingDirectory,
    serverEntry,
    unitName,
    descriptorPath,
    logPath,
    pidfilePath,
    env,
  };
}

function defaultDescriptorPath(platform: ServePlatform, unitName: string, workingDirectory: string): string {
  switch (platform) {
    case 'systemd':
      return `/etc/systemd/system/${unitName}.service`;
    case 'launchd':
      return join(process.env.HOME ?? '~', 'Library', 'LaunchAgents', `${unitName}.plist`);
    case 'windows':
      return join(workingDirectory, `${unitName}.service.cmd`);
    case 'docker':
      return join(workingDirectory, `agora-${unitName}.docker-compose.yml`);
    case 'bare':
      return join(workingDirectory, `.agora-serve.${unitName}.sh`);
    default: {
      const _exhaustive: never = platform;
      throw new Error(`unsupported platform: ${String(_exhaustive)}`);
    }
  }
}

function renderDescriptor(platform: ServePlatform, ctx: ServeContext): string {
  switch (platform) {
    case 'systemd':
      return renderSystemdUnit(ctx);
    case 'launchd':
      return renderLaunchdPlist(ctx);
    case 'windows':
      return renderWindowsWrapper(ctx);
    case 'docker':
      return renderDockerCompose(ctx);
    case 'bare':
      return renderBareScript(ctx);
    default: {
      const _exhaustive: never = platform;
      throw new Error(`unsupported platform: ${String(_exhaustive)}`);
    }
  }
}

function renderSystemdUnit(ctx: ServeContext): string {
  const envLines = Object.entries(ctx.env)
    .map(([k, v]) => `Environment=${k}=${v}`)
    .join('\n');
  return `[Unit]
Description=Agora multi-agent coordination server
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
User=${ctx.user}
WorkingDirectory=${ctx.workingDirectory}
${envLines}
ExecStart=/usr/bin/env node ${ctx.serverEntry}
Restart=on-failure
RestartSec=3
TimeoutStopSec=20
KillSignal=SIGTERM
StandardOutput=append:${ctx.logPath}
StandardError=append:${ctx.logPath}

[Install]
WantedBy=multi-user.target
`;
}

function renderLaunchdPlist(ctx: ServeContext): string {
  const envEntries = Object.entries(ctx.env)
    .map(([k, v]) => `    <key>${escapeXml(k)}</key>\n    <string>${escapeXml(v)}</string>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${ctx.unitName}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>${escapeXml(ctx.serverEntry)}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${escapeXml(ctx.workingDirectory)}</string>
  <key>EnvironmentVariables</key>
  <dict>
${envEntries}
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
    <key>Crashed</key>
    <true/>
  </dict>
  <key>StandardOutPath</key>
  <string>${escapeXml(ctx.logPath)}</string>
  <key>StandardErrorPath</key>
  <string>${escapeXml(ctx.logPath)}</string>
</dict>
</plist>
`;
}

function renderDockerCompose(ctx: ServeContext): string {
  return `services:
  ${ctx.unitName}:
    image: agora-ts:0.0.0
    container_name: ${ctx.unitName}
    restart: unless-stopped
    working_dir: ${ctx.workingDirectory}
    environment:
${Object.entries(ctx.env).map(([k, v]) => `      - ${k}=${v}`).join('\n')}
    ports:
      - "${ctx.host}:${ctx.port}:${ctx.port}"
    volumes:
      - ${ctx.workingDirectory}/agora-data:/agora-data
      - ${ctx.logPath}:${ctx.logPath}
`;
}

function renderBareScript(ctx: ServeContext): string {
  const envExport = Object.entries(ctx.env)
    .map(([k, v]) => `export ${k}="${v.replace(/"/g, '\\"')}"`)
    .join('\n');
  return `#!/usr/bin/env bash
# ${ctx.unitName} — managed bare-process launcher (nohup-style).
# Generated by agora serve --platform bare on ${new Date().toISOString()}.
set -euo pipefail

LOG="${ctx.logPath}"
PIDFILE="${ctx.pidfilePath}"
ENTRY="${ctx.serverEntry}"
CWD="${ctx.workingDirectory}"

mkdir -p "$(dirname "$LOG")" "$(dirname "$PIDFILE")"

${envExport}

if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  echo "agora already running with pid $(cat "$PIDFILE")" >&2
  exit 1
fi

cd "$CWD"
nohup /usr/bin/env node "$ENTRY" >>"$LOG" 2>&1 &
PID=$!
echo "$PID" >"$PIDFILE"
echo "agora started with pid $PID, logging to $LOG"
`;
}

function renderWindowsWrapper(ctx: ServeContext): string {
  const envLines = Object.entries(ctx.env)
    .map(([k, v]) => `set ${k}=${v}`)
    .join('\r\n');
  return `@echo off
REM ${ctx.unitName} — wrapper script for Windows Service (sc.exe).
REM Generated by agora serve --platform windows on ${new Date().toISOString()}.
cd /d "${ctx.workingDirectory}"
${envLines}
node "${ctx.serverEntry}"
`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function startPlatformService(platform: ServePlatform, ctx: ServeContext): Promise<void> {
  switch (platform) {
    case 'systemd':
      await execOrThrow('systemctl', ['daemon-reload']);
      await execOrThrow('systemctl', ['enable', ctx.unitName]);
      await execOrThrow('systemctl', ['start', ctx.unitName]);
      return;
    case 'launchd':
      await execOrThrow('launchctl', ['load', '-w', ctx.descriptorPath]);
      await execOrThrow('launchctl', ['start', ctx.unitName]);
      return;
    case 'windows':
      await execOrThrow('sc', [
        'create',
        ctx.unitName,
        `binPath= "${ctx.descriptorPath}"`,
        'start= auto',
        'DisplayName= Agora Coordination Server',
      ]);
      await execOrThrow('sc', ['start', ctx.unitName]);
      return;
    case 'docker':
      await execOrThrow('docker', ['compose', '-f', ctx.descriptorPath, 'up', '-d']);
      return;
    case 'bare':
      await execOrThrow('bash', [ctx.descriptorPath]);
      return;
    default: {
      const _exhaustive: never = platform;
      throw new Error(`unsupported platform: ${String(_exhaustive)}`);
    }
  }
}

function execOrThrow(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolveExec, rejectExec) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf8'); });
    child.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf8'); });
    child.on('error', (error) => rejectExec(error));
    child.on('close', (code) => {
      if (code === 0) {
        resolveExec({ stdout, stderr });
      } else {
        rejectExec(new Error(`${cmd} ${args.join(' ')} exited with code ${code}: ${stderr.trim()}`));
      }
    });
  });
}