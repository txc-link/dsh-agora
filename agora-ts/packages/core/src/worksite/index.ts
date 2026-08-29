export {
  WORK_SITE_URI_SCHEME,
  InvalidWorksiteUriError,
  formatWorksiteUri,
  isValidWorksiteType,
  isValidWorksiteUri,
  parseWorksiteUri,
  type WorksiteType,
  type WorksiteUri,
} from './uri.js';

export {
  WorksiteNotFoundError,
  WorksiteNotImplementedError,
  type CommitWorksite,
  type SessionWorksite,
  type TaskWorksite,
  type ThreadWorksite,
  type WatchWorksite,
  type WorkspaceWorksite,
  type WorkSite,
  type WorksiteMetadata,
  type WorksiteRef,
  type WorksiteResolutionContext,
  type Permission,
  type Posture,
  type ScopeAuthorization,
} from './types.js';

export {
  RESOLVE_MAX_DEPTH,
  WorksiteResolverRegistry,
  resolveScopeAuthorization,
  type WorksitePersister,
  type WorksiteResolver,
} from './resolver.js';

export {
  decideBorrow,
  scopeCovers,
  type BorrowDecision,
  type BorrowRequest,
} from './borrow.js';

export {
  decideReassign,
  type ReassignAuditEvent,
  type ReassignDecision,
  type ReassignResult,
  type StuckSignal,
} from './stuck.js';

export {
  TaskWorksiteResolver,
  type TaskWorksiteResolverOptions,
} from './task-resolver.js';