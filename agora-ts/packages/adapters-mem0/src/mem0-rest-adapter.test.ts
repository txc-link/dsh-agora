import { describe, expect, it, vi } from 'vitest';
import { Mem0RestAdapter } from './mem0-rest-adapter.js';

function makeFetch(overrides: { status?: number; body?: unknown } = {}) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = vi.fn(async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const status = overrides.status ?? 200;
    const body = overrides.body ?? { results: [] };
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe('Mem0RestAdapter.add', () => {
  it('POST /memories: messages+user_id+metadata(infer=false), Bearer token', async () => {
    const { impl, calls } = makeFetch({ body: { results: [{ id: 'm1', created_at: '2026-08-30T00:00:00Z' }] } });
    const adapter = new Mem0RestAdapter({ baseUrl: 'http://x:8888/', token: 'tok-1', fetchImpl: impl });
    const entry = await adapter.add({
      scopeRef: 'project:OC-1', agentRef: 'agent:dev-1', kind: 'lesson', text: '先备份 db',
    });
    expect(entry.id).toBe('m1');
    const { url, init } = calls[0];
    expect(url).toBe('http://x:8888/memories');
    const payload = JSON.parse(String(init.body));
    expect(payload.messages[0].content).toBe('先备份 db');
    expect(payload.user_id).toBe('project:OC-1');
    expect(payload.infer).toBe(false);
    expect(payload.metadata.agent_ref).toBe('agent:dev-1');
    expect(payload.metadata.kind).toBe('lesson');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok-1');
  });

  it('401 → 明确认证错误', async () => {
    const { impl } = makeFetch({ status: 401, body: { detail: 'unauthorized' } });
    const adapter = new Mem0RestAdapter({ baseUrl: 'http://x:8888', fetchImpl: impl });
    await expect(adapter.add({ scopeRef: 'g', agentRef: 'a', kind: 'fact', text: 'x' }))
      .rejects.toThrow(/mem0 auth failed/);
  });
});

describe('Mem0RestAdapter.search / list', () => {
  it('search: POST /search {query, user_id, top_k} → hits 映射', async () => {
    const { impl, calls } = makeFetch({
      body: { results: [{ id: 'm1', memory: '备份 db', score: 0.9, metadata: { kind: 'lesson' } }] },
    });
    const adapter = new Mem0RestAdapter({ baseUrl: 'http://x:8888', fetchImpl: impl });
    const hits = await adapter.search({ scopeRef: 'group:dev', query: '迁移', limit: 5 });
    expect(hits[0]).toMatchObject({ id: 'm1', text: '备份 db', score: 0.9 });
    const payload = JSON.parse(String(calls[0].init.body));
    expect(payload).toMatchObject({ query: '迁移', user_id: 'group:dev', top_k: 5 });
  });

  it('list: GET /memories?user_id= → entries 映射 (metadata 反解 scope/agent/kind)', async () => {
    const { impl, calls } = makeFetch({
      body: { results: [{ id: 'm1', memory: 'x', metadata: { scope_ref: 'group:dev', agent_ref: 'a', kind: 'fact' }, created_at: 't1' }] },
    });
    const adapter = new Mem0RestAdapter({ baseUrl: 'http://x:8888', fetchImpl: impl });
    const entries = await adapter.list({ scopeRef: 'group:dev', limit: 10 });
    expect(entries[0]).toMatchObject({ id: 'm1', scopeRef: 'group:dev', agentRef: 'a', kind: 'fact' });
    expect(calls[0].url).toContain('/memories?user_id=group%3Adev');
  });
});
