import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  CitizenRepository,
  FlowLogRepository,
  ProgressLogRepository,
  RoleBindingRepository,
  RoleDefinitionRepository,
  createAgoraDatabase,
  runMigrations,
} from '@agora-ts/db';
import type { ProjectService } from '@agora-ts/core';
import { CitizenService, RolePackService } from '@agora-ts/core';
import {
  createProjectServiceFromDb,
  createTaskServiceFromDb,
} from '@agora-ts/testing';
import { buildApp } from './app.js';

const tempPaths: string[] = [];
const templatesDir = resolve(process.cwd(), 'templates');

function makeDbPath() {
  const dir = mkdtempSync(join(tmpdir(), 'agora-ts-matrix-facade-'));
  tempPaths.push(dir);
  return join(dir, 'facade.db');
}

function makeDb() {
  const db = createAgoraDatabase({ dbPath: makeDbPath() });
  runMigrations(db);
  return db;
}

function createRolePackServiceFromDb(db: ReturnType<typeof createAgoraDatabase>) {
  return new RolePackService({
    roleDefinitions: new RoleDefinitionRepository(db),
    roleBindings: new RoleBindingRepository(db),
  });
}

function createCitizenServiceFromDb(
  db: ReturnType<typeof createAgoraDatabase>,
  projectService: ProjectService,
  rolePackService: RolePackService,
) {
  return new CitizenService({
    repository: new CitizenRepository(db),
    projectService,
    rolePackService,
  });
}

afterEach(() => {
  while (tempPaths.length > 0) {
    const dir = tempPaths.pop();
    if (!dir) continue;
    try {
      const { rmSync } = require('node:fs') as typeof import('node:fs');
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

describe('v0.1 matrix entry facade — citizens + events', () => {
  it('GET /api/citizens requires project_id query param', async () => {
    const db = makeDb();
    const projectService = createProjectServiceFromDb(db);
    const rolePackService = createRolePackServiceFromDb(db);
    const citizenService = createCitizenServiceFromDb(db, projectService, rolePackService);

    const app = buildApp({
      db,
      projectService,
      citizenService,
      apiAuth: { enabled: true, token: 'secret' },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/citizens',
      headers: { authorization: 'Bearer secret' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ message: 'project_id query parameter is required' });
  });

  it('GET /api/citizens?project_id=node-a returns empty list when no citizens', async () => {
    const db = makeDb();
    const projectService = createProjectServiceFromDb(db);
    const rolePackService = createRolePackServiceFromDb(db);
    const citizenService = createCitizenServiceFromDb(db, projectService, rolePackService);

    projectService.createProject({
      id: 'node-a',
      name: 'Node A',
      owner: '@root:agent-hub.local',
      summary: 'matrix connector test',
    });

    const app = buildApp({
      db,
      projectService,
      citizenService,
      apiAuth: { enabled: true, token: 'secret' },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/citizens?project_id=node-a',
      headers: { authorization: 'Bearer secret' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ citizens: [] });
  });

  it('GET /api/citizens/:id returns 404 for unknown id', async () => {
    const db = makeDb();
    const projectService = createProjectServiceFromDb(db);
    const rolePackService = createRolePackServiceFromDb(db);
    const citizenService = createCitizenServiceFromDb(db, projectService, rolePackService);

    const app = buildApp({
      db,
      projectService,
      citizenService,
      apiAuth: { enabled: true, token: 'secret' },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/citizens/no-such',
      headers: { authorization: 'Bearer secret' },
    });

    expect(response.statusCode).toBe(404);
  });

  it('GET /api/citizens/:id returns 503 when citizenService not configured', async () => {
    const db = makeDb();

    const app = buildApp({
      db,
      apiAuth: { enabled: true, token: 'secret' },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/citizens/whatever',
      headers: { authorization: 'Bearer secret' },
    });

    expect(response.statusCode).toBe(503);
  });

  it('GET /api/events requires task_id or project_id', async () => {
    const db = makeDb();
    const flowLogRepository = new FlowLogRepository(db);
    const progressLogRepository = new ProgressLogRepository(db);

    const app = buildApp({
      db,
      flowLogRepository,
      progressLogRepository,
      apiAuth: { enabled: true, token: 'secret' },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/events',
      headers: { authorization: 'Bearer secret' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      message: 'task_id or project_id query parameter is required',
    });
  });

  it('GET /api/events?task_id=X returns flow log entries with seq > since', async () => {
    const db = makeDb();
    const flowLogRepository = new FlowLogRepository(db);
    const progressLogRepository = new ProgressLogRepository(db);
    const taskService = createTaskServiceFromDb(db, {
      templatesDir,
      taskIdGenerator: () => 'OC-200X',
    });

    const created = taskService.createTask({
      title: 'matrix smoke',
      type: 'quick',
      creator: '@root:agent-hub.local',
      description: 'init',
      priority: 'normal',
    });

    const app = buildApp({
      db,
      taskService,
      flowLogRepository,
      progressLogRepository,
      apiAuth: { enabled: true, token: 'secret' },
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/events?task_id=${created.id}&since=0&limit=10`,
      headers: { authorization: 'Bearer secret' },
    });

    if (response.statusCode !== 200) {
      console.error('DEBUG body:', response.body);
    }
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(Array.isArray(body.events)).toBe(true);
    expect(typeof body.next_since).toBe('number');
    for (const event of body.events) {
      expect(event).toMatchObject({
        seq: expect.any(Number),
        type: expect.any(String),
        task_id: created.id,
      });
      // Per Agora §1 constitution: events MUST NOT contain IM-specific keys.
      expect(event).not.toHaveProperty('threadKey');
      expect(event).not.toHaveProperty('room_id');
    }
  });

  it('GET /api/events returns 503 when repositories not configured', async () => {
    const db = makeDb();

    const app = buildApp({
      db,
      apiAuth: { enabled: true, token: 'secret' },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/events?task_id=any',
      headers: { authorization: 'Bearer secret' },
    });

    expect(response.statusCode).toBe(503);
  });
});
