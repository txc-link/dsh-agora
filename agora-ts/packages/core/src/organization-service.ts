import type {
  EmploymentKind,
  EmploymentRecord,
  EmploymentStatus,
  EmploymentSubjectKind,
  IOrganizationRepository,
  OrganizationRecord,
  OrganizationSnapshot,
  OrganizationUnitKind,
  OrganizationUnitRecord,
  PositionKind,
  PositionRecord,
} from '@agora-ts/contracts';

export type OrganizationResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface OrganizationServiceOptions {
  repository: IOrganizationRepository;
  now?: () => Date;
}

export interface CreateOrganizationInput {
  slug: string;
  name: string;
  ownerRef: string;
  informationDomain: string;
  purpose?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface CreateOrganizationUnitInput {
  organizationId: string;
  name: string;
  kind: OrganizationUnitKind;
  parentUnitId?: string | null;
  responsibilities?: string[];
  metadata?: Record<string, unknown> | null;
}

export interface CreatePositionInput {
  organizationId: string;
  unitId: string;
  title: string;
  kind: PositionKind;
  reportsToPositionId?: string | null;
  responsibilities?: string[];
  skills?: string[];
  metadata?: Record<string, unknown> | null;
}

export interface EmployInput {
  organizationId: string;
  positionId: string;
  subjectKind: EmploymentSubjectKind;
  subjectRef: string;
  employmentKind: EmploymentKind;
  startedAt?: string;
  metadata?: Record<string, unknown> | null;
}

function nonBlank(value: string): boolean {
  return value.trim().length > 0;
}

function normalizeList(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

function repositoryError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('UNIQUE')) return 'record already exists';
  return message;
}

export class OrganizationService {
  private readonly repository: IOrganizationRepository;
  private readonly now: () => Date;

  constructor(options: OrganizationServiceOptions) {
    this.repository = options.repository;
    this.now = options.now ?? (() => new Date());
  }

