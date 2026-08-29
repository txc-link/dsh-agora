import { describe, expect, it } from 'vitest';
import { MatrixIMMessagingAdapter, formatNotification } from './messaging-adapter.js';

function makeFetchCapture() {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify({ event_id: '$evt-1' }), { status: 200 });
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

const payload = { event_type: 'task_delegated', task_id: 'OC-1', data: { team_id: 't1' } };

describe('MatrixIMMessagingAdapter', () => {
  it('sendNotification: PUT m.room.message 到默认房间, token 在 query, body 可读', async () => {
    const { calls, fetchImpl } = makeFetchCapture();
    const adapter = new MatrixIMMessagingAdapter({
      homeserverUrl: 'http://localhost:8008/',
      accessToken: 'syt_x',
      defaultRoomId: '!room:hs',
      fetchImpl,
    }, { now: () => 1_700_000_000_000 });
    await adapter.sendNotification('agent:w1', payload);
    expect(calls).toHaveLength(1);
    const { url, init } = calls[0];
    expect(url).toContain('http://localhost:8008/_matrix/client/v3/rooms/');
    expect(url).toContain(encodeURIComponent('!room:hs'));
    expect(url).toContain('/send/m.room.message/');
    expect(url).toContain('access_token=syt_x');
    expect((init as { method?: string }).method).toBe('PUT');
    const body = JSON.parse(String((init as { body?: string }).body));
    expect(body.msgtype).toBe('m.text');
    expect(body.body).toContain('OC-1');
    expect(body.body).toContain('task_delegated');
  });

  it('targetRef 为 roomId (! 开头) 时直接发该房间', async () => {
    const { calls, fetchImpl } = makeFetchCapture();
    const adapter = new MatrixIMMessagingAdapter({
      homeserverUrl: 'http://hs',
      accessToken: 't',
      defaultRoomId: '!default:hs',
      fetchImpl,
    });
    await adapter.sendNotification('!conv-room:hs', payload);
    expect(calls[0].url).toContain(encodeURIComponent('!conv-room:hs'));
    expect(adapter.resolveRoom('!x:y')).toBe('!x:y');
  });

  it('roomByRef 精确映射优先于 default', async () => {
    const { calls, fetchImpl } = makeFetchCapture();
    const adapter = new MatrixIMMessagingAdapter({
      homeserverUrl: 'http://hs',
      accessToken: 't',
      defaultRoomId: '!default:hs',
      roomByRef: { 'agent:dl': '!dev-room:hs' },
      fetchImpl,
    });
    await adapter.sendNotification('agent:dl', payload);
    expect(calls[0].url).toContain(encodeURIComponent('!dev-room:hs'));
  });

  it('formatNotification: 带输出摘要截断', () => {
    const text = formatNotification({
      event_type: 'craftsman_completed',
      task_id: 'OC-2',
      data: { display_output: 'line1\nline2\nline3' },
    });
    expect(text).toContain('OC-2');
    expect(text).toContain('line2 | line3');
  });
});
