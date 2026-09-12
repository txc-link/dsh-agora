/**
 * CalDAV path confinement.
 *
 * The CalDAV client feeds caller/collection-derived paths into
 * `new URL(path, baseUrl)`, which follows RFC 3986 reference resolution. Three
 * host/collection-isolation hazards follow from that and are refused here, at
 * the single entry point, rather than being patched per call site:
 *
 *  1. **Host switch** — `//evil.example/x`, `///evil.example/x` and
 *     `/\evil.example/x` are network-path references: they resolve to a
 *     *different origin*, which would ship the Basic `authorization` header to
 *     an attacker-controlled host. Any `//` run, any backslash, or a leading
 *     `/\` is rejected before URI resolution.
 *  2. **Collection traversal** — a path such as `/tester/work/../life/x.ics`
 *     escapes the declared collection. Traversal is caught in the decoded form
 *     so percent-encoded spellings (`%2e%2e`, `%2E%2E`, `%2e.`, `.%2e`, …) are
 *     covered by the same rule as their literal equivalents.
 *  3. **Injection** — control characters (CR/LF/NUL/DEL) can smuggle header or
 *     path syntax and are rejected outright.
 */

const DECODE_INEQUALITY = /%(?![0-9A-Fa-f]{2})/u;
const SPECIAL_CHARACTERS = new Set(['%', '<', '>', '?', '#']);

/** True when any code point is a C0 control (includes CR/LF/NUL) or DEL. */
export function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/** Decode `%XX` once. Absolute (non-relative) decode so nothing throws on a `%`. */
function decodePercent(value: string): string {
  return value.replace(/%([0-9A-Fa-f]{2})/gu, (_match, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16)),
  );
}

/**
 * Validate one absolute CalDAV path segment-chain.
 *
 * Returns the trimmed path on success; throws `TypeError` on any host-switch,
 * traversal, encoding or control-character hazard. Error text is stable so
 * callers get a single, uniform rejection surface.
 */
export function assertCalDavPath(path: string): string {
  if (typeof path !== 'string') throw new TypeError('CalDAV path must be a string');
  const value = path.trim();
  if (!value.startsWith('/')) throw new TypeError('CalDAV path must be absolute (start with "/")');
  if (value.includes('\\')) throw new TypeError('CalDAV path must not contain backslashes');
  if (value.includes('//')) throw new TypeError('CalDAV path must not contain protocol-relative "//" separators');
  if (hasControlCharacter(value)) throw new TypeError('CalDAV path must not contain control characters');
  const decoded = decodePercent(value);
  if (DECODE_INEQUALITY.test(decoded)) throw new TypeError('CalDAV path must not contain malformed percent-encoding');
  if (decoded.includes('\\')) throw new TypeError('CalDAV path must not contain backslashes');
  if (decoded.includes('//')) throw new TypeError('CalDAV path must not contain protocol-relative "//" separators');
  if (hasReservedCharacter(decoded)) throw new TypeError('CalDAV path must not contain reserved characters');
  if (decoded.split('/').some((segment) => segment === '.' || segment === '..')) {
    throw new TypeError('CalDAV path must not traverse collections');
  }
  return value;
}

/**
 * Validate a configured CalDAV collection root.
 *
 * A collection is the confinement boundary the adapter writes under, so it must
 * itself be handed the same guard as a resource path; in addition it may not be
 * protocol-relative and it must name at least one non-root segment.
 */
export function assertSafeCollectionPath(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${label} collection must be a non-empty absolute path`);
  }
  const normalized = value.replace(/\/+$/u, '');
  if (!normalized.startsWith('/')) {
    throw new TypeError(`${label} collection must be an absolute path: ${normalized}`);
  }
  const guarded = assertCalDavPath(normalized);
  if (guarded.includes('//')) {
    throw new TypeError(`${label} collection must not be protocol-relative: ${normalized}`);
  }
  if (guarded === '' || guarded === '/') {
    throw new TypeError(`${label} collection must name at least one non-root segment`);
  }
  return normalized;
}

/**
 * Assert `path` stays inside `collection`.
 *
 * Both arguments are the *unencoded* path names the client is about to send, so
 * containment is decided in the same namespace RFC 3986 will resolve: if the
 * literal path is inside, its resolution is inside (traversal was already
 * refused by {@link assertCalDavPath}).
 */
export function assertPathContained(collection: string, path: string): void {
  if (path === collection || collection === '') return;
  if (path.startsWith(`${collection}/`)) return;
  throw new TypeError(`CalDAV path must stay within its declared collection: ${path} is not under ${collection}`);
}

/** True when the decoded path carries a character that must never be sent. */
function hasReservedCharacter(value: string): boolean {
  for (const character of value) {
    if (SPECIAL_CHARACTERS.has(character)) return true;
    const code = character.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}
