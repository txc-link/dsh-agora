import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAgoraDatabase, observeAgoraDatabases } from './database.js';

let fakeTimerDirectory: string | undefined;

afterEach(() => {
  vi.useRealTimers();
  if (fakeTimerDirectory) {
    rmSync(fakeTimerDirectory, { recursive: true, force: true });
    fakeTimerDirectory = undefined;
  }
});

describe('database lifecycle observation', () => {
  it('reports each new handle and permits observer removal', () => {
    const directory = mkdtempSync(join(tmpdir(), 'agora-db-observer-'));
    const observed: string[] = [];
    const stop = observeAgoraDatabases(() => observed.push('opened'));

    const first = createAgoraDatabase({ dbPath: join(directory, 'first.db') });
    first.close();
    stop();
    const second = createAgoraDatabase({ dbPath: join(directory, 'second.db') });
    second.close();
    rmSync(directory, { recursive: true, force: true });

    expect(observed).toEqual(['opened']);
  });

  it('releases fixtures even when a test leaves fake timers active', () => {
    fakeTimerDirectory = mkdtempSync(join(tmpdir(), 'agora-db-fake-timers-'));
    vi.useFakeTimers();

    createAgoraDatabase({ dbPath: join(fakeTimerDirectory, 'fixture.db') });

    // The global lifecycle hook runs before this file's cleanup hook. If it
    // accidentally awaits a faked setImmediate, this test times out and the
    // directory cannot be removed on Windows.
  });
});
