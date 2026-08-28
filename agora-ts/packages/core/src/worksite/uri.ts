/**
 * WorkSite URI protocol — `agora://<type>/<id>`
 *
 * Phase 1 of Shared Work Site (turn 60):
 * - Single URI scheme (`agora://`) — 跟 §1 "agora 中央 是唯一 Core 语义" 对齐
 * - Type-aware parser
 * - No platform-specific data in URI structure (no matrix room ID, no discord thread ID)
 *   — that's adapter projection, resolved separately in WorksiteResolver
 */

export type WorksiteType =
  | 'task'
  | 'thread'
  | 'commit'
  | 'watch'
  | 'workspace'
  | 'session';

export const WORK_SITE_URI_SCHEME = 'agora';

export interface WorksiteUri {
  readonly type: WorksiteType;
  readonly id: string;
  readonly raw: string;
}

const TYPE_SET: ReadonlySet<WorksiteType> = new Set<WorksiteType>([
  'task',
  'thread',
  'commit',
  'watch',
  'workspace',
  'session',
]);

export class InvalidWorksiteUriError extends Error {
  public readonly input: string;
  public readonly reason: string;

  public constructor(input: string, reason: string) {
    super(`Invalid Worksite URI "${input}": ${reason}`);
    this.name = 'InvalidWorksiteUriError';
    this.input = input;
    this.reason = reason;
  }
}

export function isValidWorksiteType(value: string): value is WorksiteType {
  return TYPE_SET.has(value as WorksiteType);
}

export function parseWorksiteUri(input: string): WorksiteUri {
  if (typeof input !== 'string' || input.length === 0) {
    throw new InvalidWorksiteUriError(String(input), 'must be a non-empty string');
  }

  const expectedPrefix = `${WORK_SITE_URI_SCHEME}://`;
  if (!input.startsWith(expectedPrefix)) {
    throw new InvalidWorksiteUriError(input, `must start with "${expectedPrefix}"`);
  }

  const remainder = input.slice(expectedPrefix.length);
  const slashIndex = remainder.indexOf('/');
  if (slashIndex <= 0 || slashIndex === remainder.length - 1) {
    throw new InvalidWorksiteUriError(input, 'must match agora://<type>/<id>');
  }

  const type = remainder.slice(0, slashIndex);
  const id = remainder.slice(slashIndex + 1);

  if (!isValidWorksiteType(type)) {
    throw new InvalidWorksiteUriError(input, `unknown type "${type}"`);
  }

  if (id.length === 0) {
    throw new InvalidWorksiteUriError(input, 'id segment must not be empty');
  }

  return Object.freeze({
    type,
    id,
    raw: input,
  });
}

export function formatWorksiteUri(type: WorksiteType, id: string): string {
  if (!isValidWorksiteType(type)) {
    throw new InvalidWorksiteUriError(`${type}/${id}`, `unknown type "${type}"`);
  }
  if (typeof id !== 'string' || id.length === 0) {
    throw new InvalidWorksiteUriError(`${type}/${id}`, 'id must be a non-empty string');
  }
  if (id.includes('/')) {
    throw new InvalidWorksiteUriError(`${type}/${id}`, 'id must not contain "/"');
  }
  return `${WORK_SITE_URI_SCHEME}://${type}/${id}`;
}

export function isValidWorksiteUri(input: string): boolean {
  try {
    parseWorksiteUri(input);
    return true;
  } catch {
    return false;
  }
}