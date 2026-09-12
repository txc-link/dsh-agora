/**
 * conversation-sessions — durable room → DSH session bindings.
 *
 * The facade derives a per-message Agora dispatch key from the room-scoped
 * idempotency key plus the Matrix eventId, so conversation continuity rides on
 * the remembered DSH session instead of on dispatch replay. That memory has to
 * survive a facade restart.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { loadConversationSessions, saveConversationSessions } from '../lib/http-api.js';

test('conversation sessions round-trip through disk, creating parent dirs', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agora-sessions-'));
  const file = join(dir, 'nested', 'sessions.json');
  const sessions = new Map([['matrix-mx_abc', 'session-1'], ['matrix-mx_def', 'session-2']]);

  saveConversationSessions(file, sessions);

  assert.deepEqual([...loadConversationSessions(file)], [...sessions]);
  assert.match(readFileSync(file, 'utf8'), /session-1/);
});

test('missing state loads as an empty map', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agora-sessions-'));
  assert.equal(loadConversationSessions(join(dir, 'absent.json')).size, 0);
});

test('unreadable state degrades to an empty map instead of throwing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agora-sessions-'));
  const file = join(dir, 'broken.json');

  writeFileSync(file, 'not json at all');
  assert.equal(loadConversationSessions(file).size, 0);

  writeFileSync(file, JSON.stringify({ good: 'session-9', bad: 42, empty: '' }));
  assert.deepEqual([...loadConversationSessions(file)], [['good', 'session-9']]);
});
