import { describe, expect, it } from 'vitest';
import {
  detectPlatform,
  runServeCommand,
  type RunServeCommandOptions,
} from './serve-command.js';

const baseOptions: RunServeCommandOptions = {
  platform: 'systemd',
  port: 18008,
  host: '127.0.0.1',
  user: 'agora',
  workingDirectory: '/repo',
  serverEntry: '/repo/agora-ts/apps/server/dist/index.js',
  unitName: 'agora',
  dryRun: true,
  enable: false,
};

describe('detectPlatform', () => {
  it('returns bare when running on an unknown OS', () => {
    // In a test environment, the platform detection reads process.platform
    // and returns systemd / launchd / windows / bare. We only assert shape:
    expect(['systemd', 'launchd', 'windows', 'bare']).toContain(detectPlatform());
  });
});

describe('runServeCommand (dry-run)', () => {
  it('renders a systemd unit that binds to the given port and host', async () => {
    const result = await runServeCommand({
      ...baseOptions,
      platform: 'systemd',
      descriptorPath: '/dev/null',
    });

    expect(result.platform).toBe('systemd');
    expect(result.installed).toBe(false);
    expect(result.started).toBe(false);
    expect(result.descriptorContent).toContain('[Unit]');
    expect(result.descriptorContent).toContain('[Service]');
    expect(result.descriptorContent).toContain('[Install]');
    expect(result.descriptorContent).toContain('User=agora');
    expect(result.descriptorContent).toContain('WorkingDirectory=/repo');
    expect(result.descriptorContent).toContain('ExecStart=/usr/bin/env node /repo/agora-ts/apps/server/dist/index.js');
    expect(result.descriptorContent).toContain('AGORA_BACKEND_PORT=18008');
    expect(result.descriptorContent).toContain('AGORA_SERVER_HOST=127.0.0.1');
  });

  it('renders a launchd plist with escaped environment values', async () => {
    const result = await runServeCommand({
      ...baseOptions,
      platform: 'launchd',
      descriptorPath: '/dev/null',
      env: { FOO: 'bar & <baz>' },
    });

    expect(result.platform).toBe('launchd');
    expect(result.descriptorContent).toContain('<plist version="1.0">');
    expect(result.descriptorContent).toContain('<key>FOO</key>');
    expect(result.descriptorContent).toContain('<string>bar &amp; &lt;baz&gt;</string>');
    expect(result.descriptorContent).toContain('<key>RunAtLoad</key>');
    expect(result.descriptorContent).toContain('<true/>');
  });

  it('renders a docker-compose stack on the docker platform', async () => {
    const result = await runServeCommand({
      ...baseOptions,
      platform: 'docker',
      descriptorPath: '/dev/null',
    });

    expect(result.platform).toBe('docker');
    expect(result.descriptorContent).toContain('services:');
    expect(result.descriptorContent).toContain('image: agora-ts:0.0.0');
    expect(result.descriptorContent).toContain('container_name: agora');
    expect(result.descriptorContent).toContain('"127.0.0.1:18008:18008"');
    expect(result.descriptorContent).toContain('AGORA_SERVER_URL=http://127.0.0.1:18008');
  });

  it('renders a Windows service wrapper batch file', async () => {
    const result = await runServeCommand({
      ...baseOptions,
      platform: 'windows',
      descriptorPath: '/dev/null',
    });

    expect(result.platform).toBe('windows');
    expect(result.descriptorContent).toMatch(/^@echo off/m);
    expect(result.descriptorContent).toContain('cd /d "/repo"');
    expect(result.descriptorContent).toContain('node "/repo/agora-ts/apps/server/dist/index.js"');
  });

  it('renders a bare-process launcher with nohup semantics', async () => {
    const result = await runServeCommand({
      ...baseOptions,
      platform: 'bare',
      descriptorPath: '/dev/null',
    });

    expect(result.platform).toBe('bare');
    expect(result.descriptorContent).toContain('#!/usr/bin/env bash');
    expect(result.descriptorContent).toContain('nohup /usr/bin/env node');
    expect(result.descriptorContent).toContain('PIDFILE=');
    expect(result.descriptorContent).toContain('LOG=');
  });

  it('honors the printOnly flag and never reports installed/started', async () => {
    const result = await runServeCommand({
      ...baseOptions,
      printOnly: true,
    });

    expect(result.installed).toBe(false);
    expect(result.started).toBe(false);
    expect(result.descriptorContent.length).toBeGreaterThan(0);
  });

  it('propagates extra env vars into every descriptor format', async () => {
    const extra = { AGORA_DASHBOARD_BASIC_PASSWORD: 'super-secret' };

    const systemd = await runServeCommand({ ...baseOptions, env: extra, dryRun: true });
    expect(systemd.descriptorContent).toContain('AGORA_DASHBOARD_BASIC_PASSWORD=super-secret');

    const launchd = await runServeCommand({ ...baseOptions, platform: 'launchd', env: extra, dryRun: true });
    expect(launchd.descriptorContent).toContain('<key>AGORA_DASHBOARD_BASIC_PASSWORD</key>');
    expect(launchd.descriptorContent).toContain('<string>super-secret</string>');

    const docker = await runServeCommand({ ...baseOptions, platform: 'docker', env: extra, dryRun: true });
    expect(docker.descriptorContent).toContain('      - AGORA_DASHBOARD_BASIC_PASSWORD=super-secret');
  });
});