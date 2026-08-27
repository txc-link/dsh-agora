import { randomUUID } from 'node:crypto'
import type { DshAgoraServiceApi, TaskPriority } from './contracts.js'

export interface DshToolRunContext {
  readonly signal: AbortSignal
  readonly agent?: { readonly id?: string }
}

export interface DshToolDefinition {
  readonly name: string
  readonly description: string
  readonly parameters: Record<string, unknown>
  readonly output: {
    readonly schema: Record<string, unknown>
    render(args: unknown, value: unknown): Array<{ readonly type: 'text'; readonly text: string }>
  }
  execute(args: unknown, exec: DshToolRunContext): Promise<unknown>
  presentCall?(args: unknown): { readonly card: 'generic'; readonly title: string; readonly kind?: 'read' | 'execute' }
}

export interface DshToolRegistry {
  register(definition: DshToolDefinition): () => void
}

type AgoraToolArgs =
  | { readonly action: 'health' }
  | { readonly action: 'nodes' | 'agents' }
  | { readonly action: 'list'; readonly state?: string; readonly project_id?: string }
  | { readonly action: 'show' | 'status'; readonly task_id: string }
  | { readonly action: 'dispatch_status'; readonly dispatch_id: string }
  | {
    readonly action: 'attach_session'
    readonly task_id: string
    readonly participant_binding_id: string
    readonly session_id: string
    readonly runtime_target_ref?: string
  }
  | {
    readonly action: 'dispatch'
    readonly runtime_target_ref: string
    readonly prompt: string
    readonly task_id?: string
    readonly participant_binding_id?: string
    readonly session_id?: string
    readonly workspace_alias?: string
    readonly agent_preset?: string
    readonly idempotency_key?: string
    readonly wait_seconds?: number
    readonly presentation_mode?: 'source_bot' | 'destination_bot' | 'silent'
  }
  | {
    readonly action: 'create'
    readonly title: string
    readonly task_type?: string
    readonly description?: string
    readonly priority?: TaskPriority
    readonly project_id?: string
  }

export function createAgoraTool(service: DshAgoraServiceApi): DshToolDefinition {
  return {
    name: 'agora_task',
    description: [
      'Create and inspect governed tasks in the connected Agora server.',
      'Discover DSH agents, dispatch work to another Harness node, attach existing Sessions, and inspect governed tasks.',
      'This tool cannot approve or reject a human governance gate.',
    ].join(' '),
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        action: { type: 'string', enum: ['health', 'nodes', 'agents', 'list', 'show', 'status', 'create', 'dispatch', 'dispatch_status', 'attach_session'], description: 'Operation to perform.' },
        task_id: { type: 'string', description: 'Agora task id for show or status.' },
        state: { type: 'string', description: 'Optional state filter for list.' },
        project_id: { type: 'string', description: 'Optional project filter or task project id.' },
        title: { type: 'string', description: 'Task title for create.' },
        task_type: { type: 'string', description: 'Agora workflow/task type for create; defaults to general.' },
        description: { type: 'string', description: 'Optional task description.' },
        priority: { type: 'string', enum: ['low', 'normal', 'high'], description: 'Optional task priority.' },
        runtime_target_ref: { type: 'string', description: 'Target in dsh:<node-id>:<agent-ref> form.' },
        participant_binding_id: { type: 'string', description: 'Agora participant binding for a durable task-to-Session link.' },
        session_id: { type: 'string', description: 'Existing DSH Session to resume or attach.' },
        dispatch_id: { type: 'string', description: 'Runtime dispatch id.' },
        prompt: { type: 'string', description: 'Work instruction for the destination Agent.' },
        workspace_alias: { type: 'string', description: 'Optional destination workspace alias.' },
        agent_preset: { type: 'string', description: 'Optional destination Agent Preset.' },
        idempotency_key: { type: 'string', description: 'Stable retry key for dispatch.' },
        wait_seconds: { type: 'integer', minimum: 0, maximum: 600, description: 'Optionally wait for the remote Agent result.' },
        presentation_mode: { type: 'string', enum: ['source_bot', 'destination_bot', 'silent'], description: 'How a bridged IM result is presented.' },
      },
      required: ['action'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: true,
        properties: {
          ok: { type: 'boolean' },
          action: { type: 'string' },
          data: {},
        },
        required: ['ok', 'action', 'data'],
      },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(rawArgs, exec) {
      const args = parseToolArgs(rawArgs)
      switch (args.action) {
        case 'health': return { ok: true, action: args.action, data: await service.health(exec.signal) }
        case 'nodes': return { ok: true, action: args.action, data: await service.listRuntimeNodes(exec.signal) }
        case 'agents': return {
          ok: true, action: args.action,
          data: (await service.listRuntimeTargets(exec.signal)).filter(target => target.runtime_provider === 'dsh'),
        }
        case 'list': return { ok: true, action: args.action, data: await service.listTasks(args.state, args.project_id, exec.signal) }
        case 'show': return { ok: true, action: args.action, data: await service.getTask(args.task_id, exec.signal) }
        case 'status': return { ok: true, action: args.action, data: await service.taskStatus(args.task_id, exec.signal) }
        case 'dispatch_status': return { ok: true, action: args.action, data: await service.getRuntimeDispatch(args.dispatch_id, exec.signal) }
        case 'attach_session': return {
          ok: true,
          action: args.action,
          data: await service.bindRuntimeSession(
            args.task_id,
            args.participant_binding_id,
            args.session_id,
            args.runtime_target_ref,
            exec.signal,
          ),
        }
        case 'dispatch': return {
          ok: true,
          action: args.action,
          data: await service.dispatchAgent({
            runtime_target_ref: args.runtime_target_ref,
            prompt: args.prompt,
            idempotency_key: args.idempotency_key ?? `dsh-tool-${randomUUID()}`,
            wait_timeout_ms: (args.wait_seconds ?? 0) * 1_000,
            presentation_mode: args.presentation_mode ?? 'destination_bot',
            ...(exec.agent?.id === undefined ? {} : { source_session_id: exec.agent.id }),
            ...(args.task_id === undefined ? {} : { task_id: args.task_id }),
            ...(args.participant_binding_id === undefined ? {} : { participant_binding_id: args.participant_binding_id }),
            ...(args.session_id === undefined ? {} : { session_id: args.session_id }),
            ...(args.workspace_alias === undefined ? {} : { workspace_alias: args.workspace_alias }),
            ...(args.agent_preset === undefined ? {} : { agent_preset: args.agent_preset }),
          }, exec.signal),
        }
        case 'create': return {
          ok: true,
          action: args.action,
          data: await service.createTask({
            title: args.title,
            ...(exec.agent?.id === undefined ? {} : { creator: exec.agent.id }),
            ...(args.task_type === undefined ? {} : { type: args.task_type }),
            ...(args.description === undefined ? {} : { description: args.description }),
            ...(args.priority === undefined ? {} : { priority: args.priority }),
            ...(args.project_id === undefined ? {} : { projectId: args.project_id }),
          }, exec.signal),
        }
      }
    },
    presentCall: rawArgs => {
      const action = isRecord(rawArgs) && typeof rawArgs.action === 'string' ? rawArgs.action : 'operation'
      return { card: 'generic', title: `Agora ${action}`, kind: action === 'create' ? 'execute' : 'read' }
    },
  }
}

