const REDACTED = '[REDACTED]';

const SENSITIVE_KEY = /(?:^|[_-])(?:api[_-]?key|api[_-]?token|access[_-]?token|auth(?:orization)?|bearer|credential|password|secret|token)(?:$|[_-])/iu;

const SECRET_PATTERNS: ReadonlyArray<[RegExp, string]> = [
  [/\bm0sk_[A-Za-z0-9_-]{12,}\b/gu, REDACTED],
  [/\bagora_node_[A-Za-z0-9_-]{12,}\b/gu, REDACTED],
  [/\bsyt_[A-Za-z0-9._-]{12,}\b/gu, REDACTED],
  [/\bsk-[A-Za-z0-9_-]{12,}\b/gu, REDACTED],
  [/\b(?:pk|sk|rk)_(?:live|test)_[A-Za-z0-9_-]{12,}\b/gu, REDACTED],
  [/\bBearer\s+[A-Za-z0-9._~+/=-]{12,}\b/giu, `Bearer ${REDACTED}`],
  [/(https?:\/\/[^\s/:@]+:)[^\s/@]+(@)/giu, `$1${REDACTED}$2`],
  [/(\b(?:api[ _-]?(?:key|token)|access[ _-]?token|password|secret)\b\s*(?::|=|\bis\b)\s*)[`'"]?[A-Za-z0-9_./+~=-]{12,}[`'"]?/giu, `$1${REDACTED}`],
];

export function redactSecretText(value: string): string {
  return SECRET_PATTERNS.reduce(
    (redacted, [pattern, replacement]) => redacted.replace(pattern, replacement),
    value,
  );
}

export function redactSecrets<T>(value: T, key?: string): T {
  if (typeof value === 'string') {
    return (key && SENSITIVE_KEY.test(key) ? REDACTED : redactSecretText(value)) as T;
  }
  if (Array.isArray(value)) {
    return value.map(item => redactSecrets(item)) as T;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [entryKey, redactSecrets(entryValue, entryKey)]),
    ) as T;
  }
  return value;
}
