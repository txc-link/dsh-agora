import type { CreateExternalTaskInput, ExternalPlanningTask, ExternalTaskProviderPort } from '@agora-ts/core';

type AccessTokenSource = string | (() => string | Promise<string>);

export interface TickTickTaskAdapterOptions {
  readonly accessToken: AccessTokenSource;
  readonly baseUrl?: string;
  readonly fetchImpl?: typeof globalThis.fetch;
  readonly timeoutMs?: number;
}

interface TickTickTaskResponse {
  id?: string;
  projectId?: string;
  title?: string;
  content?: string;
  startDate?: string;
  dueDate?: string;
  timeZone?: string;
  status?: number;
}

export class TickTickTaskAdapter implements ExternalTaskProviderPort {
  readonly providerId = 'ticktick';
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly baseUrl: URL;

  constructor(private readonly options: TickTickTaskAdapterOptions) {
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.baseUrl = new URL(ensureTrailingSlash(options.baseUrl ?? 'https://api.ticktick.com/open/v1/'));
  }

  async createTask(input: CreateExternalTaskInput): Promise<ExternalPlanningTask> {
    const projectRef = required(input.projectRef, 'projectRef');
    const title = required(input.title, 'title');
    const result = await this.requestJson<TickTickTaskResponse>('task', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        projectId: projectRef,
        title,
        ...(input.content ? { content: input.content } : {}),
        ...(input.start ? { startDate: input.start } : {}),
        ...(input.due ? { dueDate: input.due } : {}),
        ...(input.timeZone ? { timeZone: input.timeZone } : {}),
      }),
    });
    const id = required(result.id ?? '', 'TickTick task id');
    return {
      id,
      projectRef: result.projectId?.trim() || projectRef,
      title: result.title?.trim() || title,
      content: result.content ?? input.content ?? null,
      start: result.startDate ?? input.start ?? null,
      due: result.dueDate ?? input.due ?? null,
      timeZone: result.timeZone ?? input.timeZone ?? null,
      status: result.status === 2 ? 'completed' : 'open',
    };
  }

  async completeTask(input: { projectRef: string; taskRef: string }): Promise<void> {
    const project = encodeURIComponent(required(input.projectRef, 'projectRef'));
    const task = encodeURIComponent(required(input.taskRef, 'taskRef'));
    await this.request(`project/${project}/task/${task}/complete`, { method: 'POST' });
  }

  private async requestJson<T>(path: string, init: RequestInit): Promise<T> {
    const response = await this.request(path, init);
    return await response.json() as T;
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    const token = await resolveToken(this.options.accessToken);
    const response = await this.fetchImpl(new URL(path, this.baseUrl), {
      ...init,
      headers: { accept: 'application/json', authorization: `Bearer ${token}`, ...init.headers },
      signal: AbortSignal.timeout(this.options.timeoutMs ?? 10_000),
    });
    if (!response.ok) throw new Error(`TickTick returned HTTP ${response.status} for ${init.method ?? 'GET'} /${path}`);
    return response;
  }
}

async function resolveToken(source: AccessTokenSource): Promise<string> {
  return required(typeof source === 'function' ? await source() : source, 'TickTick access token');
}

function ensureTrailingSlash(value: string): string { return value.endsWith('/') ? value : `${value}/`; }

function required(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new TypeError(`${label} is required`);
  return normalized;
}
