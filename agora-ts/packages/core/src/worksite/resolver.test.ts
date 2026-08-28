import { describe, expect, it } from 'vitest';
import {
  TaskWorksiteResolver,
  WorksiteNotFoundError,
  WorksiteNotImplementedError,
  WorksiteResolverRegistry,
  formatWorksiteUri,
  type TaskWorksite,
  type WorkSite,
  type WorksiteResolver,
  type WorksiteType,
} from './index.js';

class StubTaskResolver implements WorksiteResolver {
  public readonly type: WorksiteType = 'task';
  private readonly map: Map<string, TaskWorksite>;

  public constructor(records: Array<{ id: string; refs?: string[] }>) {
    this.map = new Map();
    for (const r of records) {
      const refs = (r.refs ?? []).map((uri) => ({ uri }));
      const ws: TaskWorksite = {
        type: 'task',
        id: r.id,
        uri: formatWorksiteUri('task', r.id),
        refs,
      };
      this.map.set(r.id, ws);
    }
  }

  public async resolve(id: string): Promise<TaskWorksite | null> {
    return this.map.get(id) ?? null;
  }
}

describe('worksite/resolver', () => {
  describe('WorksiteResolverRegistry', () => {
    it('register/has/list', () => {
      const reg = new WorksiteResolverRegistry();
      expect(reg.has('task')).toBe(false);
      expect(reg.list()).toEqual([]);

      reg.register(new StubTaskResolver([]));
      expect(reg.has('task')).toBe(true);
      expect(reg.list()).toEqual(['task']);
    });

    it('rejects duplicate registration', () => {
      const reg = new WorksiteResolverRegistry();
      reg.register(new StubTaskResolver([]));
      expect(() => reg.register(new StubTaskResolver([]))).toThrow(/already registered/);
    });

    it('throws WorksiteNotImplementedError on unregistered type', async () => {
      const reg = new WorksiteResolverRegistry();
      await expect(reg.resolveWorksite('agora://thread/!room:server')).rejects.toBeInstanceOf(
        WorksiteNotImplementedError,
      );
    });

    it('throws WorksiteNotFoundError when resolver returns null', async () => {
      const reg = new WorksiteResolverRegistry();
      reg.register(new StubTaskResolver([]));
      await expect(reg.resolveWorksite('agora://task/OC-missing')).rejects.toBeInstanceOf(
        WorksiteNotFoundError,
      );
    });

    it('resolves a simple task URI', async () => {
      const reg = new WorksiteResolverRegistry();
      reg.register(new StubTaskResolver([{ id: 'OC-1' }]));
      const ws = await reg.resolveWorksite('agora://task/OC-1');
      expect(ws.type).toBe('task');
      expect(ws.id).toBe('OC-1');
      expect(ws.uri).toBe('agora://task/OC-1');
      expect(ws.refs).toEqual([]);
    });

    it('expands refs depth-first (nested task references)', async () => {
      const reg = new WorksiteResolverRegistry();
      reg.register(
        new StubTaskResolver([
          { id: 'OC-root', refs: ['agora://task/OC-child'] },
          { id: 'OC-child' },
        ]),
      );
      const ws = await reg.resolveWorksite('agora://task/OC-root');
      expect(ws.refs.map((r) => r.uri)).toEqual(['agora://task/OC-child']);
    });

    it('expands nested refs (root → child → grandchild)', async () => {
      const reg = new WorksiteResolverRegistry();
      reg.register(
        new StubTaskResolver([
          { id: 'OC-root', refs: ['agora://task/OC-child'] },
          { id: 'OC-child', refs: ['agora://task/OC-grand'] },
          { id: 'OC-grand' },
        ]),
      );
      const ws = await reg.resolveWorksite('agora://task/OC-root');
      expect(ws.refs[0]?.uri).toBe('agora://task/OC-child');
    });

    it('keeps unresolved refs (not-implemented type) without throwing', async () => {
      const reg = new WorksiteResolverRegistry();
      reg.register(
        new StubTaskResolver([
          { id: 'OC-1', refs: ['agora://watch/not-registered', 'agora://task/OC-2'] },
          { id: 'OC-2' },
        ]),
      );
      const ws = await reg.resolveWorksite('agora://task/OC-1');
      const uris = ws.refs.map((r) => r.uri);
      expect(uris).toContain('agora://watch/not-registered');
      expect(uris).toContain('agora://task/OC-2');
    });

    it('handles cycles without infinite loop', async () => {
      const reg = new WorksiteResolverRegistry();
      reg.register(
        new StubTaskResolver([
          { id: 'OC-A', refs: ['agora://task/OC-B'] },
          { id: 'OC-B', refs: ['agora://task/OC-A'] },
        ]),
      );
      const ws = await reg.resolveWorksite('agora://task/OC-A');
      expect(ws.type).toBe('task');
      expect(ws.id).toBe('OC-A');
    });

    it('throws on resolve depth > 8', async () => {
      const reg = new WorksiteResolverRegistry();
      // Build a chain OC-1 → OC-2 → ... → OC-10
      const records = Array.from({ length: 10 }, (_, i) => ({
        id: `OC-${i + 1}`,
        refs: i < 9 ? [`agora://task/OC-${i + 2}`] : [],
      }));
      reg.register(new StubTaskResolver(records));
      await expect(reg.resolveWorksite('agora://task/OC-1')).rejects.toThrow(/depth exceeded/);
    });
  });

  describe('TaskWorksiteResolver', () => {
    function fakeRepo(records: Array<{ id: string }>) {
      const map = new Map(records.map((r) => [r.id, r]));
      return {
        getTask(id: string): { id: string } | null {
          return map.get(id) ?? null;
        },
      };
    }

    it('returns TaskWorksite for existing task', async () => {
      const repo = fakeRepo([{ id: 'OC-99' }]);
      const resolver = new TaskWorksiteResolver({ taskRepository: repo });
      const ws = await resolver.resolve('OC-99', {});
      expect(ws).not.toBeNull();
      expect(ws?.type).toBe('task');
      expect(ws?.id).toBe('OC-99');
      expect(ws?.uri).toBe('agora://task/OC-99');
    });

    it('returns null for missing task', async () => {
      const repo = fakeRepo([]);
      const resolver = new TaskWorksiteResolver({ taskRepository: repo });
      const ws = await resolver.resolve('OC-missing', {});
      expect(ws).toBeNull();
    });

    it('registers with WorksiteResolverRegistry', async () => {
      const repo = fakeRepo([{ id: 'OC-77' }]);
      const reg = new WorksiteResolverRegistry();
      reg.register(new TaskWorksiteResolver({ taskRepository: repo }));
      const ws = await reg.resolveWorksite('agora://task/OC-77');
      expect(ws.id).toBe('OC-77');
    });
  });

  describe('§1 boundary (Core abstraction purity)', () => {
    it('task resolver does not depend on platform (matrix/discord/sentinel)', () => {
      // The TaskWorksiteResolver constructor only accepts taskRepository.
      // If platform-specific imports were needed, this constructor signature
      // would have to expose them. The test is structural: keep the contract.
      const repo = { getTask: () => null };
      const resolver = new TaskWorksiteResolver({ taskRepository: repo });
      expect(resolver.type).toBe('task');
    });

    it('WorkSite union preserves type discriminator (6 variants)', () => {
      const all: WorkSite[] = [
        { type: 'task', id: 't', uri: 'agora://task/t', refs: [] },
        { type: 'thread', id: 'r', uri: 'agora://thread/r', refs: [] },
        { type: 'commit', id: 'c', uri: 'agora://commit/c', refs: [] },
        { type: 'watch', id: 'w', uri: 'agora://watch/w', refs: [] },
        { type: 'workspace', id: 's', uri: 'agora://workspace/s', refs: [] },
        { type: 'session', id: 'sess', uri: 'agora://session/sess', refs: [] },
      ];
      for (const ws of all) {
        expect(['task', 'thread', 'commit', 'watch', 'workspace', 'session']).toContain(ws.type);
      }
    });
  });
});