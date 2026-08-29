/**
 * messaging-adapter.ts — Phase 6: IMMessagingPort backed by Matrix homeserver REST.
 *
 * §1 合规: 平台细节 (matrix HTTP API) 全部在本 adapter; Core 只消费 IMMessagingPort。
 * 零 SDK 依赖 — 纯 REST (POST /_matrix/client/v3/rooms/{roomId}/send/m.room.message/{txnId})。
 * S5 ask push / S3 delegate notify / task broadcast 均经此通道出 IM。
 *
 * targetRef → roomId 解析: roomByRef 精确映射 → defaultRoomId 兜底。
 * fetchImpl 注入 (同 mem0 adapter 模式), 测试无 I/O。
 */

import { randomUUID } from 'node:crypto';
import type { IMMessagingPort, NotificationPayload } from '@agora-ts/core';

export interface MatrixIMMessagingAdapterOptions {
  homeserverUrl: string;
  accessToken: string;
  /** agentRef → roomId 定向映射 */
  roomByRef?: Record<string, string>;
  /** 兜底房间 (bot/bridge 在场) */
  defaultRoomId: string;
  fetchImpl?: typeof fetch;
}

export interface MatrixIMMessagingAdapterDeps {
  now?: () => number;
}

export class MatrixIMMessagingAdapter implements IMMessagingPort {
  private readonly homeserverUrl: string;
  private readonly accessToken: string;
  private readonly roomByRef: Record<string, string>;
  private readonly defaultRoomId: string;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;

  constructor(options: MatrixIMMessagingAdapterOptions, deps: MatrixIMMessagingAdapterDeps = {}) {
    this.homeserverUrl = options.homeserverUrl.replace(/\/+$/, '');
    this.accessToken = options.accessToken;
    this.roomByRef = options.roomByRef ?? {};
    this.defaultRoomId = options.defaultRoomId;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = deps.now ?? (() => Date.now());
  }

  resolveRoom(targetRef: string): string {
    return this.roomByRef[targetRef] ?? this.defaultRoomId;
  }

  async sendNotification(targetRef: string, payload: NotificationPayload): Promise<void> {
    const roomId = this.resolveRoom(targetRef);
    const body = formatNotification(payload);
    const txnId = `agora-${this.now()}-${randomUUID()}`;
    const url = `${this.homeserverUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${encodeURIComponent(txnId)}?access_token=${encodeURIComponent(this.accessToken)}`;
    const response = await this.fetchImpl(url, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ msgtype: 'm.text', body }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`matrix send failed (${response.status}): ${detail.slice(0, 200)}`);
    }
  }
}

export function formatNotification(payload: NotificationPayload): string {
  const { task_id, event_type, data } = payload;
  const parts = [`Task ${task_id} — ${event_type}`];
  const extra = (data as Record<string, unknown>)?.display_output ?? (data as Record<string, unknown>)?.output;
  if (typeof extra === 'string' && extra.trim().length > 0) {
    const summary = extra.trim().split('\n').slice(-2).join(' | ');
    parts.push(summary.slice(0, 300));
  }
  return parts.join('\n');
}
