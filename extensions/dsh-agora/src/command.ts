import type {
  AgoraCommandResult,
  AgoraRequestContext,
  AgoraTask,
  AgoraTaskStatus,
  CreateAgoraTaskInput,
  DshAgoraServiceApi,
  TaskPriority,
} from './contracts.js'

export type AgoraCommand =
  | { readonly kind: 'help' }
  | { readonly kind: 'health' }
  | { readonly kind: 'nodes' | 'agents' }
  | { readonly kind: 'dashboard' }
  | { readonly kind: 'im' }
  | { readonly kind: 'list'; readonly state?: string; readonly projectId?: string }
  | { readonly kind: 'show'; readonly taskId: string }
  | { readonly kind: 'status'; readonly taskId: string }
  | { readonly kind: 'dispatch-status'; readonly dispatchId: string }
  | { readonly kind: 'create'; readonly input: CreateAgoraTaskInput }

export class AgoraCommandParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AgoraCommandParseError'
  }
}

const USAGE = [
  'Agora commands:',
  '/agora health',
  '/agora nodes',
  '/agora agents',
  '/agora list [--state <state>] [--project <project-id>]',
  '/agora show <task-id>',
  '/agora status <task-id>',
  '/agora dispatch-status <dispatch-id>',
  '/agora create [--type <type>] [--priority low|normal|high] [--project <id>] <title>',
  '/agora dashboard',
  '/agora im',
  '',
  'Human approval and rejection remain in the authenticated Agora surface.',
].join('\n')

export function parseAgoraCommand(rawInput: string): AgoraCommand {
  const tokens = tokenize(rawInput)
  const verb = tokens.shift()?.toLowerCase() ?? 'help'
  switch (verb) {
    case 'help':
    case '--help':
    case '-h':
      noArguments(tokens, verb)
      return { kind: 'help' }
    case 'health':
      noArguments(tokens, verb)
      return { kind: 'health' }
    case 'nodes':
    case 'agents':
      noArguments(tokens, verb)
      return { kind: verb }
    case 'dashboard':
      noArguments(tokens, verb)
      return { kind: 'dashboard' }
    case 'im':
      noArguments(tokens, verb)
      return { kind: 'im' }
    case 'show':
      return { kind: 'show', taskId: oneArgument(tokens, 'show') }
    case 'status':
      return { kind: 'status', taskId: oneArgument(tokens, 'status') }
    case 'dispatch-status':
      return { kind: 'dispatch-status', dispatchId: oneArgument(tokens, 'dispatch-status') }
    case 'list': {
      const flags = parseFlags(tokens, new Set(['state', 'project']))
      if (flags.positionals.length > 0) throw new AgoraCommandParseError('list only accepts --state and --project')
      return {
        kind: 'list',
        ...(flags.values.state === undefined ? {} : { state: flags.values.state }),
        ...(flags.values.project === undefined ? {} : { projectId: flags.values.project }),
      }
    }
    case 'create': {
      const flags = parseFlags(tokens, new Set(['type', 'priority', 'project']))
      const title = flags.positionals.join(' ').trim()
      if (title === '') throw new AgoraCommandParseError('create requires a task title')
      const priority = parsePriority(flags.values.priority)
      return {
        kind: 'create',
        input: {
          title,
          ...(flags.values.type === undefined ? {} : { type: flags.values.type }),
          ...(priority === undefined ? {} : { priority }),
          ...(flags.values.project === undefined ? {} : { projectId: flags.values.project }),
        },
      }
    }
    default:
      throw new AgoraCommandParseError(`unknown Agora command "${verb}"`)
  }
}

