/**
 * org-hierarchy-resolver.ts — org-aware-work-os S1: 层级解析 (S3 委派路由依赖).
 *
 * chainToRoot: team → parent → … → 根 (环安全);
 * leadsAbove: agent 所在 team 链上的 lead 序列 (近→远, 委派/上报用);
 * subtreeAgents: team 及其子树全部成员 (群发/任务下发用)。
 */

import type { ITeamRepository, TeamRecord } from '@agora-ts/contracts';

export interface OrgHierarchyResolverOptions {
  teamRepo: Pick<ITeamRepository, 'getById' | 'listByProject' | 'listByMember'>;
}

export interface OrgTeamNode {
  team: TeamRecord;
  children: OrgTeamNode[];
}

export class OrgHierarchyResolver {
  private readonly teamRepo: Pick<ITeamRepository, 'getById' | 'listByProject' | 'listByMember'>;

  constructor(options: OrgHierarchyResolverOptions) {
    this.teamRepo = options.teamRepo;
  }

  /** agent 所在的 teams (跨项目) */
  teamsOf(agentRef: string): TeamRecord[] {
    return this.teamRepo.listByMember(agentRef);
  }

  /** team → 根 的链 (含自身); parent 缺失/环安全截断 */
  chainToRoot(teamId: string): TeamRecord[] {
    const chain: TeamRecord[] = [];
    const seen = new Set<string>();
    let cursor: string | null = teamId;
    while (cursor !== null && !seen.has(cursor)) {
      seen.add(cursor);
      const team = this.teamRepo.getById(cursor);
      if (!team) break;
      chain.push(team);
      cursor = team.parent_id;
    }
    return chain;
  }

  /** agent 的上报链: 每个 所属 team 的 chainToRoot 中除自身为 lead 的最顶层外, 全部 lead (近→远, 去重) */
  leadsAbove(agentRef: string): string[] {
    const result: string[] = [];
    const seen = new Set<string>();
    for (const team of this.teamsOf(agentRef)) {
      for (const node of this.chainToRoot(team.id)) {
        if (node.lead === agentRef) continue;
        if (!seen.has(node.lead)) {
          seen.add(node.lead);
          result.push(node.lead);
        }
      }
    }
    return result;
  }

  /** team 及其全部子树的成员 (含各 lead, 去重; 不含 human) */
  subtreeAgents(teamId: string): string[] {
    const result: string[] = [];
    const seenTeam = new Set<string>([teamId]);
    const queue: string[] = [teamId];
    while (queue.length > 0) {
      const current = queue.shift() as string;
      const team = this.teamRepo.getById(current);
      if (!team) continue;
      for (const member of team.members) {
        if (!result.includes(member)) result.push(member);
      }
      for (const child of this.teamRepo.listByProject(team.project_id)) {
        if (child.parent_id === current && !seenTeam.has(child.id)) {
          seenTeam.add(child.id);
          queue.push(child.id);
        }
      }
    }
    return result;
  }

  /** 项目组织树 (CLI org show 用) */
  orgTree(projectId: string): OrgTeamNode[] {
    const teams = this.teamRepo.listByProject(projectId);
    const byId = new Map<string, OrgTeamNode>();
    for (const team of teams) byId.set(team.id, { team, children: [] });
    const roots: OrgTeamNode[] = [];
    for (const node of byId.values()) {
      const parentId = node.team.parent_id;
      const parent = parentId ? byId.get(parentId) : undefined;
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
    return roots;
  }
}
