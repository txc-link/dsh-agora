/**
 * monitoring-relay — minimal HTTP service that receives Grafana Alerting
 * webhooks and forwards them as Matrix `m.room.message` events to a
 * designated ops room. Stateless except for env configuration.
 *
 * Routes:
 *   POST /webhook/grafana  — accepts Grafana webhook payloads (JSON) and
 *                             forwards the formatted alert to the Matrix
 *                             ops room. Verifies the shared secret via
 *                             `Authorization: Bearer <token>` header.
 *   GET  /healthz           — liveness probe (returns 200 + ok).
 *
 * Env:
 *   MATRIX_HOMES_URL       — homeserver base URL (required).
 *   MATRIX_ACCESS_TOKEN    — bot access token with send:room capability
 *                             (required).
 *   MATRIX_OPS_ROOM_ID     — ops room id (`!abc:matrix.example.org`,
 *                             required).
 *   MATRIX_RELAY_TOKEN     — shared secret expected in the
 *                             `Authorization: Bearer <token>` header
 *                             (required).
 *   PORT                   — listen port (default 8089).
 */
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';

interface GrafanaWebhookPayload {
  alerts?: Array<{
    status?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
    startsAt?: string;
  }>;
  message?: string;
  title?: string;
}

interface RelayConfig {
  matrixHomesUrl: string;
  matrixAccessToken: string;
  matrixOpsRoomId: string;
  matrixRelayToken: string;
  port: number;
}

function readConfig(): RelayConfig {
  const matrixHomesUrl = process.env.MATRIX_HOMES_URL;
  const matrixAccessToken = process.env.MATRIX_ACCESS_TOKEN;
  const matrixOpsRoomId = process.env.MATRIX_OPS_ROOM_ID;
  const matrixRelayToken = process.env.MATRIX_RELAY_TOKEN;
  if (!matrixHomesUrl || !matrixAccessToken || !matrixOpsRoomId || !matrixRelayToken) {
    throw new Error('monitoring-relay: missing one of MATRIX_HOMES_URL / MATRIX_ACCESS_TOKEN / MATRIX_OPS_ROOM_ID / MATRIX_RELAY_TOKEN');
  }
  return {
    matrixHomesUrl: matrixHomesUrl.replace(/\/$/u, ''),
    matrixAccessToken,
    matrixOpsRoomId,
    matrixRelayToken,
    port: Number(process.env.PORT ?? 8089),
  };
}

function verifyAuthorization(header: string | undefined, expected: string): boolean {
  if (!header) return false;
  const match = /^Bearer\s+(.+)$/u.exec(header);
  if (!match) return false;
  const provided = match[1] ?? '';
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(chunk as Buffer);
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return {};
  }
}

function formatAlert(payload: GrafanaWebhookPayload): string {
  const title = payload.title ?? 'Grafana alert';
  const lines: string[] = [`**${title}**`];
  for (const alert of payload.alerts ?? []) {
    const status = alert.status ?? 'unknown';
    const summary = alert.annotations?.summary ?? alert.annotations?.description ?? '';
    const startsAt = alert.startsAt ?? '';
    lines.push(`- \`${status}\` ${summary}${startsAt ? ` @ ${startsAt}` : ''}`);
    const labels = alert.labels ?? {};
    if (Object.keys(labels).length > 0) {
      lines.push(`  labels: ${Object.entries(labels).map(([k, v]) => `${k}=${v}`).join(', ')}`);
    }
  }
  if (payload.message) lines.push(`\n${payload.message}`);
  return lines.join('\n');
}

async function sendToMatrix(config: RelayConfig, markdown: string): Promise<void> {
  const txnId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const url = `${config.matrixHomesUrl}/_matrix/client/v3/rooms/${encodeURIComponent(config.matrixOpsRoomId)}/send/m.room.message/${txnId}`;
  const formatted = `m.text_body_html_safe_html;${markdown}`;
  const body = JSON.stringify({
    msgtype: 'm.text',
    body: markdown,
    format: 'org.matrix.custom.html',
    formatted_body: markdown.replace(/\*\*(.+?)\*\*/gu, '<strong>$1</strong>').replace(/`([^`]+)`/gu, '<code>$1</code>').replace(/\n/gu, '<br/>'),
    ['m.text_body_html_safe_html' as string]: formatted,
  });
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${config.matrixAccessToken}`,
      'content-type': 'application/json',
    },
    body,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`matrix send failed: ${response.status} ${text.slice(0, 200)}`);
  }
}

function respond(response: ServerResponse, status: number, body: string): void {
  response.statusCode = status;
  response.setHeader('content-type', 'application/json');
  response.end(JSON.stringify(JSON.parse(body)));
}

export function startServer(config: RelayConfig): ReturnType<typeof createServer> {
  const server = createServer(async (request, response) => {
    if (request.method === 'GET' && request.url === '/healthz') {
      respond(response, 200, JSON.stringify({ ok: true }));
      return;
    }
    if (request.method !== 'POST' || request.url !== '/webhook/grafana') {
      respond(response, 404, JSON.stringify({ error: 'not found' }));
      return;
    }
    if (!verifyAuthorization(request.headers.authorization, config.matrixRelayToken)) {
      respond(response, 401, JSON.stringify({ error: 'unauthorized' }));
      return;
    }
    const payload = (await readJson(request)) as GrafanaWebhookPayload;
    const message = formatAlert(payload);
    try {
      await sendToMatrix(config, message);
      respond(response, 200, JSON.stringify({ ok: true }));
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : 'unknown error';
      respond(response, 502, JSON.stringify({ ok: false, error: reason }));
    }
  });
  server.listen(config.port);
  return server;
}

const entryHash = createHmac('sha256', 'monitoring-relay').update('start').digest('hex');
void entryHash; // reserved for future secret rotation

if (process.env.MONITORING_RELAY_AUTOSTART !== 'false') {
  try {
    const config = readConfig();
    startServer(config);
    // eslint-disable-next-line no-console
    console.log(`monitoring-relay listening on :${config.port}`);
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : 'unknown error';
    // eslint-disable-next-line no-console
    console.error(`monitoring-relay failed to start: ${reason}`);
    process.exitCode = 1;
  }
}