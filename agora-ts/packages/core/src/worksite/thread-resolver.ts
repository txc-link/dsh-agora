/**
 * ThreadWorksiteResolver — Phase 1 stub completion for `thread` type.
 *
 * §1 compliance: This resolver lives in Core. It depends ONLY on the
 * `ThreadSourcePort` abstraction defined here. No matrix-js-sdk, no
 * discord, no platform-specific imports. Composition root provides
 * the actual source implementation (matrix adapter in production,
 * filesystem stub in tests).
 *
 * Phase 1 left this as a stub: `resolveScopeAuthorization` and
 * `WorksiteResolverRegistry.resolve()` for thread URIs threw
 * `WorksiteNotImplementedError`. This implementation closes that gap.
 *
 * Platform-specific metadata (room name, topic, member count, etc.)
 * belongs in `adapterFields` per Phase 1's contract — not as typed
 * fields on ThreadWorksite. Core only consumes roomId (for the URI)
 * and optional scopeAuthorization (for borrow governance).
 */

import { formatWorksiteUri, type WorksiteType } from './uri.js';
import type { WorksiteResolver } from './resolver.js';
import type { ThreadWorksite, WorksiteResolutionContext } from './types.js';

/**
 * Thread metadata as the resolver sees it.
 *
 * Platform-specific fields go through `adapterFields` (a string map per
 * WorksiteMetadata). Core does NOT model them — adapter-side code can
 * read them through `threadWorksite.adapterFields`. The only typed
 * fields are the ones Core orchestration actually consumes:
 *   - roomId: identity, used in the URI
 *   - scopeAuthorization: drives borrow governance (Phase 3.5-3a)
 */
export interface ThreadMetadata {
  readonly roomId: string;
  readonly scopeAuthorization?: ThreadWorksite['scopeAuthorization'];
  readonly adapterFields?: Readonly<Record<string, string>>;
}

/**
 * Composition-root-injected source for thread metadata.
 *
 * Phase 1 stub: production adapter is matrix (T-1 will provide a
 * matrix-js-sdk-backed adapter). Tests use in-memory Map. Future
 * sources (Slack thread, Discord thread) plug in here without
 * touching Core.
 */
export interface ThreadSourcePort {
  getThreadMetadata(roomId: string): Promise<ThreadMetadata | undefined>;
  listRooms(): Promise<readonly string[]>;
}

export interface ThreadWorksiteResolverOptions {
  readonly threadSource: ThreadSourcePort;
}

export class ThreadWorksiteResolver implements WorksiteResolver {
  public readonly type: WorksiteType = 'thread';

  private readonly threadSource: ThreadSourcePort;

  public constructor(options: ThreadWorksiteResolverOptions) {
    this.threadSource = options.threadSource;
  }

  public async resolve(
    id: string,
    _ctx: WorksiteResolutionContext,
  ): Promise<ThreadWorksite | null> {
    const meta = await this.threadSource.getThreadMetadata(id);
    if (!meta) {
      return null;
    }
    return toThreadWorksite(meta);
  }
}

/**
 * Pure mapper — ThreadMetadata → ThreadWorksite.
 *
 * Phase 1 keeps refs empty; Phase 3.5/4 can compute refs from agora
 * Task bindings or matrix thread → task links. That linkage belongs in
 * the adapter, not Core, and is out of scope for T-0.
 */
export function toThreadWorksite(meta: ThreadMetadata): ThreadWorksite {
  const uri = formatWorksiteUri('thread', meta.roomId);
  return Object.freeze({
    type: 'thread',
    id: meta.roomId,
    uri,
    refs: Object.freeze([]) as ThreadWorksite['refs'],
    ...(meta.scopeAuthorization !== undefined ? { scopeAuthorization: meta.scopeAuthorization } : {}),
    ...(meta.adapterFields !== undefined ? { adapterFields: meta.adapterFields } : {}),
  });
}