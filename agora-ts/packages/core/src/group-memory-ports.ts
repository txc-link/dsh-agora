/**
 * group-memory-ports.ts — org-aware-work-os S4 群组共享记忆端口 (§1).
 *
 * 共享记忆的存储 SSoT 在外部 (mem0/obsidian 等 adapter), core 只表达语义:
 * scope (项目/群组/agent 维度) + agent 经验条目 (lesson/howto/...) + 检索。
 * 无平台名, adapter 注入 (§1 解耦)。
 */

export interface GroupMemoryEntry {
  id: string;
  /** 记忆域: 'project:<id>' | 'group:<name>' | 'agent:<ref>' */
  scopeRef: string;
  /** 记录者 */
  agentRef: string;
  /** 条目类型: lesson | howto | fact | decision | research */
  kind: string;
  text: string;
  createdAt: string;
  metadata: Record<string, unknown> | null;
}

export interface GroupMemoryAddInput {
  scopeRef: string;
  agentRef: string;
  kind: string;
  text: string;
  metadata?: Record<string, unknown> | null;
}

export interface GroupMemoryQueryInput {
  scopeRef: string;
  query: string;
  limit?: number;
}

export interface GroupMemoryListInput {
  scopeRef: string;
  limit?: number;
}

export interface GroupMemoryHit {
  id: string;
  text: string;
  score: number | null;
  metadata: Record<string, unknown> | null;
}

export interface GroupMemoryPort {
  add(input: GroupMemoryAddInput): Promise<GroupMemoryEntry>;
  search(input: GroupMemoryQueryInput): Promise<GroupMemoryHit[]>;
  list(input: GroupMemoryListInput): Promise<GroupMemoryEntry[]>;
}
