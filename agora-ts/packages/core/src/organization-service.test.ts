import { describe, expect, it } from 'vitest';
import type {
  EmploymentRecord,
  IOrganizationRepository,
  OrganizationRecord,
  OrganizationUnitRecord,
  PositionRecord,
} from '@agora-ts/contracts';
import { OrganizationService } from './organization-service.js';

function makeRepository(): IOrganizationRepository {
  const organizations = new Map<string, OrganizationRecord>();
  const units = new Map<string, OrganizationUnitRecord>();
  const positions = new Map<string, PositionRecord>();
  const employments = new Map<string, EmploymentRecord>();
  let sequence = 0;
  const id = (prefix: string) => `${prefix}-${++sequence}`;
  return {
    insertOrganization(input) {
      const record: OrganizationRecord = {
        id: input.id ?? id('org'),
        slug: input.slug,
        name: input.name,
        ownerRef: input.ownerRef,
        informationDomain: input.informationDomain,
        purpose: input.purpose ?? null,
        status: 'active',
        version: 1,
        createdAt: '2026-08-30T00:00:00.000Z',
        updatedAt: '2026-08-30T00:00:00.000Z',
        metadata: input.metadata ?? null,
      };
      if ([...organizations.values()].some((item) => item.slug === record.slug)) {
        throw new Error('UNIQUE constraint failed: organizations.slug');
      }
      organizations.set(record.id, record);
      return record;
    },
    getOrganization: (organizationId) => organizations.get(organizationId) ?? null,
    getOrganizationBySlug: (slug) => [...organizations.values()].find((item) => item.slug === slug) ?? null,
    listOrganizations: () => [...organizations.values()],
    insertUnit(input) {
      const record: OrganizationUnitRecord = {
        id: input.id ?? id('unit'),
        organizationId: input.organizationId,
        name: input.name,
        kind: input.kind,
        parentUnitId: input.parentUnitId ?? null,
        responsibilities: input.responsibilities ?? [],
        status: 'active',
        version: 1,
        createdAt: '2026-08-30T00:00:00.000Z',
        updatedAt: '2026-08-30T00:00:00.000Z',
        metadata: input.metadata ?? null,
      };
      units.set(record.id, record);
      return record;
    },
    getUnit: (unitId) => units.get(unitId) ?? null,
    listUnits: (organizationId) => [...units.values()].filter((item) => item.organizationId === organizationId),
    updateUnitParent(unitId, parentUnitId, expectedVersion) {
      const current = units.get(unitId);
      if (!current || current.version !== expectedVersion) return null;
      const next = { ...current, parentUnitId, version: current.version + 1 };
      units.set(unitId, next);
      return next;
    },
    insertPosition(input) {
      const record: PositionRecord = {
        id: input.id ?? id('position'),
        organizationId: input.organizationId,
        unitId: input.unitId,
        title: input.title,
        kind: input.kind,
        reportsToPositionId: input.reportsToPositionId ?? null,
        responsibilities: input.responsibilities ?? [],
        skills: input.skills ?? [],
        status: 'active',
        version: 1,
        createdAt: '2026-08-30T00:00:00.000Z',
        updatedAt: '2026-08-30T00:00:00.000Z',
        metadata: input.metadata ?? null,
      };
      positions.set(record.id, record);
      return record;
    },
    getPosition: (positionId) => positions.get(positionId) ?? null,
    listPositions: (organizationId) => [...positions.values()].filter((item) => item.organizationId === organizationId),
    updatePositionManager(positionId, reportsToPositionId, expectedVersion) {
      const current = positions.get(positionId);
      if (!current || current.version !== expectedVersion) return null;
      const next = { ...current, reportsToPositionId, version: current.version + 1 };
      positions.set(positionId, next);
      return next;
    },
    insertEmployment(input) {
      const record: EmploymentRecord = {
        id: input.id ?? id('employment'),
        organizationId: input.organizationId,
        positionId: input.positionId,
        subjectKind: input.subjectKind,
        subjectRef: input.subjectRef,
        employmentKind: input.employmentKind,
        status: 'active',
        startedAt: input.startedAt,
        endedAt: null,
        endedReason: null,
        version: 1,
        createdAt: '2026-08-30T00:00:00.000Z',
        updatedAt: '2026-08-30T00:00:00.000Z',
        metadata: input.metadata ?? null,
      };
      if ([...employments.values()].some((item) => item.positionId === record.positionId && item.status !== 'ended')) {
        throw new Error('UNIQUE constraint failed: organization_employments.position_id');
      }
      employments.set(record.id, record);
      return record;
    },
    getEmployment: (employmentId) => employments.get(employmentId) ?? null,
    getCurrentEmploymentByPosition: (positionId) =>
      [...employments.values()].find((item) => item.positionId === positionId && item.status !== 'ended') ?? null,
    listEmployments: (organizationId, includeEnded = true) =>
      [...employments.values()].filter((item) => item.organizationId === organizationId && (includeEnded || item.status !== 'ended')),
    updateEmploymentStatus(employmentId, status, expectedVersion, endedAt, endedReason) {
      const current = employments.get(employmentId);
      if (!current || current.version !== expectedVersion) return null;
      const next: EmploymentRecord = {
        ...current,
        status,
        endedAt: status === 'ended' ? endedAt : null,
        endedReason: status === 'ended' ? endedReason : null,
        version: current.version + 1,
      };
      employments.set(employmentId, next);
      return next;
    },
  };
}

