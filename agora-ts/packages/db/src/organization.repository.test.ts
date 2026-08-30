import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createAgoraDatabase, runMigrations } from './database.js';
import { OrganizationRepository } from './repositories/organization.repository.js';

const cleanup: string[] = [];

afterEach(() => {
  for (const directory of cleanup.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('OrganizationRepository', () => {
  it('persists organization structure and employment history across restart', () => {
    const directory = mkdtempSync(join(tmpdir(), 'agora-company-'));
    cleanup.push(directory);
    const dbPath = join(directory, 'agora.db');
    let database = createAgoraDatabase({ dbPath });
    runMigrations(database);
    let repository = new OrganizationRepository(database);
    const organization = repository.insertOrganization({
      id: 'org-1', slug: 'my-company', name: 'My Company', ownerRef: 'human:ceo', informationDomain: 'work',
    });
    const unit = repository.insertUnit({
      id: 'unit-1', organizationId: organization.id, name: 'Executive Office', kind: 'executive_office', responsibilities: ['intake'],
    });
    const position = repository.insertPosition({
      id: 'position-1', organizationId: organization.id, unitId: unit.id, title: 'Executive Assistant',
      kind: 'executive_assistant', responsibilities: ['triage'], skills: ['research'],
    });
    const employment = repository.insertEmployment({
      id: 'employment-1', organizationId: organization.id, positionId: position.id,
      subjectKind: 'agent', subjectRef: 'agent:ea', employmentKind: 'resident', startedAt: '2026-08-30T00:00:00.000Z',
    });
    repository.updateEmploymentStatus(employment.id, 'ended', employment.version, '2026-08-31T00:00:00.000Z', 'transfer');
    database.close();

    database = createAgoraDatabase({ dbPath });
    runMigrations(database);
    repository = new OrganizationRepository(database);
    expect(repository.getOrganizationBySlug('my-company')?.informationDomain).toBe('work');
    expect(repository.listUnits('org-1')[0].responsibilities).toEqual(['intake']);
    expect(repository.listPositions('org-1')[0].skills).toEqual(['research']);
    expect(repository.listEmployments('org-1', true)[0]).toMatchObject({
      subjectRef: 'agent:ea', status: 'ended', endedReason: 'transfer', version: 2,
    });
    database.close();
  });

  it('enforces one current employment per position while retaining ended records', () => {
    const directory = mkdtempSync(join(tmpdir(), 'agora-company-'));
    cleanup.push(directory);
    const database = createAgoraDatabase({ dbPath: join(directory, 'agora.db') });
    runMigrations(database);
    const repository = new OrganizationRepository(database);
    repository.insertOrganization({ id: 'org', slug: 'company', name: 'Company', ownerRef: 'human:ceo', informationDomain: 'work' });
    repository.insertUnit({ id: 'unit', organizationId: 'org', name: 'Research', kind: 'department' });
    repository.insertPosition({ id: 'position', organizationId: 'org', unitId: 'unit', title: 'Researcher', kind: 'specialist' });
    const first = repository.insertEmployment({
      id: 'first', organizationId: 'org', positionId: 'position', subjectKind: 'agent', subjectRef: 'agent:r1',
      employmentKind: 'resident', startedAt: '2026-08-30T00:00:00.000Z',
    });
    expect(() => repository.insertEmployment({
      id: 'second', organizationId: 'org', positionId: 'position', subjectKind: 'agent', subjectRef: 'agent:r2',
      employmentKind: 'resident', startedAt: '2026-08-30T01:00:00.000Z',
    })).toThrow(/UNIQUE/);
    repository.updateEmploymentStatus(first.id, 'ended', first.version, '2026-08-30T02:00:00.000Z', 'rotation');
    expect(repository.insertEmployment({
      id: 'second', organizationId: 'org', positionId: 'position', subjectKind: 'agent', subjectRef: 'agent:r2',
      employmentKind: 'resident', startedAt: '2026-08-30T03:00:00.000Z',
    }).subjectRef).toBe('agent:r2');
    expect(repository.listEmployments('org', true)).toHaveLength(2);
    database.close();
  });
});
