import assert from 'node:assert/strict'
import test from 'node:test'
import { redactSensitiveText, redactSensitiveValue } from '../lib/result-safety.js'

test('result safety redacts credentials in prose, tables, URLs, and PEM blocks', () => {
  const input = [
    '| 密码 | unittec@secret |',
    'password: "s3cret"',
    'ssh://root:secret@example.test:22',
    '-----BEGIN OPENSSH PRIVATE KEY-----\nprivate\n-----END OPENSSH PRIVATE KEY-----',
  ].join('\n')
  const output = redactSensitiveText(input)
  assert.doesNotMatch(output, /unittec@secret|s3cret|root:secret|BEGIN OPENSSH PRIVATE KEY|private\n/)
  assert.match(output, /\[REDACTED\]/)
})

test('result safety redacts secret-looking object keys recursively', () => {
  const output = redactSensitiveValue({ password: 'x', nested: [{ token: 'y', host: 'safe' }], input_tokens: null, output_tokens: 3 })
  assert.deepEqual(output, { password: '[REDACTED]', nested: [{ token: '[REDACTED]', host: 'safe' }], input_tokens: null, output_tokens: 3 })
})
