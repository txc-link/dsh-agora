import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createAgoraDatabase, runMigrations } from './database.js';
import { ExecutiveAssistantRepository } from './repositories/executive-assistant.repository.js';
import { OrganizationRepository } from './repositories/organization.repository.js';

const cleanup: string[] = [];
afterEach(() => {
  for (const directory of cleanup.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('ExecutiveAssistantRepository', () => {
  it('recovers inbox and commitment ledger after restart', () => {
    const directory = mkdtempSync(join(tmpdir(), 'agora-ea-'));
    cleanup.push(directory);
    const dbPath = join(directory, 'agora.db');
    let database = createAgoraDatabase({ dbPath });
    runMigrations(database);
    const organizations = new OrganizationRepository(database);
    organizations.insertOrganization({ id: 'org', slug: 'company', name: 'Company', ownerRef: 'human:ceo', informationDomain: 'work' });
    organizations.insertUnit({ id: 'unit', organizationId: 'org', name: 'Executive Office', kind: 'executive_office' });
    organizations.insertPosition({ id: 'position', organizationId: 'org', unitId: 'unit', title: 'Executive Assistant', kind: 'executive_assistant' });
    organizations.insertEmployment({
      id: 'employment', organizationId: 'org', positionId: 'position', subjectKind: 'agent', subjectRef: 'agent:ea',
      employmentKind: 'resident', startedAt: '2026-08-30T00:00:00.000Z',
    });
    database.prepare(`
      INSERT INTO tasks (id, title, description, type, priority, creator, state, team, workflow, created_at, updated_at)
      VALUES ('task', 'Research', '', 'quick', 'normal', 'human:ceo', 'active', '{}', '{}', 'now', 'now')
    `).run();
    let repository = new ExecutiveAssistantRepository(database);
    const request = repository.insertRequest({
      id: 'request', organizationId: 'org', requestedBy: 'human:ceo', title: 'Research', body: 'Deliver a report',
      priority: 'normal', requestedCapabilities: ['research'], taskType: 'research',
    });
    const routed = repository.updateRequestRouting(request.id, {
      status: 'delegated', assignedPositionId: 'position', assignedEmploymentId: 'employment', taskId: 'task',
    }, request.version);
    expect(routed?.status).toBe('delegated');
    repository.insertCommitment({
      id: 'commitment', organizationId: 'org', requestId: 'request', ownerPositionId: 'position',
      ownerEmploymentId: 'employment', taskId: 'task', summary: 'Deliver: Research',
    });
    database.close();

    database = createAgoraDatabase({ dbPath });
    runMigrations(database);
    repository = new ExecutiveAssistantRepository(database);
    expect(repository.listRequests('org')).toHaveLength(1);
    const commitment = repository.getCommitmentByRequest('request');
    expect(commitment?.status).toBe('open');
    const fulfilled = repository.updateCommitmentStatus('commitment', 'fulfilled', commitment?.version ?? 0, ['artifact:report'], '2026-08-31T00:00:00.000Z');
    expect(fulfilled).toMatchObject({ status: 'fulfilled', evidenceRefs: ['artifact:report'] });
    database.close();
  });
});
