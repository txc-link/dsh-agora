/* ═══════════════════════════════════════════
   Agora REST facade — R-F.1 cross-cutting types.
   ═══════════════════════════════════════════
   These types intentionally reference `@agora-ts/contracts` DTOs (re-exported
   via `@/types/api`) instead of the dashboard `TaskConversationEntry`
   view-model. The dashboard view-model still carries typedrift against the
   upstream schema (a separate R-D governance debt) — R-F.1 does not need
   to remap those fields and the contracts DTOs are the source of truth for
   Agora REST responses anyway.

   No matrix / Discord / IM vocabulary lives here — adapters project their
   own identifiers onto these fields (§1 core constitution).
   ═══════════════════════════════════════════ */

import type {
  ApiTaskConversationEntryDto,
  ApiTaskConversationSummaryDto,
} from '@/types/api';

/**
 * A single Agora REST client error. Carries the HTTP status, upstream body
 * and (when known) the original cause so the UI can render loading /
 * 401 / 404 / 500 distinctly without parsing message strings.
 */
export class AgoraApiError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly body: string;
  readonly cause?: unknown;

  constructor(
    status: number,
    statusText: string,
    body: string,
    options?: { cause?: unknown },
  ) {
    super(`Agora API ${status} ${statusText}: ${body}`);
    this.name = 'AgoraApiError';
    this.status = status;
    this.statusText = statusText;
    this.body = body;
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }

  isUnauthorized(): boolean {
    return this.status === 401;
  }
  isNotFound(): boolean {
    return this.status === 404;
  }
  isServerError(): boolean {
    return this.status >= 500;
  }
}

export interface AgoraThreadBundle {
  taskId: string;
  summary: ApiTaskConversationSummaryDto;
  entries: ApiTaskConversationEntryDto[];
}

export interface AgoraFetchOptions {
  signal?: AbortSignal;
}

export interface AgoraClientConfig {
  baseUrl: string;
  token: string | null;
}
