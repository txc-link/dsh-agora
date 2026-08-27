import type {
  AgoraHealth,
  AgoraTask,
  AgoraTaskStatus,
  CreateAgoraTaskInput,
  CreateRuntimeDispatchInput,
  RuntimeDispatch,
  RuntimeNode,
  RuntimeNodeHeartbeatInput,
  RuntimeSessionBinding,
  RuntimeTarget,
} from './contracts.js'

export interface AgoraClientOptions {
  readonly serverUrl: string
  readonly apiToken?: string | undefined
  readonly timeoutMs?: number | undefined
  readonly fetch?: typeof globalThis.fetch | undefined
}

export class AgoraApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
    readonly detail: unknown,
  ) {
    super(message)
    this.name = 'AgoraApiError'
  }
}

export class AgoraClient {
  readonly serverUrl: string
  private readonly apiToken: string | undefined
  private readonly timeoutMs: number
  private readonly fetchImpl: typeof globalThis.fetch

  constructor(options: AgoraClientOptions) {
    const url = new URL(options.serverUrl)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new TypeError('Agora serverUrl must use http or https')
    }
    this.serverUrl = url.toString().replace(/\/$/u, '')
    this.apiToken = nonEmpty(options.apiToken)
    this.timeoutMs = normalizeTimeout(options.timeoutMs)
    this.fetchImpl = options.fetch ?? globalThis.fetch
  }

  health(signal?: AbortSignal): Promise<AgoraHealth> {
    return this.request('/api/health', { signal })
  }

  listTasks(state?: string, projectId?: string, signal?: AbortSignal): Promise<AgoraTask[]> {
    const query = new URLSearchParams()
    if (nonEmpty(state)) query.set('state', state!.trim())
    if (nonEmpty(projectId)) query.set('project_id', projectId!.trim())
    const suffix = query.size === 0 ? '' : `?${query.toString()}`
    return this.request(`/api/tasks${suffix}`, { signal })
  }

  getTask(taskId: string, signal?: AbortSignal): Promise<AgoraTask> {
    return this.request(`/api/tasks/${encodeURIComponent(requireValue(taskId, 'task id'))}`, { signal })
  }

  taskStatus(taskId: string, signal?: AbortSignal): Promise<AgoraTaskStatus> {
    return this.request(`/api/tasks/${encodeURIComponent(requireValue(taskId, 'task id'))}/status`, { signal })
  }

  createTask(input: CreateAgoraTaskInput, signal?: AbortSignal): Promise<AgoraTask> {
    const title = requireValue(input.title, 'task title')
    const body = {
      title,
      type: nonEmpty(input.type) ?? 'general',
      creator: nonEmpty(input.creator) ?? 'dsh',
      description: input.description ?? '',
      priority: input.priority ?? 'normal',
      locale: input.locale ?? 'zh-CN',
      ...(nonEmpty(input.projectId) ? { project_id: input.projectId!.trim() } : {}),
      ...(input.imTarget === undefined ? {} : { im_target: compactImTarget(input.imTarget) }),
    }
    return this.request('/api/tasks', { method: 'POST', body, signal })
  }

  heartbeatRuntimeNode(nodeId: string, input: RuntimeNodeHeartbeatInput, signal?: AbortSignal): Promise<RuntimeNode> {
    return this.request(`/api/runtime-nodes/${encodeURIComponent(requireValue(nodeId, 'node id'))}/heartbeat`, {
      method: 'PUT', body: input, signal,
    })
  }

  listRuntimeNodes(signal?: AbortSignal): Promise<RuntimeNode[]> {
    return this.request<{ nodes: RuntimeNode[] }>('/api/runtime-nodes', { signal }).then(value => value.nodes)
  }

  listRuntimeTargets(signal?: AbortSignal): Promise<RuntimeTarget[]> {
    return this.request<{ runtime_targets: RuntimeTarget[] }>('/api/runtime-targets', { signal }).then(value => value.runtime_targets)
  }

  createRuntimeDispatch(nodeId: string, input: CreateRuntimeDispatchInput, signal?: AbortSignal): Promise<RuntimeDispatch> {
    return this.request(`/api/runtime-nodes/${encodeURIComponent(requireValue(nodeId, 'node id'))}/dispatches`, {
      method: 'POST', body: input, signal,
    })
  }

  getRuntimeDispatch(dispatchId: string, signal?: AbortSignal): Promise<RuntimeDispatch> {
    return this.request(`/api/runtime-dispatches/${encodeURIComponent(requireValue(dispatchId, 'dispatch id'))}`, { signal })
  }

  claimRuntimeDispatch(nodeId: string, instanceId: string, leaseSeconds: number, signal?: AbortSignal): Promise<RuntimeDispatch | null> {
    return this.request<{ dispatch: RuntimeDispatch | null }>(
      `/api/runtime-nodes/${encodeURIComponent(requireValue(nodeId, 'node id'))}/dispatches/claim`,
      { method: 'POST', body: { instance_id: instanceId, lease_seconds: leaseSeconds }, signal },
    ).then(value => value.dispatch)
  }

  completeRuntimeDispatch(
    nodeId: string,
    dispatchId: string,
    input: {
      readonly instance_id: string
      readonly status: 'completed' | 'failed'
      readonly session_id?: string | null
      readonly result?: Readonly<Record<string, unknown>> | null
      readonly error?: string | null
    },
    signal?: AbortSignal,
  ): Promise<RuntimeDispatch> {
    return this.request(
      `/api/runtime-nodes/${encodeURIComponent(requireValue(nodeId, 'node id'))}/dispatches/${encodeURIComponent(requireValue(dispatchId, 'dispatch id'))}/complete`,
      { method: 'POST', body: input, signal },
    )
  }

  bindRuntimeSession(
    taskId: string,
    participantBindingId: string,
    sessionId: string,
    agentRef?: string,
    signal?: AbortSignal,
  ): Promise<RuntimeSessionBinding> {
    return this.request(
      `/api/tasks/${encodeURIComponent(requireValue(taskId, 'task id'))}/runtime-session-bindings/${encodeURIComponent(requireValue(participantBindingId, 'participant binding id'))}`,
      {
        method: 'PUT',
        body: {
          runtime_provider: 'dsh',
          runtime_session_ref: requireValue(sessionId, 'session id'),
          runtime_actor_ref: nonEmpty(agentRef) ?? null,
          continuity_ref: `dsh:${requireValue(sessionId, 'session id')}`,
          presence_state: 'active',
          binding_reason: 'runtime_node_dispatch',
        },
        signal,
      },
    )
  }

  async request<T>(
    path: string,
    options: {
      readonly method?: string | undefined
      readonly body?: unknown
      readonly signal?: AbortSignal | undefined
    } = {},
  ): Promise<T> {
    const timeoutSignal = AbortSignal.timeout(this.timeoutMs)
    const signal = options.signal === undefined
      ? timeoutSignal
      : AbortSignal.any([options.signal, timeoutSignal])
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (options.body !== undefined) headers['Content-Type'] = 'application/json'
    if (this.apiToken !== undefined) headers.Authorization = `Bearer ${this.apiToken}`

    const response = await this.fetchImpl(`${this.serverUrl}${path}`, {
      method: options.method ?? 'GET',
      headers,
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      signal,
    })
    const text = await response.text()
    const payload = parsePayload(text)
    if (!response.ok) {
      const detail = errorDetail(payload, text)
      throw new AgoraApiError(`Agora API ${response.status} at ${path}: ${detail}`, response.status, path, payload)
    }
    return payload as T
  }
}

