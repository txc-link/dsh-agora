/**
 * WorkSite type union — Phase 1 of Shared Work Site
 *
 * §1 compliance: WorkSite is a Core-internal abstraction. It does NOT
 * encode platform-specific data. Each type's projection to a concrete
 * surface (matrix room, git commit, sentinel watch, etc.) is the job of
 * a WorksiteResolver adapter, not of this Core type.
 */

import type { WorksiteType } from './uri.js';

export type { WorksiteType };

/** Phase 3 (U3=C): three-posture governance. */
export type Posture = 'Strict' | 'Auto' | 'Dangerous';

/** Phase 3 (U4=A): permission names inside a scope authorization. */
export type Permission = 'read' | 'write' | 'delete' | 'execute';

/**
 * Phase 3 (U3=C / U4=A): a work site's scope authorization.
 *
 * `scope` is a URI prefix (e.g. 'agora://workspace/repoA'); a borrow
 * request must stay within it. Core only expresses the scope abstraction —
 * no platform names (§1).
 */
export interface ScopeAuthorization {
  readonly scope: string;
  readonly posture: Posture;
  readonly permissions: readonly Permission[];
}

/**
 * Reference to another WorkSite. Recursive but bounded: we cap depth in
 * the resolver at a small constant (RESOLVE_MAX_DEPTH, see resolver.ts)
 * to prevent cycles.
 */
export interface WorksiteRef {
  readonly uri: string;
}

/**
 * WorkSite metadata — same shape across all types. Per-type details
 * (e.g. thread title, commit hash) are stored in `adapterFields` as
 * opaque string map, kept here ONLY because adapters need to attach
 * type-specific hints without inventing new Core types every time.
 *
 * §1 caveat: `adapterFields` is for adapter-side hints only and must
 * NOT be used for Core business decisions. Core decisions are made on
 * `type` + `id` + `refs` alone.
 *
 * Phase 3: `scopeAuthorization` binds this work site to a scope +
 * posture + permission set (U3=C / U4=A). Absent = no authorization
 * (borrow decisions fail-safe to deny/Strict).
 */
export interface WorksiteMetadata {
  readonly adapterFields?: Readonly<Record<string, string>>;
  readonly scopeAuthorization?: ScopeAuthorization;
}

/**
 * WorkSite union — 6 types. Each variant is a pure Core shape.
 *
 * Note: TaskWorksite carries `id` as `string` (the existing OC- prefixed
 * task ID). It does NOT carry `TaskRecord` to avoid pulling the full
 * Core task model into this module — TaskRecord belongs to
 * `@agora-ts/contracts`. Resolvers that need it fetch it via repositories.
 */
export interface TaskWorksite extends WorksiteMetadata {
  readonly type: 'task';
  readonly id: string;
  readonly refs: readonly WorksiteRef[];
  readonly uri: string;
}

export interface ThreadWorksite extends WorksiteMetadata {
  readonly type: 'thread';
  readonly id: string;
  readonly refs: readonly WorksiteRef[];
  readonly uri: string;
}

export interface CommitWorksite extends WorksiteMetadata {
  readonly type: 'commit';
  readonly id: string;
  readonly refs: readonly WorksiteRef[];
  readonly uri: string;
}

export interface WatchWorksite extends WorksiteMetadata {
  readonly type: 'watch';
  readonly id: string;
  readonly refs: readonly WorksiteRef[];
  readonly uri: string;
}

export interface WorkspaceWorksite extends WorksiteMetadata {
  readonly type: 'workspace';
  readonly id: string;
  readonly refs: readonly WorksiteRef[];
  readonly uri: string;
}

export interface SessionWorksite extends WorksiteMetadata {
  readonly type: 'session';
  readonly id: string;
  readonly refs: readonly WorksiteRef[];
  readonly uri: string;
}

export type WorkSite =
  | TaskWorksite
  | ThreadWorksite
  | CommitWorksite
  | WatchWorksite
  | WorkspaceWorksite
  | SessionWorksite;

/**
 * Resolver input — minimal context for adapters to look up a WorkSite.
 * Keeps adapters from depending on the whole Core service surface.
 */
export interface WorksiteResolutionContext {
  /** Caller can be a service, plugin, or test. */
  readonly callerId?: string;
  /** Wall-clock at resolution time. */
  readonly now?: Date;
}

export class WorksiteNotImplementedError extends Error {
  public readonly worksiteType: WorksiteType;
  public readonly id: string;

  public constructor(worksiteType: WorksiteType, id: string) {
    super(`Worksite resolver not implemented for type "${worksiteType}" (id=${id}). Stub — see Doc/03-ARCHITECTURE/2026-08-29-shared-work-site/`);
    this.name = 'WorksiteNotImplementedError';
    this.worksiteType = worksiteType;
    this.id = id;
  }
}

export class WorksiteNotFoundError extends Error {
  public readonly uri: string;

  public constructor(uri: string) {
    super(`WorkSite not found: ${uri}`);
    this.name = 'WorksiteNotFoundError';
    this.uri = uri;
  }
}