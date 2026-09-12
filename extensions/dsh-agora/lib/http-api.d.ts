import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DshAgoraServiceApi } from './contracts.js';
import type { DshWebServer } from './context-types.js';
export declare const API_PREFIX = "/dsh-agora/api";
/**
 * Conversation → DSH session bindings.
 *
 * A Matrix room sends a room-scoped `idempotencyKey` (constant for the whole
 * room) plus a per-message `eventId`. Agora dedupes dispatches on the
 * idempotency key, so forwarding the room-scoped value verbatim makes every
 * message in that room replay the room's FIRST dispatch forever. We therefore
 * derive a per-message dispatch key and keep conversation continuity by
 * resuming the room's DSH session instead of by replaying a dispatch.
 *
 * The binding outlives the process so a facade restart does not silently drop
 * every room's conversation history.
 */
export declare const conversationSessionsPath: string;
export declare function loadConversationSessions(file: string): Map<string, string>;
export declare function saveConversationSessions(file: string, sessions: Map<string, string>): void;
export interface HttpApiOptions {
    readonly accessToken?: string | undefined;
}
export declare function registerHttpApi(webServer: DshWebServer, service: DshAgoraServiceApi, options: HttpApiOptions): () => void;
export declare function handleHttpRequest(request: IncomingMessage, response: ServerResponse, service: DshAgoraServiceApi, options: HttpApiOptions): Promise<void>;
//# sourceMappingURL=http-api.d.ts.map