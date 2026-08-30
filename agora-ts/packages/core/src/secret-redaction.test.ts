import { describe, expect, it } from 'vitest';
import { redactSecrets, redactSecretText } from './secret-redaction.js';

describe('secret redaction', () => {
  it('redacts known token shapes and labelled secrets in free text', () => {
    const input = [
      'Mem0 m0sk_exampleCredential123456789',
      'Authorization: Bearer abcdefghijklmnopqrstuvwxyz',
      'api key: exampleCredential123456789',
      'https://user:password123456@example.test/path',
    ].join('\n');

    const output = redactSecretText(input);

    expect(output).not.toContain('exampleCredential123456789');
    expect(output).not.toContain('abcdefghijklmnopqrstuvwxyz');
    expect(output).not.toContain('password123456');
    expect(output).toContain('[REDACTED]');
  });

  it('redacts values under sensitive keys recursively without changing ordinary metadata', () => {
    expect(redactSecrets({
      answer: 'safe',
      metadata: {
        access_token: 'opaque-value',
        nested: [{ password: 'another-value' }],
        revision: 'b41ad07f85f13057c',
      },
    })).toEqual({
      answer: 'safe',
      metadata: {
        access_token: '[REDACTED]',
        nested: [{ password: '[REDACTED]' }],
        revision: 'b41ad07f85f13057c',
      },
    });
  });
});
