/**
 * Smoke harness for the monitoring-relay service (2026-08-31).
 *
 * Boots the relay in-process, stubs global fetch to a fake Matrix
 * endpoint, and POSTs a Grafana-shaped payload to /webhook/grafana.
 * Confirms the bearer auth + message formatting + Matrix URL hit.
 *
 * Run: `MONITORING_RELAY_AUTOSTART=false npx tsx scripts/smoke-monitoring-relay.ts`
 * Exit: 0 on success, non-zero on any mismatch.
 */
import { request as httpRequest } from 'node:http';
import { startServer } from '../apps/monitoring-relay/src/server.js';

const RELAY_TOKEN = 'smoke-relay-token';
const MATRIX_TOKEN = 'smoke-matrix-token';

interface MatrixStubCall {
  url: string;
  authorization: string;
  body: string;
}

async function main(): Promise<void> {
  const calls: MatrixStubCall[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL, init?: { headers?: Record<string, string>; body?: string }) => {
    const url = String(input);
    if (url.includes('/_matrix/client/v3/rooms/')) {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      calls.push({
        url,
        authorization: headers.authorization ?? '',
        body: init?.body ?? '',
      });
      return new Response('{}', { status: 200 });
    }
    return originalFetch ? originalFetch(input as never, init as never) : new Response('not-found', { status: 404 });
  }) as typeof fetch;

  const server = startServer({
    matrixHomesUrl: 'http://matrix.test',
    matrixAccessToken: MATRIX_TOKEN,
    matrixOpsRoomId: '!ops:matrix.test',
    matrixRelayToken: RELAY_TOKEN,
    port: 0,
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('no port');

  const payload = {
    title: 'CPU > 90%',
    alerts: [
      {
        status: 'firing',
        labels: { severity: 'critical', host: 'node-a' },
        annotations: { summary: 'node-a CPU sustained 92% for 5m' },
        startsAt: '2026-08-31T12:00:00Z',
      },
    ],
  };

  const status = await new Promise<number>((resolve, reject) => {
    const req = httpRequest(
      {
        host: '127.0.0.1',
        port: address.port,
        path: '/webhook/grafana',
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(JSON.stringify(payload)),
          authorization: `Bearer ${RELAY_TOKEN}`,
        },
      },
      (response) => {
        response.on('data', () => undefined);
        response.on('end', () => resolve(response.statusCode ?? 0));
      },
    );
    req.on('error', reject);
    req.write(JSON.stringify(payload));
    req.end();
  });

  globalThis.fetch = originalFetch;
  await new Promise<void>((resolve) => server.close(() => resolve()));

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ok: true, status, calls: calls.length }, null, 2));
  if (status !== 200) throw new Error(`expected 200, got ${status}`);
  if (calls.length !== 1) throw new Error(`expected 1 Matrix call, got ${calls.length}`);
  if (calls[0]?.authorization !== `Bearer ${MATRIX_TOKEN}`) {
    throw new Error(`expected Matrix bearer, got ${calls[0]?.authorization}`);
  }
  if (!calls[0]?.url.includes('/_matrix/client/v3/rooms/')) {
    throw new Error(`Matrix URL not built correctly: ${calls[0]?.url}`);
  }
  if (!calls[0]?.body.includes('CPU')) {
    throw new Error(`Matrix body missing CPU marker: ${calls[0]?.body}`);
  }
}

main().catch((cause: unknown) => {
  // eslint-disable-next-line no-console
  console.error('smoke-monitoring-relay failed:', cause instanceof Error ? cause.message : cause);
  process.exit(1);
});