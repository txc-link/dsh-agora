import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createAgoraDatabase, runMigrations, TaskRepository, TemplateRepository } from '@agora-ts/db';
import type { TaskRecord } from '@agora-ts/contracts';
import type { TaskService } from '@agora-ts/core';
import { buildApp } from './app.js';

const cleanup: string[] = [];
afterEach(() => {
  for (const directory of cleanup.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('Company OS REST', () => {
  it('creates and returns a durable organization roster', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'agora-company-route-'));
    cleanup.push(directory);
    const db = createAgoraDatabase({ dbPath: join(directory, 'agora.db') });
    runMigrations(db);
    const app = buildApp({ db });
    const organization = await app.inject({
      method: 'POST', url: '/api/organizations',
      payload: { slug: 'my-company', name: 'My Company', owner_ref: 'human:ceo', information_domain: 'work' },
    });
    expect(organization.statusCode).toBe(201);
    const organizationId = organization.json().id as string;
    const unit = await app.inject({
      method: 'POST', url: `/api/organizations/${organizationId}/units`,
      payload: { name: 'Executive Office', kind: 'executive_office', responsibilities: ['intake'] },
    });
    expect(unit.statusCode).toBe(201);
    const position = await app.inject({
      method: 'POST', url: `/api/organizations/${organizationId}/positions`,
      payload: { unit_id: unit.json().id, title: 'Executive Assistant', kind: 'executive_assistant', responsibilities: ['triage'] },
    });
    expect(position.statusCode).toBe(201);
    const employment = await app.inject({
      method: 'POST', url: `/api/organizations/${organizationId}/employments`,
      payload: { position_id: position.json().id, subject_kind: 'agent', subject_ref: 'agent:ea', employment_kind: 'resident' },
    });
    expect(employment.statusCode).toBe(201);
    const snapshot = await app.inject({ method: 'GET', url: `/api/organizations/${organizationId}` });
    expect(snapshot.statusCode).toBe(200);
    expect(snapshot.json()).toMatchObject({
      organization: { informationDomain: 'work' },
      units: [{ name: 'Executive Office' }],
      positions: [{ title: 'Executive Assistant' }],
      employments: [{ subjectRef: 'agent:ea' }],
    });
    await app.close();
    db.close();
  });

  it('turns an assistant request into a task assigned to the employed agent', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'agora-company-assistant-route-'));
    cleanup.push(directory);
    const db = createAgoraDatabase({ dbPath: join(directory, 'agora.db') });
    runMigrations(db);
    new TemplateRepository(db).saveTemplate('quick', {
      name: 'Quick', type: 'quick', description: 'one stage', defaultWorkflow: 'execute-done', governance: 'lean',
      defaultTeam: { executor: { member_kind: 'controller', suggested: ['default'] } },
      stages: [{ id: 'execute', name: 'Execute', mode: 'execute', execution_kind: 'citizen_execute', gate: { type: 'command' } }],
    });
    let createdInput: Record<string, unknown> | null = null;
    const taskRepository = new TaskRepository(db);
    const taskService = {
      createTask(input: Record<string, unknown>) {
        createdInput = input;
        const inserted = taskRepository.insertTask({
          id: 'task-ea-1',
          title: String(input.title),
          description: String(input.description),
          type: String(input.type),
          priority: String(input.priority),
          creator: String(input.creator),
          team: input.team_override as Parameters<TaskRepository['insertTask']>[0]['team'],
          workflow: { type: 'execute-done', stages: [] },
        });
        return taskRepository.updateTask(inserted.id, inserted.version, { state: 'pending' }) as unknown as TaskRecord;
      },
      getTask(taskId: string) { return taskRepository.getTask(taskId) as unknown as TaskRecord | null; },
      async waitForBackgroundOperations() {},
    } as unknown as TaskService;
    const app = buildApp({ db, taskService });

    const organization = await app.inject({
      method: 'POST', url: '/api/organizations',
      payload: { slug: 'agent-company', name: 'Agent Company', owner_ref: 'human:ceo', information_domain: 'domain:company' },
    });
    const organizationId = organization.json().id as string;
    const unit = await app.inject({
      method: 'POST', url: `/api/organizations/${organizationId}/units`,
      payload: { name: 'Executive Office', kind: 'executive_office' },
    });
    const position = await app.inject({
      method: 'POST', url: `/api/organizations/${organizationId}/positions`,
      payload: { unit_id: unit.json().id, title: 'Executive Assistant', kind: 'executive_assistant' },
    });
    await app.inject({
      method: 'POST', url: `/api/organizations/${organizationId}/employments`,
      payload: {
        position_id: position.json().id,
        subject_kind: 'agent',
        subject_ref: 'dsh:node-b:ea',
        employment_kind: 'resident',
      },
    });
    const request = await app.inject({
      method: 'POST', url: `/api/organizations/${organizationId}/assistant/requests`,
      payload: {
        requested_by: 'human:ceo', title: 'Prepare brief', body: 'Prepare the morning brief',
        requested_capabilities: [], task_type: 'quick', project_id: null,
      },
    });

    expect(request.statusCode).toBe(201);
    expect(request.json()).toMatchObject({
      ok: true,
      request: { status: 'triage', taskId: 'task-ea-1' },
      commitment: { status: 'open', taskId: 'task-ea-1' },
    });
    expect(createdInput).toMatchObject({
      team_override: {
        members: [{ role: 'executor', agentId: 'dsh:node-b:ea', member_kind: 'controller' }],
      },
    });
    expect(db.prepare('SELECT agent_ref, status FROM task_claims WHERE task_id = ?').get('task-ea-1')).toMatchObject({
      agent_ref: 'dsh:node-b:ea', status: 'claimed',
    });
    await app.close();
    db.close();
  });
});
