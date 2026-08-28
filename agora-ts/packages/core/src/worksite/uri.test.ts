import { describe, expect, it } from 'vitest';
import {
  InvalidWorksiteUriError,
  WORK_SITE_URI_SCHEME,
  formatWorksiteUri,
  isValidWorksiteType,
  isValidWorksiteUri,
  parseWorksiteUri,
} from './uri.js';

describe('worksite/uri', () => {
  describe('isValidWorksiteType', () => {
    it.each(['task', 'thread', 'commit', 'watch', 'workspace', 'session'])(
      'accepts valid type "%s"',
      (type) => {
        expect(isValidWorksiteType(type)).toBe(true);
      },
    );

    it.each(['', 'Task', 'TASK', 'matrix', 'discord', 'foo', '123'])(
      'rejects invalid type "%s"',
      (type) => {
        expect(isValidWorksiteType(type)).toBe(false);
      },
    );
  });

  describe('parseWorksiteUri', () => {
    it('parses agora://task/OC-123', () => {
      const result = parseWorksiteUri('agora://task/OC-123');
      expect(result).toEqual({
        type: 'task',
        id: 'OC-123',
        raw: 'agora://task/OC-123',
      });
      expect(Object.isFrozen(result)).toBe(true);
    });

    it('parses all 6 worksite types', () => {
      for (const type of ['task', 'thread', 'commit', 'watch', 'workspace', 'session'] as const) {
        const result = parseWorksiteUri(`agora://${type}/x`);
        expect(result.type).toBe(type);
        expect(result.id).toBe('x');
      }
    });

    it('preserves matrix room ID in id segment (no platform-specific parsing)', () => {
      const result = parseWorksiteUri('agora://thread/!EqHMFbmSZcoiIXEEKe:agent-hub.local');
      expect(result.type).toBe('thread');
      expect(result.id).toBe('!EqHMFbmSZcoiIXEEKe:agent-hub.local');
    });

    it('rejects empty string', () => {
      expect(() => parseWorksiteUri('')).toThrow(InvalidWorksiteUriError);
    });

    it('rejects non-string input', () => {
      expect(() => parseWorksiteUri(undefined as unknown as string)).toThrow(InvalidWorksiteUriError);
      expect(() => parseWorksiteUri(null as unknown as string)).toThrow(InvalidWorksiteUriError);
    });

    it('rejects wrong scheme', () => {
      expect(() => parseWorksiteUri('matrix://task/x')).toThrow(InvalidWorksiteUriError);
      expect(() => parseWorksiteUri('http://task/x')).toThrow(InvalidWorksiteUriError);
      expect(() => parseWorksiteUri('agoras://task/x')).toThrow(InvalidWorksiteUriError);
      expect(() => parseWorksiteUri('task/x')).toThrow(InvalidWorksiteUriError);
    });

    it('rejects malformed URI (no slash, no id, double slash)', () => {
      expect(() => parseWorksiteUri('agora://task')).toThrow(InvalidWorksiteUriError);
      expect(() => parseWorksiteUri('agora://task/')).toThrow(InvalidWorksiteUriError);
      expect(() => parseWorksiteUri('agora:///x')).toThrow(InvalidWorksiteUriError);
      expect(() => parseWorksiteUri('agora:////x')).toThrow(InvalidWorksiteUriError);
    });

    it('rejects unknown type', () => {
      expect(() => parseWorksiteUri('agora://foo/x')).toThrow(InvalidWorksiteUriError);
      expect(() => parseWorksiteUri('agora://Task/x')).toThrow(InvalidWorksiteUriError);
    });

    it('error carries input and reason', () => {
      try {
        parseWorksiteUri('agora://bogus/x');
      } catch (err) {
        expect(err).toBeInstanceOf(InvalidWorksiteUriError);
        const e = err as InvalidWorksiteUriError;
        expect(e.input).toBe('agora://bogus/x');
        expect(e.reason).toContain('bogus');
        expect(e.name).toBe('InvalidWorksiteUriError');
      }
    });
  });

  describe('formatWorksiteUri', () => {
    it('formats valid type and id', () => {
      expect(formatWorksiteUri('task', 'OC-123')).toBe('agora://task/OC-123');
      expect(formatWorksiteUri('thread', '!room:server')).toBe('agora://thread/!room:server');
    });

    it('roundtrips with parseWorksiteUri', () => {
      for (const type of ['task', 'thread', 'commit', 'watch', 'workspace', 'session'] as const) {
        const id = `${type}-abc`;
        const formatted = formatWorksiteUri(type, id);
        const parsed = parseWorksiteUri(formatted);
        expect(parsed.type).toBe(type);
        expect(parsed.id).toBe(id);
      }
    });

    it('rejects invalid type', () => {
      expect(() => formatWorksiteUri('bogus' as never, 'x')).toThrow(InvalidWorksiteUriError);
    });

    it('rejects empty id', () => {
      expect(() => formatWorksiteUri('task', '')).toThrow(InvalidWorksiteUriError);
    });

    it('rejects id containing slash (would break parsing)', () => {
      expect(() => formatWorksiteUri('task', 'a/b')).toThrow(InvalidWorksiteUriError);
    });
  });

  describe('isValidWorksiteUri', () => {
    it('returns true for valid URIs', () => {
      expect(isValidWorksiteUri('agora://task/OC-123')).toBe(true);
      expect(isValidWorksiteUri('agora://session/sess-1')).toBe(true);
    });

    it('returns false for invalid URIs (no throw)', () => {
      expect(isValidWorksiteUri('')).toBe(false);
      expect(isValidWorksiteUri('matrix://task/x')).toBe(false);
      expect(isValidWorksiteUri('agora://bogus/x')).toBe(false);
      expect(isValidWorksiteUri('agora://task')).toBe(false);
    });
  });

  describe('§1 boundary compliance (Core abstraction purity)', () => {
    it('exposes single scheme (agora only)', () => {
      expect(WORK_SITE_URI_SCHEME).toBe('agora');
    });

    it('id segment is opaque (no platform-specific parsing)', () => {
      const matrixId = '!EqHMFbmSZcoiIXEEKe:agent-hub.local';
      const discordId = '1234567890123456789';
      const ocId = 'OC-1234567890';
      expect(parseWorksiteUri(`agora://thread/${matrixId}`).id).toBe(matrixId);
      expect(parseWorksiteUri(`agora://thread/${discordId}`).id).toBe(discordId);
      expect(parseWorksiteUri(`agora://task/${ocId}`).id).toBe(ocId);
    });
  });
});