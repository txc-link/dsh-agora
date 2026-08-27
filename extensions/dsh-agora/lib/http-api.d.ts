import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DshAgoraServiceApi } from './contracts.js';
import type { DshWebServer } from './context-types.js';
export declare const API_PREFIX = "/dsh-agora/api";
export interface HttpApiOptions {
    readonly accessToken?: string | undefined;
}
export declare function registerHttpApi(webServer: DshWebServer, service: DshAgoraServiceApi, options: HttpApiOptions): () => void;
export declare function handleHttpRequest(request: IncomingMessage, response: ServerResponse, service: DshAgoraServiceApi, options: HttpApiOptions): Promise<void>;
//# sourceMappingURL=http-api.d.ts.map