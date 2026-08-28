/**
 * WorksiteResolver — Core abstraction for resolving agora:// URIs to WorkSite objects.
 *
 * §1 compliance:
 * - Resolver lives in Core but knows nothing about specific adapter implementations.
 * - Each resolver is bound to ONE WorksiteType. Type-to-resolver mapping is the
 *   responsibility of the composition root (apps/server, apps/cli).
 * - Removing matrix/discord/sentinel should leave this resolver machinery intact.
 */

import {
  formatWorksiteUri,
  parseWorksiteUri,
  type WorksiteType,
  type WorksiteUri,
} from './uri.js';
import type {
  WorkSite,
  WorksiteResolutionContext,
} from './types.js';
import { WorksiteNotFoundError, WorksiteNotImplementedError } from './types.js';

/** Bound to one type. Implementations fetch WorkSite objects. */
export interface WorksiteResolver {
  readonly type: WorksiteType;
  /** Pure fetch — no side effects, no I/O during planning. */
  resolve(id: string, ctx: WorksiteResolutionContext): Promise<WorkSite | null>;
}

/**
 * Bound to one type. Implementations accept a WorkSite and persist it.
 * Returns the canonical WorkSite with resolved refs.
 *
 * Phase 1: TaskResolver implements this for `task` only. Other types
 * remain as resolver stubs (resolve only) until their adapters land.
 */
export interface WorksitePersister<TIn extends WorkSite = WorkSite> {
  readonly type: WorksiteType;
  persist(worksite: TIn, ctx: WorksiteResolutionContext): Promise<WorkSite>;
}

export const RESOLVE_MAX_DEPTH = 8;

export class WorksiteResolverRegistry {
  private readonly resolvers = new Map<WorksiteType, WorksiteResolver>();

  public register(resolver: WorksiteResolver): void {
    if (this.resolvers.has(resolver.type)) {
      throw new Error(`WorksiteResolver already registered for type "${resolver.type}"`);
    }
    this.resolvers.set(resolver.type, resolver);
  }

  public has(type: WorksiteType): boolean {
    return this.resolvers.has(type);
  }

  public list(): readonly WorksiteType[] {
    return Array.from(this.resolvers.keys()).sort();
  }

  /**
   * Resolve an agora:// URI into a fully expanded WorkSite with refs pulled.
   *
   * Phase 1 semantics:
   * - Depth-first resolve of nested refs up to RESOLVE_MAX_DEPTH
   * - Cycles return a stub Worksite with the cycle URI (no infinite loop)
   * - Unregistered types throw WorksiteNotImplementedError (strict — §1.5 no fallback)
   * - Resolver returns null (not found) → WorksiteNotFoundError
   */
  public async resolveWorksite(
    uri: string,
    ctx: WorksiteResolutionContext = {},
  ): Promise<WorkSite> {
    const parsed = parseWorksiteUri(uri);
    return resolveRecursive(parsed, this, new Set(), 0, ctx);
  }
}

async function resolveRecursive(
  parsed: WorksiteUri,
  registry: WorksiteResolverRegistry,
  visited: Set<string>,
  depth: number,
  ctx: WorksiteResolutionContext,
): Promise<WorkSite> {
  const fullUri = formatWorksiteUri(parsed.type, parsed.id);
  if (visited.has(fullUri)) {
    return buildStubWithCycle(parsed.type, parsed.id, fullUri);
  }
  if (depth > RESOLVE_MAX_DEPTH) {
    throw new Error(`WorkSite resolve depth exceeded ${RESOLVE_MAX_DEPTH} at ${fullUri}`);
  }

  const resolver = registry['resolvers'].get(parsed.type);
  if (!resolver) {
    throw new WorksiteNotImplementedError(parsed.type, parsed.id);
  }

  const nextVisited = new Set(visited);
  nextVisited.add(fullUri);

  const resolved = await resolver.resolve(parsed.id, ctx);
  if (resolved === null) {
    throw new WorksiteNotFoundError(fullUri);
  }

  // Expand refs (depth-limited, cycle-aware)
  const expandedRefs: { uri: string }[] = [];
  for (const ref of resolved.refs) {
    if (nextVisited.has(ref.uri)) {
      continue;
    }
    try {
      const refParsed = parseWorksiteUri(ref.uri);
      await resolveRecursive(refParsed, registry, nextVisited, depth + 1, ctx);
      expandedRefs.push({ uri: ref.uri });
    } catch (err) {
      // Refs are advisory — keep the unresolved URI rather than failing the whole resolve.
      if (err instanceof WorksiteNotImplementedError || err instanceof WorksiteNotFoundError) {
        expandedRefs.push({ uri: ref.uri });
      } else {
        throw err;
      }
    }
  }

  return {
    ...resolved,
    refs: expandedRefs,
  } as WorkSite;
}

function buildStubWithCycle(type: WorksiteType, id: string, uri: string): WorkSite {
  // Cycle detected — return a minimal stub. Resolver cannot progress further.
  switch (type) {
    case 'task':
      return { type, id, uri, refs: [] };
    case 'thread':
      return { type, id, uri, refs: [] };
    case 'commit':
      return { type, id, uri, refs: [] };
    case 'watch':
      return { type, id, uri, refs: [] };
    case 'workspace':
      return { type, id, uri, refs: [] };
    case 'session':
      return { type, id, uri, refs: [] };
  }
}