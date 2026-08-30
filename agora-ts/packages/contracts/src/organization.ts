export type OrganizationStatus = 'active' | 'archived';
export type OrganizationUnitKind = 'executive_office' | 'department' | 'team';
export type OrganizationUnitStatus = 'active' | 'archived';
export type PositionKind = 'executive_assistant' | 'lead' | 'specialist' | 'worker' | 'auditor';
export type PositionStatus = 'active' | 'archived';
export type EmploymentSubjectKind = 'human' | 'agent';
export type EmploymentKind = 'resident' | 'on_demand' | 'advisor';
export type EmploymentStatus = 'active' | 'suspended' | 'ended';

export interface OrganizationRecord {
  id: string;
  slug: string;
  name: string;
  ownerRef: string;
  /** Information-governance domain inherited by every unit in this organization. */
  informationDomain: string;
  purpose: string | null;
  status: OrganizationStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown> | null;
}

export interface OrganizationUnitRecord {
  id: string;
  organizationId: string;
  name: string;
  kind: OrganizationUnitKind;
  parentUnitId: string | null;
  responsibilities: string[];
  status: OrganizationUnitStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown> | null;
}

export interface PositionRecord {
  id: string;
  organizationId: string;
  unitId: string;
  title: string;
  kind: PositionKind;
  reportsToPositionId: string | null;
  responsibilities: string[];
  skills: string[];
  status: PositionStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown> | null;
}

export interface EmploymentRecord {
  id: string;
  organizationId: string;
  positionId: string;
  subjectKind: EmploymentSubjectKind;
  subjectRef: string;
  employmentKind: EmploymentKind;
  status: EmploymentStatus;
  startedAt: string;
  endedAt: string | null;
  endedReason: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown> | null;
}

export interface OrganizationSnapshot {
  organization: OrganizationRecord;
  units: OrganizationUnitRecord[];
  positions: PositionRecord[];
  /** Includes ended records so reporting and transfer history survives. */
  employments: EmploymentRecord[];
}

export interface InsertOrganizationInput {
  id?: string;
  slug: string;
  name: string;
  ownerRef: string;
  informationDomain: string;
  purpose?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface InsertOrganizationUnitInput {
  id?: string;
  organizationId: string;
  name: string;
  kind: OrganizationUnitKind;
  parentUnitId?: string | null;
  responsibilities?: string[];
  metadata?: Record<string, unknown> | null;
}

export interface InsertPositionInput {
  id?: string;
  organizationId: string;
  unitId: string;
  title: string;
  kind: PositionKind;
  reportsToPositionId?: string | null;
  responsibilities?: string[];
  skills?: string[];
  metadata?: Record<string, unknown> | null;
}

export interface InsertEmploymentInput {
  id?: string;
  organizationId: string;
  positionId: string;
  subjectKind: EmploymentSubjectKind;
  subjectRef: string;
  employmentKind: EmploymentKind;
  startedAt: string;
  metadata?: Record<string, unknown> | null;
}

export interface IOrganizationRepository {
  insertOrganization(input: InsertOrganizationInput): OrganizationRecord;
  getOrganization(organizationId: string): OrganizationRecord | null;
  getOrganizationBySlug(slug: string): OrganizationRecord | null;
  listOrganizations(): OrganizationRecord[];

  insertUnit(input: InsertOrganizationUnitInput): OrganizationUnitRecord;
  getUnit(unitId: string): OrganizationUnitRecord | null;
  listUnits(organizationId: string): OrganizationUnitRecord[];
  updateUnitParent(
    unitId: string,
    parentUnitId: string | null,
    expectedVersion: number,
  ): OrganizationUnitRecord | null;

  insertPosition(input: InsertPositionInput): PositionRecord;
  getPosition(positionId: string): PositionRecord | null;
  listPositions(organizationId: string): PositionRecord[];
  updatePositionManager(
    positionId: string,
    reportsToPositionId: string | null,
    expectedVersion: number,
  ): PositionRecord | null;

  insertEmployment(input: InsertEmploymentInput): EmploymentRecord;
  getEmployment(employmentId: string): EmploymentRecord | null;
  getCurrentEmploymentByPosition(positionId: string): EmploymentRecord | null;
  listEmployments(organizationId: string, includeEnded?: boolean): EmploymentRecord[];
  updateEmploymentStatus(
    employmentId: string,
    status: EmploymentStatus,
    expectedVersion: number,
    endedAt?: string | null,
    endedReason?: string | null,
  ): EmploymentRecord | null;
}
