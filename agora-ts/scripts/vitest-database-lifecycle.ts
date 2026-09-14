import { setImmediate as nativeSetImmediate } from 'node:timers';
import { afterEach } from 'vitest';

import type { AgoraDatabase } from '../packages/db/src/database.js';
import { observeAgoraDatabases } from '../packages/db/src/database.js';

const openDatabases: AgoraDatabase[] = [];

observeAgoraDatabases((database) => {
  const originalClose = database.close;
  let open = true;
  database.close = () => {
    if (!open) return;
    open = false;
    const index = openDatabases.lastIndexOf(database);
    if (index >= 0) openDatabases.splice(index, 1);
    originalClose();
  };
  openDatabases.push(database);
});

afterEach(async () => {
  // Allow detached fixture work (for example IM provisioning promises) to
  // settle before taking the database away from it. Tests that intentionally
  // exercise longer background work must still call their explicit drain API.
  // Capture Node's real timer before individual tests can install fake timers.
  // Otherwise a test that leaves fake timers active would deadlock this hook.
  await new Promise<void>((resolve) => nativeSetImmediate(resolve));
  while (openDatabases.length > 0) {
    openDatabases.at(-1)?.close();
  }
});
