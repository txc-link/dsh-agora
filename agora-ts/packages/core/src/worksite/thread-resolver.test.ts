/**
 * thread-resolver.test.ts — T-0 TDD
 *
 * ThreadWorksiteResolver should:
 *   - claim `type === 'thread'`
 *   - resolve(id, ctx) → ThreadWorksite with scopeAuthorization + adapterFields fetched via injected ThreadSourcePort
 *   - return null when port has no record for the id
 *   - Core only consumes roomId/scopeAuthorization; platform-specific fields go through adapterFields
 */

import { describe, expect, it } from 'vitest';
import { ThreadWorksiteResolver, type ThreadSourcePort, type ThreadMetadata } from './thread-resolver.js';

class InMemoryThreadSource implements ThreadSourcePort {
  private readonly byRoom = new Map<string, ThreadMetadata>();
  set(meta: ThreadMetadata): void { this.byRoom.set(meta.roomId, meta); }
  async getThreadMetadata(roomId: string): Promise<ThreadMetadata | undefined> {
    return this.byRoom.get(roomId);
  }
  async listRooms(): Promise<readonly string[]> {
    return [...this.byRoom.keys()];
  }
}

describe('ThreadWorksiteResolver', () => {
  it('claims type=thread', () => {
    const resolver = new ThreadWorksiteResolver({ threadSource: new InMemoryThreadSource() });
    expect(resolver.type).toBe('thread');
  });

  it('returns null when threadSource has no metadata for the id', async () => {
    const resolver = new ThreadWorksiteResolver({ threadSource: new InMemoryThreadSource() });
    const result = await resolver.resolve('mx_missing', {});
    expect(result).toBeNull();
  });

  it('returns ThreadWorksite with scopeAuthorization from port', async () => {
    const source = new InMemoryThreadSource();
    source.set({
      roomId: 'mx_abc123',
      scopeAuthorization: {
        scope: 'agora://workspace/repoA',
        posture: 'Auto',
        permissions: ['read', 'write'],
      },
    });
    const resolver = new ThreadWorksiteResolver({ threadSource: source });
    const result = await resolver.resolve('mx_abc123', {});
    expect(result).not.toBeNull();
    expect(result?.type).toBe('thread');
    expect(result?.id).toBe('mx_abc123');
    expect(result?.uri).toBe('agora://thread/mx_abc123');
    expect(result?.scopeAuthorization).toEqual({
      scope: 'agora://workspace/repoA',
      posture: 'Auto',
      permissions: ['read', 'write'],
    });
    expect(result?.refs).toEqual([]);
  });

  it('forwards adapterFields for platform-specific metadata', async () => {
    const source = new InMemoryThreadSource();
    source.set({
      roomId: 'mx_meta',
      adapterFields: {
        name: 'matrix bridge room',
        topic: 'thread mirror for borrow',
        memberCount: '4',
        lastEventAt: '2026-08-30T01:00:00Z',
      },
    });
    const resolver = new ThreadWorksiteResolver({ threadSource: source });
    const result = await resolver.resolve('mx_meta', {});
    expect(result?.adapterFields).toEqual({
      name: 'matrix bridge room',
      topic: 'thread mirror for borrow',
      memberCount: '4',
      lastEventAt: '2026-08-30T01:00:00Z',
    });
  });

  it('returns ThreadWorksite without scopeAuthorization when port omits it', async () => {
    const source = new InMemoryThreadSource();
    source.set({ roomId: 'mx_minimal' });
    const resolver = new ThreadWorksiteResolver({ threadSource: source });
    const result = await resolver.resolve('mx_minimal', {});
    expect(result).not.toBeNull();
    expect(result?.id).toBe('mx_minimal');
    expect(result?.uri).toBe('agora://thread/mx_minimal');
    expect(result?.scopeAuthorization).toBeUndefined();
  });

  it('preserves empty refs list (Phase 1 stub)', async () => {
    const source = new InMemoryThreadSource();
    source.set({ roomId: 'mx_empty_refs' });
    const resolver = new ThreadWorksiteResolver({ threadSource: source });
    const result = await resolver.resolve('mx_empty_refs', {});
    expect(result?.refs).toEqual([]);
  });

  it('exposes listRooms via the port for bulk enumeration', async () => {
    const source = new InMemoryThreadSource();
    source.set({ roomId: 'mx_a' });
    source.set({ roomId: 'mx_b' });
    const resolver = new ThreadWorksiteResolver({ threadSource: source });
    const rooms = await resolver['threadSource'].listRooms();
    expect(rooms.sort()).toEqual(['mx_a', 'mx_b']);
  });
});