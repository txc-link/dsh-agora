/**
 * group-memory-service.ts — org-aware-work-os S4 群组共享记忆服务 (§1).
 *
 * 纯 Core 编排: 校验 + 统一入口语义; 存储 SSoT 在 GroupMemoryPort adapter。
 * S6 论坛与任务生命周期的经验沉淀/检索都接本服务。
 */

import type {
  GroupMemoryAddInput,
  GroupMemoryEntry,
  GroupMemoryHit,
  GroupMemoryListInput,
  GroupMemoryPort,
  GroupMemoryQueryInput,
} from './group-memory-ports.js';

export type { GroupMemoryEntry, GroupMemoryHit, GroupMemoryPort };

export interface GroupMemoryServiceOptions {
  memoryPort: GroupMemoryPort;
}

export type GroupMemoryResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const VALID_KINDS = new Set(['lesson', 'howto', 'fact', 'decision', 'research']);

function requireNonEmpty(value: string | undefined, field: string): string | null {
  if (value === undefined || value.trim().length === 0) {
    return `${field} is required`;
  }
  return null;
}

export class GroupMemoryService {
  private readonly memoryPort: GroupMemoryPort;

  constructor(options: GroupMemoryServiceOptions) {
    this.memoryPort = options.memoryPort;
  }

  async record(input: GroupMemoryAddInput): Promise<GroupMemoryResult<GroupMemoryEntry>> {
    const missing = requireNonEmpty(input.scopeRef, 'scopeRef')
      ?? requireNonEmpty(input.agentRef, 'agentRef')
      ?? requireNonEmpty(input.kind, 'kind')
      ?? requireNonEmpty(input.text, 'text');
    if (missing) return { ok: false, error: missing };
    if (!VALID_KINDS.has(input.kind)) {
      return { ok: false, error: `invalid kind '${input.kind}'; valid: ${[...VALID_KINDS].join('|')}` };
    }
    try {
      const entry = await this.memoryPort.add(input);
      return { ok: true, data: entry };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async recall(input: GroupMemoryQueryInput): Promise<GroupMemoryResult<GroupMemoryHit[]>> {
    const missing = requireNonEmpty(input.scopeRef, 'scopeRef') ?? requireNonEmpty(input.query, 'query');
    if (missing) return { ok: false, error: missing };
    try {
      const hits = await this.memoryPort.search(input);
      return { ok: true, data: hits };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async list(input: GroupMemoryListInput): Promise<GroupMemoryResult<GroupMemoryEntry[]>> {
    const missing = requireNonEmpty(input.scopeRef, 'scopeRef');
    if (missing) return { ok: false, error: missing };
    try {
      const entries = await this.memoryPort.list(input);
      return { ok: true, data: entries };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}