export function parseToolArgs(value: unknown): AgoraToolArgs {
  if (!isRecord(value)) throw new TypeError('agora_task arguments must be an object')
  const action = requiredString(value.action, 'action')
  assertAllowedKeys(value, [
    'action', 'task_id', 'state', 'project_id', 'title', 'task_type', 'description', 'priority',
    'runtime_target_ref', 'participant_binding_id', 'session_id', 'dispatch_id', 'prompt',
    'workspace_alias', 'agent_preset', 'idempotency_key', 'wait_seconds', 'presentation_mode',
  ])
  switch (action) {
    case 'health':
      return { action }
    case 'nodes':
    case 'agents':
      return { action }
    case 'list':
      return { action, ...optionalFields(value, ['state', 'project_id']) }
    case 'show':
    case 'status':
      return { action, task_id: requiredString(value.task_id, 'task_id') }
    case 'dispatch_status':
      return { action, dispatch_id: requiredString(value.dispatch_id, 'dispatch_id') }
    case 'attach_session':
      return {
        action,
        task_id: requiredString(value.task_id, 'task_id'),
        participant_binding_id: requiredString(value.participant_binding_id, 'participant_binding_id'),
        session_id: requiredString(value.session_id, 'session_id'),
        ...optionalFields(value, ['runtime_target_ref']),
      }
    case 'dispatch': {
      const presentationMode = optionalString(value.presentation_mode, 'presentation_mode')
      if (presentationMode !== undefined && !['source_bot', 'destination_bot', 'silent'].includes(presentationMode)) {
        throw new TypeError('presentation_mode must be source_bot, destination_bot, or silent')
      }
      const waitSeconds = optionalInteger(value.wait_seconds, 'wait_seconds', 0, 600)
      return {
        action,
        runtime_target_ref: requiredString(value.runtime_target_ref, 'runtime_target_ref'),
        prompt: requiredString(value.prompt, 'prompt'),
        ...optionalFields(value, [
          'task_id', 'participant_binding_id', 'session_id', 'workspace_alias', 'agent_preset', 'idempotency_key',
        ]),
        ...(waitSeconds === undefined ? {} : { wait_seconds: waitSeconds }),
        ...(presentationMode === undefined ? {} : { presentation_mode: presentationMode as 'source_bot' | 'destination_bot' | 'silent' }),
      }
    }
    case 'create': {
      const priority = optionalString(value.priority, 'priority')
      if (priority !== undefined && priority !== 'low' && priority !== 'normal' && priority !== 'high') {
        throw new TypeError('priority must be low, normal, or high')
      }
      return {
        action,
        title: requiredString(value.title, 'title'),
        ...optionalFields(value, ['task_type', 'description', 'project_id']),
        ...(priority === undefined ? {} : { priority }),
      }
    }
    default:
      throw new TypeError(`unsupported agora_task action "${action}"`)
  }
}

function optionalFields<T extends readonly string[]>(record: Record<string, unknown>, keys: T): Partial<Record<T[number], string>> {
  const output: Partial<Record<T[number], string>> = {}
  for (const key of keys) {
    const value = optionalString(record[key], key)
    if (value !== undefined) output[key as T[number]] = value
  }
  return output
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') throw new TypeError(`${field} must be a string`)
  const normalized = value.trim()
  return normalized === '' ? undefined : normalized
}

function requiredString(value: unknown, field: string): string {
  const normalized = optionalString(value, field)
  if (normalized === undefined) throw new TypeError(`${field} is required`)
  return normalized
}

function optionalInteger(value: unknown, field: string, minimum: number, maximum: number): number | undefined {
  if (value === undefined || value === null) return undefined
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new TypeError(`${field} must be an integer between ${minimum} and ${maximum}`)
  }
  return value as number
}

function assertAllowedKeys(record: Record<string, unknown>, allowed: readonly string[]): void {
  const allowedSet = new Set(allowed)
  const unknown = Object.keys(record).find(key => !allowedSet.has(key))
  if (unknown !== undefined) throw new TypeError(`unknown agora_task argument "${unknown}"`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
