/**
 * task-claim-matcher.ts — org-aware-work-os S2 职责匹配 (纯函数).
 *
 * 匹配 agent(role + skills_ref) ↔ task(type + skill_policy):
 * - global_refs: 全局技能要求 (required=全满足, advisory=至少1)
 * - role_refs: 角色技能要求 (agent 角色命中时必须满足)
 * - 无 skill_policy: 默认匹配 (score=1)
 * 纯 Core, 无平台名 (§1)。
 */

import type { TaskSkillPolicyDto } from '@agora-ts/contracts';

export interface ClaimMatcherAgent {
  agentRef: string;
  roleId: string;
  skillsRef: readonly string[];
}

export interface ClaimMatcherTask {
  taskId: string;
  taskType: string;
  skillPolicy: TaskSkillPolicyDto | null;
}

export interface MatchResult {
  matched: boolean;
  score: number;
  roleMatched: boolean;
  missingSkills: string[];
  /** 命中原因 (供日志/广播). */
  reasons: string[];
}

/**
 * 判断一个 agent 是否匹配某任务 (用于认领).
 * score: global 命中数 + (role 命中 ? 1 : 0) + 1 (默认).
 */
export function matchTaskToAgent(task: ClaimMatcherTask, agent: ClaimMatcherAgent): MatchResult {
  const policy = task.skillPolicy;
  if (!policy) {
    return { matched: true, score: 1, roleMatched: false, missingSkills: [], reasons: ['no skill policy'] };
  }

  const agentSkills = new Set(agent.skillsRef);
  const reasons: string[] = [];
  const missingSkills: string[] = [];
  let score = 0;

  // 1. global_refs
  for (const skill of policy.global_refs) {
    if (agentSkills.has(skill)) {
      score += 1;
    } else {
      missingSkills.push(skill);
    }
  }
  if (policy.global_refs.length > 0) {
    reasons.push(`global skills: ${score}/${policy.global_refs.length}`);
  }

  // 2. role_refs
  const roleSkills = policy.role_refs[agent.roleId];
  let roleMatched = false;
  if (roleSkills && roleSkills.length > 0) {
    let roleHits = 0;
    const roleMissing: string[] = [];
    for (const skill of roleSkills) {
      if (agentSkills.has(skill)) {
        roleHits += 1;
        score += 1;
      } else {
        roleMissing.push(skill);
      }
    }
    roleMatched = roleHits === roleSkills.length;
    reasons.push(`role '${agent.roleId}' skills: ${roleHits}/${roleSkills.length}`);
    if (!roleMatched && policy.enforcement === 'required') {
      missingSkills.push(...roleMissing);
    }
  } else {
    roleMatched = true; // 角色无技能要求 → 视为命中
  }

  // 3. 判定
  const globalOk = policy.enforcement === 'required'
    ? missingSkills.length === 0
    : score > 0;
  const matched = globalOk && roleMatched;

  return { matched, score: matched ? score + 1 : score, roleMatched, missingSkills, reasons };
}