export async function executeAgoraCommand(
  service: DshAgoraServiceApi,
  rawInput: string,
  context: AgoraRequestContext = {},
  signal?: AbortSignal,
): Promise<AgoraCommandResult> {
  let command: AgoraCommand
  try {
    command = parseAgoraCommand(rawInput)
  } catch (error) {
    return { kind: 'error', text: `${messageOf(error)}\n\n${USAGE}` }
  }

  try {
    switch (command.kind) {
      case 'help': return { kind: 'success', text: USAGE }
      case 'dashboard': return { kind: 'success', text: `${service.serverUrl}/dashboard/` }
      case 'im': return { kind: 'success', text: formatImStatus(service.snapshot()) }
      case 'health': {
        const health = await service.health(signal)
        const label = health.service ?? health.status ?? (health.ok === false ? 'unhealthy' : 'online')
        return { kind: 'success', text: `Agora: ${String(label)}\nServer: ${service.serverUrl}` }
      }
      case 'nodes': {
        const nodes = await service.listRuntimeNodes(signal)
        return {
          kind: 'success',
          text: nodes.length === 0 ? 'No DSH runtime nodes registered.' : nodes.map(node => (
            `${node.node_id}  [${node.presence}]  agents=${node.agents.length} bots=${node.bots.filter(bot => bot.connected).length}/${node.bots.length}`
          )).join('\n'),
        }
      }
      case 'agents': {
        const targets = (await service.listRuntimeTargets(signal)).filter(target => target.runtime_provider === 'dsh')
        return {
          kind: 'success',
          text: targets.length === 0 ? 'No DSH runtime agents registered.' : targets.map(target => (
            `${target.runtime_target_ref}  ${target.primary_model ?? '-'}  [${target.presentation_mode}]`
          )).join('\n'),
        }
      }
      case 'list': return { kind: 'success', text: formatTaskList(await service.listTasks(command.state, command.projectId, signal)) }
      case 'show': return { kind: 'success', text: formatTask(await service.getTask(command.taskId, signal)) }
      case 'status': return { kind: 'success', text: formatStatus(await service.taskStatus(command.taskId, signal)) }
      case 'dispatch-status': {
        const dispatch = await service.getRuntimeDispatch(command.dispatchId, signal)
        const progress = await service.listRuntimeDispatchProgress(command.dispatchId, signal)
        const latest = dispatch.latest_progress ?? progress.at(-1) ?? null
        const envelope = dispatch.result_envelope
        return {
          kind: dispatch.status === 'failed' ? 'error' : 'success',
          text: [
            `${dispatch.id}: ${dispatch.status}`,
            `Target: ${dispatch.runtime_target_ref}`,
            `Session: ${dispatch.session_id ?? '-'}`,
            `Lease heartbeat: ${dispatch.claim_renewed_at ?? '-'}`,
            `Work progress: ${latest ? `${latest.phase} (#${latest.attempt}.${latest.sequence})${latest.percent === null || latest.percent === undefined ? '' : ` ${latest.percent}%`}` : '-'}`,
            ...(latest?.message ? [`Progress detail: ${latest.message}`] : []),
            ...(envelope ? [
              `Evidence: ${envelope.evidence.length} item(s), ${envelope.claims.length} claim(s)`,
              ...(envelope.confidence === null || envelope.confidence === undefined ? [] : [`Confidence: ${Math.round(envelope.confidence * 100)}%`]),
            ] : []),
            ...(dispatch.error ? [`Error: ${dispatch.error}`] : []),
          ].join('\n'),
        }
      }
      case 'create': {
        const task = await service.createTask({
          ...command.input,
          ...(context.actorId === undefined ? {} : { creator: context.actorId }),
          ...imTargetFrom(context),
        }, signal)
        return { kind: 'success', text: `Created ${task.id}: ${task.title}\nState: ${task.state}\nStage: ${task.current_stage ?? '-'}` }
      }
    }
  } catch (error) {
    return { kind: 'error', text: messageOf(error) }
  }
}

function formatTaskList(tasks: readonly AgoraTask[]): string {
  if (tasks.length === 0) return 'No Agora tasks matched.'
  return tasks.map(task => `${task.id}  [${task.state}]  ${task.title}${task.current_stage ? `  (${task.current_stage})` : ''}`).join('\n')
}

function formatTask(task: AgoraTask): string {
  return [
    `${task.id}: ${task.title}`,
    `State: ${task.state}`,
    `Stage: ${task.current_stage ?? '-'}`,
    `Type: ${task.type}`,
    `Priority: ${task.priority}`,
    `Project: ${task.project_id ?? '-'}`,
    ...(task.error_detail ? [`Error: ${task.error_detail}`] : []),
  ].join('\n')
}

function formatStatus(status: AgoraTaskStatus): string {
  return [
    formatTask(status.task),
    `Subtasks: ${status.subtasks.length}`,
    `Flow events: ${status.flow_log.length}`,
    `Progress entries: ${status.progress_log.length}`,
  ].join('\n')
}

function formatImStatus(snapshot: ReturnType<DshAgoraServiceApi['snapshot']>): string {
  const gateway = snapshot.im.state === 'connected'
    ? `Command gateway: connected (${snapshot.im.service}, ${snapshot.im.protocol})`
    : `Command gateway: ${snapshot.im.state} (${snapshot.im.reason})`
  const bridge = snapshot.imBridge.state === 'connected'
    ? `IM bridge: connected (${snapshot.imBridge.service}, ${snapshot.imBridge.protocol})`
    : `IM bridge: ${snapshot.imBridge.state} (${snapshot.imBridge.reason})`
  const node = snapshot.node.state === 'online'
    ? `Runtime node: online (${snapshot.node.nodeId})`
    : snapshot.node.state === 'error'
      ? `Runtime node: error (${snapshot.node.nodeId}, ${snapshot.node.error})`
      : `Runtime node: ${snapshot.node.state} (${snapshot.node.nodeId})`
  return [gateway, bridge, node, `Extensions: ${snapshot.extensions.map(item => item.id).join(', ') || '-'}`].join('\n')
}

function imTargetFrom(context: AgoraRequestContext): Pick<CreateAgoraTaskInput, 'imTarget'> | Record<string, never> {
  if (context.provider === undefined && context.conversationRef === undefined && context.threadRef === undefined) return {}
  return {
    imTarget: {
      ...(context.provider === undefined ? {} : { provider: context.provider }),
      ...(context.conversationRef === undefined ? {} : { conversation_ref: context.conversationRef }),
      ...(context.threadRef === undefined ? {} : { thread_ref: context.threadRef }),
    },
  }
}

function parsePriority(value: string | undefined): TaskPriority | undefined {
  if (value === undefined) return undefined
  if (value === 'low' || value === 'normal' || value === 'high') return value
  throw new AgoraCommandParseError('priority must be low, normal, or high')
}

function oneArgument(tokens: string[], verb: string): string {
  if (tokens.length !== 1) throw new AgoraCommandParseError(`${verb} requires exactly one task id`)
  return tokens[0]!
}

function noArguments(tokens: string[], verb: string): void {
  if (tokens.length > 0) throw new AgoraCommandParseError(`${verb} does not accept arguments`)
}

function parseFlags(tokens: string[], allowed: ReadonlySet<string>): {
  values: Record<string, string | undefined>
  positionals: string[]
} {
  const values: Record<string, string | undefined> = {}
  const positionals: string[] = []
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!
    if (!token.startsWith('--')) {
      positionals.push(token)
      continue
    }
    const name = token.slice(2)
    if (!allowed.has(name)) throw new AgoraCommandParseError(`unknown option --${name}`)
    if (values[name] !== undefined) throw new AgoraCommandParseError(`option --${name} was supplied more than once`)
    const value = tokens[index + 1]
    if (value === undefined || value.startsWith('--')) throw new AgoraCommandParseError(`option --${name} requires a value`)
    values[name] = value
    index += 1
  }
  return { values, positionals }
}

function tokenize(input: string): string[] {
  const tokens: string[] = []
  let token = ''
  let quote: 'single' | 'double' | undefined
  let escaped = false
  let started = false
  for (const char of input.trim()) {
    if (escaped) {
      token += char
      escaped = false
      started = true
      continue
    }
    if (char === '\\' && quote !== 'single') {
      escaped = true
      started = true
      continue
    }
    if (char === "'" && quote !== 'double') {
      quote = quote === 'single' ? undefined : 'single'
      started = true
      continue
    }
    if (char === '"' && quote !== 'single') {
      quote = quote === 'double' ? undefined : 'double'
      started = true
      continue
    }
    if (/\s/u.test(char) && quote === undefined) {
      if (started) tokens.push(token)
      token = ''
      started = false
      continue
    }
    token += char
    started = true
  }
  if (escaped) throw new AgoraCommandParseError('unfinished escape at end of command')
  if (quote !== undefined) throw new AgoraCommandParseError('unclosed quote in command')
  if (started) tokens.push(token)
  return tokens
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
