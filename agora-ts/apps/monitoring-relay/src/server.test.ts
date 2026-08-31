import { describe, expect, it, vi } from 'vitest';
import { request as httpRequest, type RequestOptions } from 'node:http';
import { startServer } from './server.js';

const RELAY_TOKEN = 'relay-secret-token';

interface TestResponse {
  status: number;
  body: string;
}

function postJson(port: number, path: string, body: string, headers: Record<string, string> = {}): Promise<TestResponse> {
  return new Promise((resolve, reject) => {
    const options: RequestOptions = {
      host: '127.0.0.1',
      port,
      path,
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body), ...headers },
    };
    const req = httpRequest(options, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function getJson(port: number, path: string): Promise<TestResponse> {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: '127.0.0.1', port, path, method: 'GET' }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.end();
  });
}

function portOf(server: ReturnType<typeof startServer>): number {
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('no port');
  return address.port;
}

describe('monitoring-relay HTTP server', () => {
  it('returns 200 from /healthz', async () => {
    const server = startServer({
      matrixHomesUrl: 'http://matrix.test',
      matrixAccessToken: 'mx-token',
      matrixOpsRoomId: '!ops:matrix.test',
      matrixRelayToken: RELAY_TOKEN,
      port: 0,
    });
    try {
      const response = await getJson(portOf(server), '/healthz');
      expect(response.status).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ ok: true });
    } finally {
      server.close();
    }
  });

  it('rejects webhook posts without a valid bearer token', async () => {
    const server = startServer({
      matrixHomesUrl: 'http://matrix.test',
      matrixAccessToken: 'mx-token',
      matrixOpsRoomId: '!ops:matrix.test',
      matrixRelayToken: RELAY_TOKEN,
      port: 0,
    });
    try {
      const response = await postJson(portOf(server), '/webhook/grafana', JSON.stringify({ title: 'boom' }));
      expect(response.status).toBe(401);
    } finally {
      server.close();
    }
  });

  it('forwards a formatted alert to Matrix when authorised', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const server = startServer({
      matrixHomesUrl: 'http://matrix.test',
      matrixAccessToken: 'mx-token',
      matrixOpsRoomId: '!ops:matrix.test',
      matrixRelayToken: RELAY_TOKEN,
      port: 0,
    });
    try {
      const response = await postJson(
        portOf(server),
        '/webhook/grafana',
        JSON.stringify({
          title: 'CPU > 90%',
          alerts: [
            { status: 'firing', labels: { severity: 'critical', host: 'node-a' }, annotations: { summary: 'node-a CPU sustained 92% for 5m' }, startsAt: '2026-08-31T12:00:00Z' },
          ],
        }),
        { authorization: `Bearer ${RELAY_TOKEN}` },
      );
      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [calledUrl, calledInit] = fetchMock.mock.calls[0] ?? [];
      expect(String(calledUrl)).toContain('/_matrix/client/v3/rooms/!ops%3Amatrix.test/send/m.room.message/');
      const headers = (calledInit as { headers: Record<string, string> }).headers;
      expect(headers.authorization).toBe('Bearer mx-token');
    } finally {
      vi.unstubAllGlobals();
      server.close();
    }
  });

  it('returns 502 when Matrix send fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('forbidden', { status: 403 })));
    const server = startServer({
      matrixHomesUrl: 'http://matrix.test',
      matrixAccessToken: 'mx-token',
      matrixOpsRoomId: '!ops:matrix.test',
      matrixRelayToken: RELAY_TOKEN,
      port: 0,
    });
    try {
      const response = await postJson(
        portOf(server),
        '/webhook/grafana',
        JSON.stringify({ title: 'x' }),
        { authorization: `Bearer ${RELAY_TOKEN}` },
      );
      expect(response.status).toBe(502);
    } finally {
      vi.unstubAllGlobals();
      server.close();
    }
  });
});