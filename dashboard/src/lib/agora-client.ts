/* ═══════════════════════════════════════════
   Agora REST client facade (R-F.1)
   ═══════════════════════════════════════════
   A thin, explicit facade over `lib/api.ts` that:
   - carries the explicit `Agora*` brand surfaced in the task brief,
   - collapses `AgoraApiError` so R-F consumers can branch on
     401 / 404 / 500 without parsing message strings,
   - delegates the actual schema-validated transport to the existing
     `api.ts` `request()` helper (no parallel HTTP stack — that would
     diverge token resolution, zod validation, and error mapping).
   ═══════════════════════════════════════════ */

import {
  getTask,
  getTaskConversation,
  getTaskConversationSummary,
  markTaskConversationRead,
} from '@/lib/api';
import type {
  AgoraFetchOptions,
  AgoraThreadBundle,
} from '@/types/agora';
import { AgoraApiError } from '@/types/agora';
import type {
  ApiTaskConversationEntryDto,
  ApiTaskConversationSummaryDto,
} from '@/types/api';

function readEnvBaseUrl(): string {
  const raw = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_AGORA_URL;
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw.trim().replace(/\/$/, '');
  }
  return 'http://127.0.0.1:18008';
}

function readEnvToken(): string | null {
  const raw = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_AGORA_TOKEN;
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw.trim();
  }
  return null;
}

function readLocalToken(): string | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  try {
    const raw = localStorage.getItem('agora-settings');
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as { state?: { apiToken?: unknown; apiBase?: unknown } };
    const token = parsed?.state?.apiToken;
    return typeof token === 'string' && token.trim().length > 0 ? token.trim() : null;
  } catch {
    return null;
  }
}

export function getAgoraClientConfig() {
  return {
    baseUrl: readEnvBaseUrl(),
    token: readEnvToken() ?? readLocalToken(),
  } as const;
}

/**
 * Internal transport — `api.ts` already throws a structured ApiError;
 * we surface it here as the public `AgoraApiError` brand so consumers
 * in R-F.1+ only need to import one error type.
 */
async function unwrap<T>(promise: Promise<T>, options?: AgoraFetchOptions): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof AgoraApiError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    if (options?.signal?.aborted) {
      throw new AgoraApiError(0, 'aborted', message, { cause: error });
    }
    throw new AgoraApiError(0, 'network', message, { cause: error });
  }
}

export interface AgoraThreadFetchResult {
  taskId: string;
  entries: ApiTaskConversationEntryDto[];
  summary: ApiTaskConversationSummaryDto;
}

export class AgoraClient {
  readonly baseUrl: string;
  readonly token: string | null;

  constructor(config: { baseUrl?: string; token?: string | null } = {}) {
    const fallback = getAgoraClientConfig();
    this.baseUrl = (config.baseUrl ?? fallback.baseUrl).replace(/\/$/, '');
    this.token = config.token !== undefined ? config.token : fallback.token;
  }

  /** Resolve a single task + its full conversation thread + read cursor. */
  async loadThread(taskId: string, options?: AgoraFetchOptions): Promise<AgoraThreadFetchResult> {
    const [task, conversation, summary] = await Promise.all([
      unwrap(getTask(taskId), options),
      unwrap(getTaskConversation(taskId), options),
      unwrap(getTaskConversationSummary(taskId), options),
    ]);
    return {
      taskId: task.id,
      entries: conversation.entries,
      summary,
    };
  }

  /** Read-only conversation list (no summary / no task detail). */
  async getTaskConversation(taskId: string, options?: AgoraFetchOptions): Promise<AgoraThreadBundle> {
    const [conversation, summary] = await Promise.all([
      unwrap(getTaskConversation(taskId), options),
      unwrap(getTaskConversationSummary(taskId), options),
    ]);
    return {
      taskId,
      entries: conversation.entries,
      summary,
    };
  }

  async markConversationRead(taskId: string, options?: AgoraFetchOptions): Promise<ApiTaskConversationSummaryDto> {
    return unwrap(markTaskConversationRead(taskId, {}), options);
  }
}

export const agoraClient = new AgoraClient();
