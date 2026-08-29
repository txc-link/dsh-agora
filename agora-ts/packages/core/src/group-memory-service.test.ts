import { describe, expect, it, vi } from 'vitest';
import { GroupMemoryService } from './group-memory-service.js';
import type { GroupMemoryEntry, GroupMemoryHit, GroupMemoryPort } from './group-memory-ports.js';

function makePort(): GroupMemoryPort & { addCalls: unknown[]; searchCalls: unknown[] } {
  const addCalls: unknown[] = [];
  const searchCalls: unknown[] = [];
  return {
    addCalls,
    searchCalls,
    add: vi.fn(async (input) => {
      addCalls.push(input);
      return {
        id: 'mem-1',
        scopeRef: input.scopeRef,
        agentRef: input.agentRef,
        kind: input.kind,
        text: input.text,
        createdAt: '2026-08-30T10:00:00.000Z',
        metadata: input.metadata ?? null,
      } satisfies GroupMemoryEntry;
    }),
    search: vi.fn(async (input) => {
      searchCalls.push(input);
      return [
        { id: 'mem-1', text: '用 migrate 前先备份 db', score: 0.87, metadata: { kind: 'lesson' } },
      ] satisfies GroupMemoryHit[];
    }),
    list: vi.fn(async () => []),
  };
}

describe('GroupMemoryService.record', () => {
  it('合法条目 → port.add 透传 + 返回 entry', async () => {
    const port = makePort();
    const service = new GroupMemoryService({ memoryPort: port });
    const result = await service.record({
      scopeRef: 'project:OC-1',
      agentRef: 'agent:dev-1',
      kind: 'lesson',
      text: 'migrate 前先备份 db',
    });
    expect(result.ok).toBe(true);
    expect(result.data?.id).toBe('mem-1');
    expect(port.addCalls[0]).toMatchObject({ scopeRef: 'project:OC-1', kind: 'lesson' });
  });

  it('非法 kind 被拒', async () => {
    const service = new GroupMemoryService({ memoryPort: makePort() });
    const result = await service.record({
      scopeRef: 'g', agentRef: 'a', kind: 'bogus', text: 'x',
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('invalid kind');
  });

  it('缺 text 被拒', async () => {
    const service = new GroupMemoryService({ memoryPort: makePort() });
    const result = await service.record({
      scopeRef: 'g', agentRef: 'a', kind: 'fact', text: ' ',
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('text');
  });

  it('port 抛错 → ok:false 带错误信息', async () => {
    const port = makePort();
    port.add = vi.fn(async () => { throw new Error('boom'); });
    const service = new GroupMemoryService({ memoryPort: port });
    const result = await service.record({
      scopeRef: 'g', agentRef: 'a', kind: 'fact', text: 'x',
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('boom');
  });
});

describe('GroupMemoryService.recall / list', () => {
  it('recall 透传 scope+query+limit', async () => {
    const port = makePort();
    const service = new GroupMemoryService({ memoryPort: port });
    const result = await service.recall({ scopeRef: 'group:dev', query: '迁移备份', limit: 3 });
    expect(result.ok).toBe(true);
    expect(result.data?.[0].score).toBe(0.87);
    expect(port.searchCalls[0]).toMatchObject({ scopeRef: 'group:dev', query: '迁移备份', limit: 3 });
  });

  it('recall 缺 query 被拒', async () => {
    const service = new GroupMemoryService({ memoryPort: makePort() });
    const result = await service.recall({ scopeRef: 'g', query: '' });
    expect(result.ok).toBe(false);
  });

  it('list 透传 scope', async () => {
    const port = makePort();
    const service = new GroupMemoryService({ memoryPort: port });
    const result = await service.list({ scopeRef: 'project:OC-1' });
    expect(result.ok).toBe(true);
    expect(result.data).toEqual([]);
  });
});
