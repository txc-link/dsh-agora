import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createAgoraDatabase,
  ExecutiveAssistantRepository,
  ParticipantBindingRepository,
  ProgressLogRepository,
  runMigrations,
  RuntimeNodeRepository,
  TaskRepository,
  TemplateRepository,
} from '@agora-ts/db';
import type { TaskRecord } from '@agora-ts/contracts';
import { RuntimeNodeRegistryService, type TaskService } from '@agora-ts/core';
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
    const participantRepository = new ParticipantBindingRepository(db);
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
        participantRepository.insert({
          id: 'participant-ea-1',
          task_id: inserted.id,
          agent_ref: 'dsh:node-b:ea',
          runtime_provider: 'dsh',
          task_role: 'executor',
        });
        return taskRepository.updateTask(inserted.id, inserted.version, {
          state: 'active', current_stage: 'execute',
        }) as unknown as TaskRecord;
      },
      getTask(taskId: string) { return taskRepository.getTask(taskId) as unknown as TaskRecord | null; },
      advanceTask(taskId: string) {
        const current = taskRepository.getTask(taskId)!;
        return taskRepository.updateTask(taskId, current.version, {
          state: 'done', current_stage: null,
        }) as unknown as TaskRecord;
      },
      async waitForBackgroundOperations() {},
    } as unknown as TaskService;
    const runtimeNodeRegistryService = new RuntimeNodeRegistryService(new RuntimeNodeRepository(db));
    runtimeNodeRegistryService.heartbeat('node-b', {
      protocol: 'dsh-agora.node/v1',
      instance_id: 'instance-ea-test',
      plugin_version: '0.6.2',
      host_framework: 'deepseek-harness',
      runtime_provider: 'dsh',
      agents: [{ agent_ref: 'ea', roles: ['assistant'], capabilities: ['general'] }],
      bots: [],
      capacity: { max_concurrent: 1, active: 0 },
      lease_seconds: 90,
    });
    const app = buildApp({ db, taskService, runtimeNodeRegistryService });

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
    const [dispatch] = runtimeNodeRegistryService.listDispatches('node-b');
    expect(dispatch).toMatchObject({
      task_id: 'task-ea-1',
      participant_binding_id: 'participant-ea-1',
      runtime_target_ref: 'dsh:node-b:ea',
      prompt: expect.stringContaining('Prepare the morning brief'),
      idempotency_key: expect.stringMatching(/^executive-request:/u),
      metadata: expect.objectContaining({
        source: 'executive_assistant',
        auto_advance_task: true,
        information_domain: 'domain:company',
      }),
    });

    const claimed = runtimeNodeRegistryService.claimDispatch('node-b', 'instance-ea-test', 120);
    expect(claimed).not.toBeNull();
    const completed = await app.inject({
      method: 'POST',
      url: `/api/runtime-nodes/node-b/dispatches/${claimed!.id}/complete`,
      payload: {
        instance_id: 'instance-ea-test',
        claim_token: claimed!.claim_token,
        status: 'completed',
        session_id: 'session-ea-1',
        result: { answer: 'Morning brief delivered' },
        result_envelope: {
          schema: 'agora.runtime-result/v1',
          answer: 'Morning brief delivered',
          claims: [],
          evidence: [{ id: 'brief', kind: 'file', uri: 'brain://company/brief.md' }],
          environment: { runtime_provider: 'dsh', agent_ref: 'ea' },
        },
      },
    });
    expect(completed.statusCode).toBe(200);
    expect(taskRepository.getTask('task-ea-1')?.state).toBe('done');
    const executiveRepository = new ExecutiveAssistantRepository(db);
    expect(executiveRepository.getRequest(request.json().request.id)).toMatchObject({ status: 'completed' });
    expect(executiveRepository.getCommitmentByRequest(request.json().request.id)).toMatchObject({
      status: 'fulfilled',
      evidenceRefs: expect.arrayContaining([
        `runtime-dispatch:${claimed!.id}`,
        'brain://company/brief.md',
      ]),
    });
    expect(new ProgressLogRepository(db).listByTask('task-ea-1')).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'runtime_result',
        content: 'Morning brief delivered',
        actor: 'dsh:node-b:ea',
      }),
    ]));
    await app.close();
    db.close();
  });
});
