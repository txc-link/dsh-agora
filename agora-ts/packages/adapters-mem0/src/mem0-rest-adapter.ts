/**
 * mem0-rest-adapter.ts — org-aware-work-os S4: mem0 REST adapter (§1 adapter 层).
 *
 * implements GroupMemoryPort (core 端口), 对接 mem0 REST server:
 *   POST /memories  {messages:[{role,content}], user_id, metadata, infer}
 *   POST /search    {query, user_id, top_k}
 *   GET  /memories?user_id=&limit=
 * scopeRef 直接映射 mem0 user_id; infer=false 保真存储经验原文 (D2)。
 * fetch 可注入 (TDD); 认证 Bearer token (mem0 JWT/API key)。
 */

import type {
  GroupMemoryAddInput,
  GroupMemoryEntry,
  GroupMemoryHit,
  GroupMemoryListInput,
  GroupMemoryPort,
  GroupMemoryQueryInput,
} from '@agora-ts/core';

export interface Mem0RestAdapterOptions {
  /** mem0 REST server 基址, 如 http://127.0.0.1:8888 */
  baseUrl: string;
  /** Bearer token (mem0 API key 或 JWT access token) */
  token?: string | null;
  /** 可注入 fetch (测试); 默认全局 fetch */
  fetchImpl?: typeof fetch;
  /** add 时是否让 mem0 LLM 抽取 (默认 false: 经验原文保真) */
  infer?: boolean;
}

interface Mem0MemoryRow {
  id: string | null;
  memory: string | null;
  score?: number | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
}

export class Mem0RestAdapter implements GroupMemoryPort {
  private readonly baseUrl: string;
  private readonly token: string | null;
  private readonly fetchImpl: typeof fetch;
  private readonly infer: boolean;

  constructor(options: Mem0RestAdapterOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.token = options.token ?? null;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.infer = options.infer ?? false;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) h.Authorization = `Bearer ${this.token}`;
    return h;
  }

  private async request(path: string, init: RequestInit): Promise<Record<string, unknown>> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, init);
    if (res.status === 401 || res.status === 403) {
      throw new Error(`mem0 auth failed (${res.status}): check MEM0 token/credentials`);
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`mem0 request failed (${res.status}): ${body.slice(0, 300)}`);
    }
    return (await res.json()) as Record<string, unknown>;
  }

  private static toEntry(row: Mem0MemoryRow): GroupMemoryEntry {
    const meta = row.metadata ?? {};
    return {
      id: row.id ?? '',
      scopeRef: String(meta['scope_ref'] ?? ''),
      agentRef: String(meta['agent_ref'] ?? ''),
      kind: String(meta['kind'] ?? ''),
      text: row.memory ?? '',
      createdAt: row.created_at ?? '',
      metadata: meta,
    };
  }

  async add(input: GroupMemoryAddInput): Promise<GroupMemoryEntry> {
    const payload = {
      messages: [{ role: 'user', content: input.text }],
      user_id: input.scopeRef,
      infer: this.infer,
      metadata: {
        scope_ref: input.scopeRef,
        agent_ref: input.agentRef,
        kind: input.kind,
        ...(input.metadata ?? {}),
      },
    };
    const data = await this.request('/memories', {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(payload),
    });
    const results = (data['results'] as Mem0MemoryRow[] | undefined) ?? [];
    const first = results[0];
    return {
      id: first?.id ?? '',
      scopeRef: input.scopeRef,
      agentRef: input.agentRef,
      kind: input.kind,
      text: input.text,
      createdAt: first?.created_at ?? new Date().toISOString(),
      metadata: input.metadata ?? null,
    };
  }

  async search(input: GroupMemoryQueryInput): Promise<GroupMemoryHit[]> {
    const data = await this.request('/search', {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        query: input.query,
        user_id: input.scopeRef,
        ...(input.limit !== undefined ? { top_k: input.limit } : {}),
      }),
    });
    const results = (data['results'] as Mem0MemoryRow[] | undefined) ?? [];
    return results.map((row) => ({
      id: row.id ?? '',
      text: row.memory ?? '',
      score: row.score ?? null,
      metadata: row.metadata ?? null,
    }));
  }

  async list(input: GroupMemoryListInput): Promise<GroupMemoryEntry[]> {
    const qs = new URLSearchParams({ user_id: input.scopeRef });
    if (input.limit !== undefined) qs.set('limit', String(input.limit));
    const data = await this.request(`/memories?${qs.toString()}`, {
      method: 'GET',
      headers: this.headers(),
    });
    const results = (data['results'] as Mem0MemoryRow[] | undefined) ?? [];
    return results.map((row) => Mem0RestAdapter.toEntry(row));
  }
}
