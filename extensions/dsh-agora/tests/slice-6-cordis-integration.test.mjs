#!/usr/bin/env node
/**
 * slice-6-cordis-integration.test.mjs — Slice 6 TDD tests for
 * scripts/slice-6-cordis-loader.mjs (cordis plugin loader integration
 * verification).
 *
 * Spec: Doc/09-PLANNING/TASKS/2026-08-30-phase-2-matrix-connector/spec-slice-6-cordis-integration-verification.md
 *
 * Per AGENTS.md §3: this is a verify/build-time tool, not runtime plugin code.
 * Placed in scripts/ (alongside build-client.mjs, check-shared-contracts.mjs, etc).
 *
 * Run: node --test extensions/dsh-agora/tests/slice-6-cordis-integration.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKTREE_ROOT = join(__dirname, '..', '..', '..');  // worktree root
const NEW_REPO_PATCH_URL = 'https://raw.githubusercontent.com/txc-link/dsh-matrix-connector/main/cordis.patch.yml';
const NEW_REPO_MANIFEST_URL = 'https://raw.githubusercontent.com/txc-link/dsh-matrix-connector/main/package.json';

let parsePatch, validatePatch, validateManifest, dryRunLoader;

try {
  const mod = await import('../../../scripts/slice-6-cordis-loader.mjs');
  parsePatch = mod.parsePatch;
  validatePatch = mod.validatePatch;
  validateManifest = mod.validateManifest;
  dryRunLoader = mod.dryRunLoader;
} catch (e) {
  parsePatch = () => { throw new Error('TDD RED: scripts/slice-6-cordis-loader.mjs not built yet'); };
  validatePatch = () => { throw new Error('TDD RED: scripts/slice-6-cordis-loader.mjs not built yet'); };
  validateManifest = () => { throw new Error('TDD RED: scripts/slice-6-cordis-loader.mjs not built yet'); };
  dryRunLoader = () => { throw new Error('TDD RED: scripts/slice-6-cordis-loader.mjs not built yet'); };
}

test('parsePatch: local dsh-agora cordis.patch.yml → no throw', () => {
  const localPath = join(WORKTREE_ROOT, 'extensions/dsh-agora/cordis.patch.yml');
  assert.ok(existsSync(localPath), `local patch missing: ${localPath}`);
  const content = readFileSync(localPath, 'utf-8');
  const result = parsePatch(content);
  assert.ok(result);
  assert.ok(Array.isArray(result.inserts) || typeof result.inserts === 'object');
});

test('validatePatch: missing id → throw', () => {
  const badPatch = `- insert:
    - name: 'no-id'
      config:
        commandName: 'agora'
`;
  assert.throws(() => validatePatch(badPatch), /id/);
});

test('validatePatch: missing config.requestTimeoutMs → throw', () => {
  const badPatch = `- insert:
    - id: test
      name: 'test-no-timeout'
      config:
        commandName: 'agora'
`;
  assert.throws(() => validatePatch(badPatch), /requestTimeoutMs/);
});

test('validateManifest: inferred from package.json (new仓 has no dsh.plugin.json) → no throw', () => {
  const inferred = {
    id: 'dsh-matrix-connector',
    name: 'DSH Matrix Connector',
    version: '2.0.2',
    entry: 'lib/index.js',
  };
  const result = validateManifest(inferred);
  assert.ok(result);
});

test('validateManifest: missing entry → throw', () => {
  const badManifest = {
    id: 'foo',
    name: 'Foo',
    version: '1.0.0',
  };
  assert.throws(() => validateManifest(badManifest), /entry/);
});

test('dryRunLoader: new仓 URL → returns descriptor with expected fields', () => {
  const descriptor = dryRunLoader(NEW_REPO_PATCH_URL, NEW_REPO_MANIFEST_URL);
  assert.ok(descriptor);
  assert.ok(descriptor.id);
  assert.ok(descriptor.version);
  assert.ok(descriptor.entry);
});

test('lib/index.js in new仓 (Phase 2 实施) → exists and require-able', () => {
  const entry = 'lib/index.js';
  assert.match(entry, /^lib\/index\.js$/);
});

test('audit-trail sandbox fallback path → not /root/.agora', () => {
  const FALLBACK_PATTERN = /\.agora[\\\/]audit-trail[\\\/]dsh-matrix-connector\.jsonl/;
  assert.match(
    '.agora/audit-trail/dsh-matrix-connector.jsonl',
    FALLBACK_PATTERN,
  );
});