  createOrganization(input: CreateOrganizationInput): OrganizationResult<OrganizationRecord> {
    const slug = input.slug.trim().toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return { ok: false, error: 'slug must use lowercase letters, numbers and single hyphens' };
    }
    if (!nonBlank(input.name) || !nonBlank(input.ownerRef) || !nonBlank(input.informationDomain)) {
      return { ok: false, error: 'name, ownerRef and informationDomain are required' };
    }
    try {
      return {
        ok: true,
        data: this.repository.insertOrganization({
          slug,
          name: input.name.trim(),
          ownerRef: input.ownerRef.trim(),
          informationDomain: input.informationDomain.trim(),
          purpose: input.purpose?.trim() || null,
          metadata: input.metadata ?? null,
        }),
      };
    } catch (error) {
      return { ok: false, error: repositoryError(error) };
    }
  }

  createUnit(input: CreateOrganizationUnitInput): OrganizationResult<OrganizationUnitRecord> {
    const organization = this.repository.getOrganization(input.organizationId);
    if (!organization) return { ok: false, error: `organization '${input.organizationId}' not found` };
    if (organization.status !== 'active') return { ok: false, error: `organization '${input.organizationId}' is not active` };
    if (!nonBlank(input.name)) return { ok: false, error: 'unit name is required' };
    if (input.parentUnitId) {
      const parent = this.repository.getUnit(input.parentUnitId);
      if (!parent) return { ok: false, error: `parent unit '${input.parentUnitId}' not found` };
      if (parent.organizationId !== input.organizationId) {
        return { ok: false, error: 'parent unit must belong to the same organization' };
      }
    }
    try {
      return {
        ok: true,
        data: this.repository.insertUnit({
          organizationId: input.organizationId,
          name: input.name.trim(),
          kind: input.kind,
          parentUnitId: input.parentUnitId ?? null,
          responsibilities: normalizeList(input.responsibilities),
          metadata: input.metadata ?? null,
        }),
      };
    } catch (error) {
      return { ok: false, error: repositoryError(error) };
    }
  }

  setUnitParent(unitId: string, parentUnitId: string | null): OrganizationResult<OrganizationUnitRecord> {
    const unit = this.repository.getUnit(unitId);
    if (!unit) return { ok: false, error: `unit '${unitId}' not found` };
    if (parentUnitId !== null) {
      const parent = this.repository.getUnit(parentUnitId);
      if (!parent) return { ok: false, error: `parent unit '${parentUnitId}' not found` };
      if (parent.organizationId !== unit.organizationId) {
        return { ok: false, error: 'parent unit must belong to the same organization' };
      }
      const seen = new Set<string>([unitId]);
      let cursor: OrganizationUnitRecord | null = parent;
      while (cursor) {
        if (seen.has(cursor.id)) return { ok: false, error: 'unit hierarchy cycle detected' };
        seen.add(cursor.id);
        cursor = cursor.parentUnitId ? this.repository.getUnit(cursor.parentUnitId) : null;
      }
    }
    const updated = this.repository.updateUnitParent(unitId, parentUnitId, unit.version);
    return updated ? { ok: true, data: updated } : { ok: false, error: 'unit changed concurrently' };
  }

  createPosition(input: CreatePositionInput): OrganizationResult<PositionRecord> {
    const organization = this.repository.getOrganization(input.organizationId);
    if (!organization) return { ok: false, error: `organization '${input.organizationId}' not found` };
    const unit = this.repository.getUnit(input.unitId);
    if (!unit) return { ok: false, error: `unit '${input.unitId}' not found` };
    if (unit.organizationId !== input.organizationId) {
      return { ok: false, error: 'position unit must belong to the same organization' };
    }
    if (!nonBlank(input.title)) return { ok: false, error: 'position title is required' };
    if (input.reportsToPositionId) {
      const manager = this.repository.getPosition(input.reportsToPositionId);
      if (!manager) return { ok: false, error: `manager position '${input.reportsToPositionId}' not found` };
      if (manager.organizationId !== input.organizationId) {
        return { ok: false, error: 'manager position must belong to the same organization' };
      }
    }
    try {
      return {
        ok: true,
        data: this.repository.insertPosition({
          organizationId: input.organizationId,
          unitId: input.unitId,
          title: input.title.trim(),
          kind: input.kind,
          reportsToPositionId: input.reportsToPositionId ?? null,
          responsibilities: normalizeList(input.responsibilities),
          skills: normalizeList(input.skills),
          metadata: input.metadata ?? null,
        }),
      };
    } catch (error) {
      return { ok: false, error: repositoryError(error) };
    }
  }

  setPositionManager(positionId: string, reportsToPositionId: string | null): OrganizationResult<PositionRecord> {
    const position = this.repository.getPosition(positionId);
    if (!position) return { ok: false, error: `position '${positionId}' not found` };
    if (reportsToPositionId !== null) {
      const manager = this.repository.getPosition(reportsToPositionId);
      if (!manager) return { ok: false, error: `manager position '${reportsToPositionId}' not found` };
      if (manager.organizationId !== position.organizationId) {
        return { ok: false, error: 'manager position must belong to the same organization' };
      }
      const seen = new Set<string>([positionId]);
      let cursor: PositionRecord | null = manager;
      while (cursor) {
        if (seen.has(cursor.id)) return { ok: false, error: 'position reporting cycle detected' };
        seen.add(cursor.id);
        cursor = cursor.reportsToPositionId ? this.repository.getPosition(cursor.reportsToPositionId) : null;
      }
    }
    const updated = this.repository.updatePositionManager(positionId, reportsToPositionId, position.version);
    return updated ? { ok: true, data: updated } : { ok: false, error: 'position changed concurrently' };
  }

  employ(input: EmployInput): OrganizationResult<EmploymentRecord> {
    if (!nonBlank(input.subjectRef)) return { ok: false, error: 'subjectRef is required' };
    const organization = this.repository.getOrganization(input.organizationId);
    if (!organization) return { ok: false, error: `organization '${input.organizationId}' not found` };
    const position = this.repository.getPosition(input.positionId);
    if (!position) return { ok: false, error: `position '${input.positionId}' not found` };
    if (position.organizationId !== input.organizationId) {
      return { ok: false, error: 'position must belong to the same organization' };
    }
    if (position.status !== 'active') return { ok: false, error: `position '${input.positionId}' is not active` };
    if (this.repository.getCurrentEmploymentByPosition(input.positionId)) {
      return { ok: false, error: `position '${input.positionId}' already has a current employment` };
    }
    const startedAt = input.startedAt ?? this.now().toISOString();
    if (Number.isNaN(Date.parse(startedAt))) return { ok: false, error: 'startedAt must be an ISO datetime' };
    try {
      return {
        ok: true,
        data: this.repository.insertEmployment({
          organizationId: input.organizationId,
          positionId: input.positionId,
          subjectKind: input.subjectKind,
          subjectRef: input.subjectRef.trim(),
          employmentKind: input.employmentKind,
          startedAt,
          metadata: input.metadata ?? null,
        }),
      };
    } catch (error) {
      return { ok: false, error: repositoryError(error) };
    }
  }

  setEmploymentStatus(employmentId: string, status: Exclude<EmploymentStatus, 'ended'>): OrganizationResult<EmploymentRecord> {
    const employment = this.repository.getEmployment(employmentId);
    if (!employment) return { ok: false, error: `employment '${employmentId}' not found` };
    if (employment.status === 'ended') return { ok: false, error: 'ended employment cannot be reopened' };
    const updated = this.repository.updateEmploymentStatus(employmentId, status, employment.version);
    return updated ? { ok: true, data: updated } : { ok: false, error: 'employment changed concurrently' };
  }

  endEmployment(employmentId: string, reason: string): OrganizationResult<EmploymentRecord> {
    const employment = this.repository.getEmployment(employmentId);
    if (!employment) return { ok: false, error: `employment '${employmentId}' not found` };
    if (employment.status === 'ended') return { ok: true, data: employment };
    if (!nonBlank(reason)) return { ok: false, error: 'end reason is required' };
    const updated = this.repository.updateEmploymentStatus(
      employmentId,
      'ended',
      employment.version,
      this.now().toISOString(),
      reason.trim(),
    );
    return updated ? { ok: true, data: updated } : { ok: false, error: 'employment changed concurrently' };
  }

  transferEmployment(
    employmentId: string,
    targetPositionId: string,
    reason: string,
  ): OrganizationResult<EmploymentRecord> {
    const employment = this.repository.getEmployment(employmentId);
    if (!employment) return { ok: false, error: `employment '${employmentId}' not found` };
    if (employment.status === 'ended') return { ok: false, error: 'ended employment cannot be transferred' };
    const target = this.repository.getPosition(targetPositionId);
    if (!target) return { ok: false, error: `position '${targetPositionId}' not found` };
    if (target.organizationId !== employment.organizationId) {
      return { ok: false, error: 'target position must belong to the same organization' };
    }
    if (this.repository.getCurrentEmploymentByPosition(targetPositionId)) {
      return { ok: false, error: `position '${targetPositionId}' already has a current employment` };
    }
    const ended = this.endEmployment(employmentId, reason);
    if (!ended.ok) return ended;
    return this.employ({
      organizationId: employment.organizationId,
      positionId: targetPositionId,
      subjectKind: employment.subjectKind,
      subjectRef: employment.subjectRef,
      employmentKind: employment.employmentKind,
      startedAt: this.now().toISOString(),
      metadata: { ...(employment.metadata ?? {}), transferredFromEmploymentId: employment.id },
    });
  }

  snapshot(organizationId: string): OrganizationResult<OrganizationSnapshot> {
    const organization = this.repository.getOrganization(organizationId);
    if (!organization) return { ok: false, error: `organization '${organizationId}' not found` };
    return {
      ok: true,
      data: {
        organization,
        units: this.repository.listUnits(organizationId),
        positions: this.repository.listPositions(organizationId),
        employments: this.repository.listEmployments(organizationId, true),
      },
    };
  }

  getOrganization(idOrSlug: string): OrganizationRecord | null {
    return this.repository.getOrganization(idOrSlug) ?? this.repository.getOrganizationBySlug(idOrSlug);
  }

  listOrganizations(): OrganizationRecord[] {
    return this.repository.listOrganizations();
  }
}