function compactImTarget(target: NonNullable<CreateAgoraTaskInput['imTarget']>): Record<string, unknown> {
  return {
    ...(nonEmpty(target.provider) ? { provider: target.provider!.trim() } : {}),
    ...(nonEmpty(target.conversation_ref) ? { conversation_ref: target.conversation_ref!.trim() } : {}),
    ...(nonEmpty(target.thread_ref) ? { thread_ref: target.thread_ref!.trim() } : {}),
    ...(target.visibility === undefined ? {} : { visibility: target.visibility }),
    ...(target.participant_refs === undefined ? {} : { participant_refs: [...target.participant_refs] }),
  }
}

function normalizeTimeout(value: number | undefined): number {
  const timeout = value ?? 10_000
  if (!Number.isSafeInteger(timeout) || timeout < 100 || timeout > 300_000) {
    throw new TypeError('requestTimeoutMs must be an integer between 100 and 300000')
  }
  return timeout
}

function requireValue(value: string, label: string): string {
  const normalized = nonEmpty(value)
  if (normalized === undefined) throw new TypeError(`${label} is required`)
  return normalized
}

function nonEmpty(value: string | undefined): string | undefined {
  const normalized = value?.trim()
  return normalized === '' ? undefined : normalized
}

function parsePayload(text: string): unknown {
  if (text.trim() === '') return {}
  try {
    return JSON.parse(text) as unknown
  } catch (error) {
    throw new SyntaxError(`Agora returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function errorDetail(payload: unknown, fallback: string): string {
  if (typeof payload === 'object' && payload !== null) {
    const record = payload as Record<string, unknown>
    for (const key of ['detail', 'message', 'error']) {
      if (typeof record[key] === 'string' && record[key].trim() !== '') return record[key]
    }
  }
  return fallback.trim() || 'request failed'
}
