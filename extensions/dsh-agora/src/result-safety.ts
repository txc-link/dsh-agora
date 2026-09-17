const SECRET_KEY = /(?:password|passwd|passphrase|secret|token|api[-_ ]?key|access[-_ ]?token|refresh[-_ ]?token|auth(?:entication)?[-_. ]?token|密码|口令|密钥|秘钥)/iu
const PEM_BLOCK = /-----BEGIN [^-\r\n]*PRIVATE KEY-----[\s\S]*?-----END [^-\r\n]*PRIVATE KEY-----/gu
const KEY_VALUE = /((?:password|passwd|passphrase|secret|token|api[-_ ]?key|access[-_ ]?token|refresh[-_ ]?token|auth(?:entication)?[-_. ]?token|密码|口令|密钥|秘钥)\s*[:：=]\s*)("[^"]*"|'[^']*'|`[^`]*`|[^\s|,，;；]+)/giu
const TABLE_VALUE = /(\|\s*(?:password|passwd|passphrase|secret|token|api[-_ ]?key|access[-_ ]?token|refresh[-_ ]?token|auth(?:entication)?[-_. ]?token|密码|口令|密钥|秘钥)\s*\|\s*)([^|\r\n]+)(?=\s*\|)/giu
const URL_CREDENTIAL = /((?:https?|ssh):\/\/[^/\s:@]+:)[^@\s]+(@)/giu

function isSecretKey(key: string): boolean {
  if (/^(?:input|output|total)_tokens$/u.test(key) || key === 'tool_calls') return false
  return SECRET_KEY.test(key)
}

/** Redact secret material before a runtime result enters durable state or IM. */
export function redactSensitiveText(value: string): string {
  return value
    .replace(PEM_BLOCK, '[REDACTED PRIVATE KEY]')
    .replace(URL_CREDENTIAL, '$1[REDACTED]$2')
    .replace(KEY_VALUE, '$1[REDACTED]')
    .replace(TABLE_VALUE, '$1[REDACTED]')
}

/** Recursively redact strings in result envelopes and adapter metadata. */
export function redactSensitiveValue<T>(value: T): T {
  if (typeof value === 'string') return redactSensitiveText(value) as T
  if (Array.isArray(value)) return value.map(item => redactSensitiveValue(item)) as T
  if (value !== null && typeof value === 'object') {
    const output: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      output[key] = isSecretKey(key) ? '[REDACTED]' : redactSensitiveValue(item)
    }
    return output as T
  }
  return value
}
