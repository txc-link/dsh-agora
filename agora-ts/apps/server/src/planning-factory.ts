import { TickTickTaskAdapter } from '@agora-ts/adapters-tasks';
import type { ExternalTaskProviderPort } from '@agora-ts/core';

export interface TickTickEnvConfig {
  accessToken: string;
  baseUrl?: string;
}

export function readTickTickEnv(env: NodeJS.ProcessEnv = process.env): TickTickEnvConfig | null {
  const token = env.TICKTICK_ACCESS_TOKEN?.trim();
  if (!token) return null;
  return {
    accessToken: token,
    ...(env.TICKTICK_API_BASE_URL?.trim() ? { baseUrl: env.TICKTICK_API_BASE_URL.trim() } : {}),
  };
}

export function createExternalTaskProviderFromEnv(config: TickTickEnvConfig): ExternalTaskProviderPort {
  return new TickTickTaskAdapter({ accessToken: config.accessToken, ...(config.baseUrl ? { baseUrl: config.baseUrl } : {}) });
}