describe('OrganizationService', () => {
  it('creates a project-independent company roster with positions and employment', () => {
    const service = new OrganizationService({ repository: makeRepository() });
    const organization = service.createOrganization({
      slug: 'my-company', name: 'My Company', ownerRef: 'human:ceo', informationDomain: 'work',
    });
    expect(organization.ok).toBe(true);
    if (!organization.ok) return;
    const executiveOffice = service.createUnit({
      organizationId: organization.data.id, name: 'Executive Office', kind: 'executive_office', responsibilities: ['intake'],
    });
    expect(executiveOffice.ok).toBe(true);
    if (!executiveOffice.ok) return;
    const assistant = service.createPosition({
      organizationId: organization.data.id,
      unitId: executiveOffice.data.id,
      title: 'Executive Assistant',
      kind: 'executive_assistant',
      responsibilities: ['intake', 'triage', 'follow-up'],
      skills: ['research', 'coordination'],
    });
    expect(assistant.ok).toBe(true);
    if (!assistant.ok) return;
    const employment = service.employ({
      organizationId: organization.data.id,
      positionId: assistant.data.id,
      subjectKind: 'agent',
      subjectRef: 'agent:ea',
      employmentKind: 'resident',
    });
    expect(employment.ok).toBe(true);
    expect(service.snapshot(organization.data.id).data?.employments).toHaveLength(1);
  });

  it('rejects cross-organization parents and hierarchy cycles', () => {
    const service = new OrganizationService({ repository: makeRepository() });
    const first = service.createOrganization({ slug: 'one', name: 'One', ownerRef: 'human:one', informationDomain: 'work' });
    const second = service.createOrganization({ slug: 'two', name: 'Two', ownerRef: 'human:two', informationDomain: 'work' });
    if (!first.ok || !second.ok) throw new Error('setup failed');
    const root = service.createUnit({ organizationId: first.data.id, name: 'Root', kind: 'department' });
    const child = service.createUnit({ organizationId: first.data.id, name: 'Child', kind: 'team', parentUnitId: root.data?.id });
    const foreign = service.createUnit({ organizationId: second.data.id, name: 'Foreign', kind: 'department' });
    if (!root.ok || !child.ok || !foreign.ok) throw new Error('setup failed');
    expect(service.setUnitParent(root.data.id, child.data.id).error).toContain('cycle');
    expect(service.setUnitParent(root.data.id, foreign.data.id).error).toContain('same organization');
  });

  it('rejects reporting cycles and cross-organization managers', () => {
    const service = new OrganizationService({ repository: makeRepository() });
    const one = service.createOrganization({ slug: 'one', name: 'One', ownerRef: 'human:one', informationDomain: 'work' });
    const two = service.createOrganization({ slug: 'two', name: 'Two', ownerRef: 'human:two', informationDomain: 'work' });
    if (!one.ok || !two.ok) throw new Error('setup failed');
    const unitOne = service.createUnit({ organizationId: one.data.id, name: 'One Unit', kind: 'department' });
    const unitTwo = service.createUnit({ organizationId: two.data.id, name: 'Two Unit', kind: 'department' });
    if (!unitOne.ok || !unitTwo.ok) throw new Error('setup failed');
    const lead = service.createPosition({ organizationId: one.data.id, unitId: unitOne.data.id, title: 'Lead', kind: 'lead' });
    const worker = service.createPosition({ organizationId: one.data.id, unitId: unitOne.data.id, title: 'Worker', kind: 'worker', reportsToPositionId: lead.data?.id });
    const foreign = service.createPosition({ organizationId: two.data.id, unitId: unitTwo.data.id, title: 'Foreign', kind: 'lead' });
    if (!lead.ok || !worker.ok || !foreign.ok) throw new Error('setup failed');
    expect(service.setPositionManager(lead.data.id, worker.data.id).error).toContain('cycle');
    expect(service.setPositionManager(lead.data.id, foreign.data.id).error).toContain('same organization');
  });

  it('keeps employment history when a resident transfers positions', () => {
    const service = new OrganizationService({ repository: makeRepository() });
    const organization = service.createOrganization({ slug: 'company', name: 'Company', ownerRef: 'human:ceo', informationDomain: 'work' });
    if (!organization.ok) throw new Error('setup failed');
    const unit = service.createUnit({ organizationId: organization.data.id, name: 'Research', kind: 'department' });
    if (!unit.ok) throw new Error('setup failed');
    const researcher = service.createPosition({ organizationId: organization.data.id, unitId: unit.data.id, title: 'Researcher', kind: 'specialist' });
    const lead = service.createPosition({ organizationId: organization.data.id, unitId: unit.data.id, title: 'Research Lead', kind: 'lead' });
    if (!researcher.ok || !lead.ok) throw new Error('setup failed');
    const original = service.employ({ organizationId: organization.data.id, positionId: researcher.data.id, subjectKind: 'agent', subjectRef: 'agent:r1', employmentKind: 'resident' });
    if (!original.ok) throw new Error('setup failed');
    expect(service.employ({ organizationId: organization.data.id, positionId: researcher.data.id, subjectKind: 'agent', subjectRef: 'agent:r2', employmentKind: 'resident' }).ok).toBe(false);
    const transferred = service.transferEmployment(original.data.id, lead.data.id, 'promotion');
    expect(transferred.ok).toBe(true);
    const history = service.snapshot(organization.data.id).data?.employments ?? [];
    expect(history).toHaveLength(2);
    expect(history.find((item) => item.id === original.data.id)?.status).toBe('ended');
    expect(history.find((item) => item.positionId === lead.data.id)?.subjectRef).toBe('agent:r1');
  });
});
