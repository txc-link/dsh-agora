/**
 * team-service.ts — org-aware-work-os S1: team 聚合编排 (§1 纯 Core).
 *
 * 语义: 每项目一个组织; team = lead + members + responsibilities + parent 层级;
 * lead 必须是成员; parent 须同项目且不成环; 有子团队的 team 不可删 (显式语义, 不静默级联)。
 */

import type { ITeamRepository, TeamRecord } from '@agora-ts/contracts';

export type TeamResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface TeamServiceOptions {
  teamRepo: ITeamRepository;
}

export interface CreateTeamInput {
  projectId: string;
  name: string;
  lead: string;
  members?: string[];
  responsibilities?: string[];
  parentId?: string | null;
}

function findCycleStart(teamRepo: ITeamRepository, teamId: string, parentId: string): boolean {
  const seen = new Set<string>([teamId]);
  let cursor: string | null = parentId;
  while (cursor !== null) {
    if (seen.has(cursor)) return true;
    seen.add(cursor);
    const parent: TeamRecord | null = teamRepo.getById(cursor);
    if (!parent) return false;
    cursor = parent.parent_id;
  }
  return false;
}

export class TeamService {
  private readonly teamRepo: ITeamRepository;

  constructor(options: TeamServiceOptions) {
    this.teamRepo = options.teamRepo;
  }

  createTeam(input: CreateTeamInput): TeamResult<TeamRecord> {
    if (!input.projectId || !input.name || !input.lead) {
      return { ok: false, error: 'projectId, name and lead are required' };
    }
    const members = input.members ?? [input.lead];
    if (!members.includes(input.lead)) {
      return { ok: false, error: `lead '${input.lead}' must be a member of team '${input.name}'` };
    }
    if (input.parentId) {
      const parent = this.teamRepo.getById(input.parentId);
      if (!parent) return { ok: false, error: `parent team '${input.parentId}' not found` };
      if (parent.project_id !== input.projectId) {
        return { ok: false, error: `parent team '${input.parentId}' belongs to project '${parent.project_id}'` };
      }
    }
    try {
      const team = this.teamRepo.insert({
        project_id: input.projectId,
        name: input.name,
        lead: input.lead,
        members,
        responsibilities: input.responsibilities ?? [],
        parent_id: input.parentId ?? null,
      });
      return { ok: true, data: team };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('UNIQUE')) {
        return { ok: false, error: `team '${input.name}' already exists in project '${input.projectId}'` };
      }
      return { ok: false, error: message };
    }
  }

  addMember(teamId: string, agentRef: string): TeamResult<TeamRecord> {
    const team = this.teamRepo.getById(teamId);
    if (!team) return { ok: false, error: `team '${teamId}' not found` };
    if (team.members.includes(agentRef)) return { ok: true, data: team };
    const updated = this.teamRepo.update(teamId, { members: [...team.members, agentRef] });
    return updated ? { ok: true, data: updated } : { ok: false, error: 'team update failed' };
  }

  removeMember(teamId: string, agentRef: string): TeamResult<TeamRecord> {
    const team = this.teamRepo.getById(teamId);
    if (!team) return { ok: false, error: `team '${teamId}' not found` };
    if (team.lead === agentRef) {
      return { ok: false, error: `cannot remove lead '${agentRef}'; set a new lead first` };
    }
    const updated = this.teamRepo.update(teamId, {
      members: team.members.filter((m) => m !== agentRef),
    });
    return updated ? { ok: true, data: updated } : { ok: false, error: 'team update failed' };
  }

  setLead(teamId: string, agentRef: string): TeamResult<TeamRecord> {
    const team = this.teamRepo.getById(teamId);
    if (!team) return { ok: false, error: `team '${teamId}' not found` };
    const members = team.members.includes(agentRef) ? team.members : [...team.members, agentRef];
    const updated = this.teamRepo.update(teamId, { lead: agentRef, members });
    return updated ? { ok: true, data: updated } : { ok: false, error: 'team update failed' };
  }

  setParent(teamId: string, parentId: string | null): TeamResult<TeamRecord> {
    const team = this.teamRepo.getById(teamId);
    if (!team) return { ok: false, error: `team '${teamId}' not found` };
    if (parentId) {
      const parent = this.teamRepo.getById(parentId);
      if (!parent) return { ok: false, error: `parent team '${parentId}' not found` };
      if (parent.project_id !== team.project_id) {
        return { ok: false, error: `parent team '${parentId}' belongs to project '${parent.project_id}'` };
      }
      if (findCycleStart(this.teamRepo, teamId, parentId)) {
        return { ok: false, error: `setting parent '${parentId}' would create a cycle` };
      }
    }
    const updated = this.teamRepo.update(teamId, { parent_id: parentId });
    return updated ? { ok: true, data: updated } : { ok: false, error: 'team update failed' };
  }

  deleteTeam(teamId: string): TeamResult<{ deleted: true }> {
    const team = this.teamRepo.getById(teamId);
    if (!team) return { ok: false, error: `team '${teamId}' not found` };
    const children = this.teamRepo.listByProject(team.project_id).filter((t) => t.parent_id === teamId);
    if (children.length > 0) {
      return { ok: false, error: `team '${teamId}' has ${children.length} child team(s); reassign them first` };
    }
    this.teamRepo.delete(teamId);
    return { ok: true, data: { deleted: true } };
  }

  get(teamId: string): TeamRecord | null {
    return this.teamRepo.getById(teamId);
  }

  listByProject(projectId: string): TeamRecord[] {
    return this.teamRepo.listByProject(projectId);
  }

  listByAgent(agentRef: string): TeamRecord[] {
    return this.teamRepo.listByMember(agentRef);
  }
}
