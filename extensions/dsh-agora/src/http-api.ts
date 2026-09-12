import { timingSafeEqual } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { AgoraRequestContext, DshAgoraServiceApi } from './contracts.js'
import type { DshWebServer } from './context-types.js'

export const API_PREFIX = '/dsh-agora/api'
const MAX_BODY_BYTES = 1_048_576

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
export const conversationSessionsPath = process.env.DSH_AGORA_CHAT_SESSIONS_PATH
  ?? join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'state', 'dsh-agora-chat-sessions.json')

export function loadConversationSessions(file: string): Map<string, string> {
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as unknown
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return new Map()
    return new Map(
      Object.entries(parsed as Record<string, unknown>)
        .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0),
    )
  } catch {
    // Missing or corrupt state degrades to "start a fresh session"; a chat
    // reply must never fail because continuity bookkeeping is unreadable.
    return new Map()
  }
}

export function saveConversationSessions(file: string, sessions: Map<string, string>): void {
  try {
    mkdirSync(dirname(file), { recursive: true })
    const temporary = `${file}.${process.pid}.tmp`
    writeFileSync(temporary, JSON.stringify(Object.fromEntries(sessions)), { mode: 0o600 })
    renameSync(temporary, file)
  } catch {
    // Best-effort: failing to persist only costs session continuity.
  }
}

const conversationSessions = loadConversationSessions(conversationSessionsPath)

export interface HttpApiOptions {
  readonly accessToken?: string | undefined
}

export function registerHttpApi(webServer: DshWebServer, service: DshAgoraServiceApi, options: HttpApiOptions): () => void {
  return webServer.register({
    kind: 'prefix',
    path: API_PREFIX,
    handler: (request, response) => handleHttpRequest(request, response, service, options),
  })
}

export async function handleHttpRequest(
  request: IncomingMessage,
  response: ServerResponse,
  service: DshAgoraServiceApi,
  options: HttpApiOptions,
): Promise<void> {
  try {
    if (!authorized(request, options.accessToken)) {
      writeJson(response, 403, { ok: false, error: { code: 'forbidden', message: 'forbidden' } })
      return
    }
    if (request.method !== 'POST') {
      writeJson(response, 405, { ok: false, error: { code: 'method-not-allowed', message: 'POST required' } })
      return
    }
    const pathname = new URL(request.url ?? '/', 'http://dsh.internal').pathname
    const method = pathname.startsWith(`${API_PREFIX}/`) ? pathname.slice(API_PREFIX.length + 1) : ''
    if (method === '' || method.includes('/')) throw new HttpApiError(404, 'not-found', 'unknown dsh-agora API method')
    const payload = asRecord(await readJsonBody(request))
    const signal = AbortSignal.timeout(300_000)
    let value: unknown
    switch (method) {
      case 'snapshot': value = service.snapshot(); break
      case 'health': value = await service.health(signal); break
      case 'nodes': value = await service.listRuntimeNodes(signal); break
      case 'agents': value = await service.listRuntimeTargets(signal); break
      case 'tasks': value = await service.listTasks(optionalString(payload.state), optionalString(payload.projectId), signal); break
      case 'task': value = await service.getTask(requiredString(payload.taskId, 'taskId'), signal); break
      case 'status': value = await service.taskStatus(requiredString(payload.taskId, 'taskId'), signal); break
      case 'dispatch-status': value = await service.getRuntimeDispatch(requiredString(payload.dispatchId, 'dispatchId'), signal); break
      case 'dispatch-progress': value = await service.listRuntimeDispatchProgress(requiredString(payload.dispatchId, 'dispatchId'), signal); break
      case 'coordination-runs': value = await service.listCoordinationRuns(
        optionalCoordinationStatus(payload.status),
        signal,
      ); break
      case 'coordination-run': value = await service.getCoordinationRun(requiredString(payload.runId, 'runId'), signal); break
      case 'scorecards': value = await service.listAgentScorecards(optionalString(payload.taskType), signal); break
      case 'coordination-create': {
        const mode = requiredCoordinationMode(payload.mode)
        const taskId = optionalString(payload.taskId)
        const taskType = optionalString(payload.taskType)
        const verifierTargetRef = optionalString(payload.verifierTargetRef)
        value = await service.createCoordinationRun({
          prompt: requiredString(payload.prompt, 'prompt'),
          mode,
          candidates: requiredStringArray(payload.runtimeTargetRefs, 'runtimeTargetRefs').map(runtime_target_ref => ({ runtime_target_ref })),
          idempotency_key: requiredString(payload.idempotencyKey, 'idempotencyKey'),
          ...(taskId === undefined ? {} : { task_id: taskId }),
          ...(taskType === undefined ? {} : { task_type: taskType }),
          ...(verifierTargetRef === undefined ? {} : { verifier_target_ref: verifierTargetRef }),
          ...(payload.budget === undefined ? {} : { budget: coordinationBudget(payload.budget) }),
        }, signal)
        break
      }
      case 'dispatch': {
        const taskId = optionalString(payload.taskId)
        const participantBindingId = optionalString(payload.participantBindingId)
        const idempotencyKey = requiredString(payload.idempotencyKey, 'idempotencyKey')
        const eventId = optionalString(payload.eventId)
        const conversationSessionId = eventId === undefined ? undefined : conversationSessions.get(idempotencyKey)
        const sessionId = optionalString(payload.sessionId) ?? conversationSessionId
        const workspaceAlias = optionalString(payload.workspaceAlias)
        const agentPreset = optionalString(payload.agentPreset)
        const sourceSessionId = optionalString(payload.sourceSessionId)
        const presentationMode = optionalString(payload.presentationMode)
        const waitTimeoutMs = optionalInteger(payload.waitTimeoutMs, 'waitTimeoutMs', 0, 600_000)
        if (presentationMode !== undefined && !['source_bot', 'destination_bot', 'silent'].includes(presentationMode)) {
          throw new HttpApiError(400, 'bad-request', 'presentationMode is invalid')
        }
        const dispatchValue = await service.dispatchAgent({
          runtime_target_ref: requiredString(payload.runtimeTargetRef, 'runtimeTargetRef'),
          prompt: requiredString(payload.prompt, 'prompt'),
          idempotency_key: eventId === undefined ? idempotencyKey : `${idempotencyKey}#${eventId}`,
          ...(taskId === undefined ? {} : { task_id: taskId }),
          ...(participantBindingId === undefined ? {} : { participant_binding_id: participantBindingId }),
          ...(sessionId === undefined ? {} : { session_id: sessionId }),
          ...(workspaceAlias === undefined ? {} : { workspace_alias: workspaceAlias }),
          ...(agentPreset === undefined ? {} : { agent_preset: agentPreset }),
          ...(sourceSessionId === undefined ? {} : { source_session_id: sourceSessionId }),
          ...(waitTimeoutMs === undefined ? {} : { wait_timeout_ms: waitTimeoutMs }),
          ...(presentationMode === undefined ? {} : {
            presentation_mode: presentationMode as 'source_bot' | 'destination_bot' | 'silent',
          }),
        })
        if (eventId !== undefined && dispatchValue.session_id) {
          conversationSessions.set(idempotencyKey, dispatchValue.session_id)
          saveConversationSessions(conversationSessionsPath, conversationSessions)
        }
        value = dispatchValue
        break
      }
      case 'attach-session': value = await service.bindRuntimeSession(
        requiredString(payload.taskId, 'taskId'),
        requiredString(payload.participantBindingId, 'participantBindingId'),
        requiredString(payload.sessionId, 'sessionId'),
        optionalString(payload.runtimeTargetRef),
        signal,
      ); break
      case 'create': {
        const type = optionalString(payload.type)
        const creator = optionalString(payload.creator)
        const description = optionalString(payload.description)
        const projectId = optionalString(payload.projectId)
        value = await service.createTask({
          title: requiredString(payload.title, 'title'),
          ...(type === undefined ? {} : { type }),
          ...(creator === undefined ? {} : { creator }),
          ...(description === undefined ? {} : { description }),
          ...(projectId === undefined ? {} : { projectId }),
        }, signal)
        break
      }
      case 'command': value = await service.executeCommand(
        optionalString(payload.input) ?? '',
        requestContext(payload.context),
        signal,
      ); break
      case 'command-event': value = await service.executeCommandEvent(payload as unknown as import('./command-adapter.js').DshAgoraCommandEventV1, signal); break
      default: throw new HttpApiError(404, 'not-found', `unknown dsh-agora API method "${method}"`)
    }
    writeJson(response, 200, { ok: true, value })
  } catch (error) {
    if (error instanceof HttpApiError) {
      writeJson(response, error.status, { ok: false, error: { code: error.code, message: error.message } })
      return
    }
    writeJson(response, 502, { ok: false, error: { code: 'upstream-error', message: error instanceof Error ? error.message : String(error) } })
  }
}

class HttpApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message)
  }
}

function authorized(request: IncomingMessage, configuredToken: string | undefined): boolean {
  if (isLoopback(request.socket.remoteAddress)) return true
  const token = configuredToken?.trim()
  if (!token) return false
  const authorization = request.headers.authorization
  if (!authorization?.startsWith('Bearer ')) return false
  const supplied = authorization.slice(7)
  const expectedBytes = Buffer.from(token)
  const suppliedBytes = Buffer.from(supplied)
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes)
}

function isLoopback(address: string | undefined): boolean {
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let length = 0
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    length += bytes.length
    if (length > MAX_BODY_BYTES) throw new HttpApiError(413, 'body-too-large', 'request body exceeds 1 MiB')
    chunks.push(bytes)
  }
  const text = Buffer.concat(chunks).toString('utf8').trim()
  if (text === '') return {}
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new HttpApiError(400, 'bad-json', 'request body must be valid JSON')
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new HttpApiError(400, 'bad-request', 'request body must be an object')
  return value as Record<string, unknown>
}

function optionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') throw new HttpApiError(400, 'bad-request', 'expected a string field')
  const normalized = value.trim()
  return normalized === '' ? undefined : normalized
}

function requiredString(value: unknown, field: string): string {
  const normalized = optionalString(value)
  if (normalized === undefined) throw new HttpApiError(400, 'bad-request', `${field} is required`)
  return normalized
}

function optionalInteger(value: unknown, field: string, minimum: number, maximum: number): number | undefined {
  if (value === undefined || value === null) return undefined
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new HttpApiError(400, 'bad-request', `${field} must be an integer between ${minimum} and ${maximum}`)
  }
  return value as number
}

function requiredStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.length === 0) throw new HttpApiError(400, 'bad-request', `${field} must be a non-empty string array`)
  return value.map(item => requiredString(item, field))
}

function requiredCoordinationMode(value: unknown): 'single' | 'fanout' | 'review' | 'debate' | 'council' {
  const mode = requiredString(value, 'mode')
  if (mode === 'single' || mode === 'fanout' || mode === 'review' || mode === 'debate' || mode === 'council') return mode
  throw new HttpApiError(400, 'bad-request', 'mode must be single, fanout, review, debate, or council')
}

function optionalCoordinationStatus(value: unknown): import('./contracts.js').CoordinationRunStatus | undefined {
  const status = optionalString(value)
  if (status === undefined) return undefined
  if (status === 'running' || status === 'verifying' || status === 'completed' || status === 'partial'
    || status === 'failed' || status === 'cancelled' || status === 'budget_exhausted') return status
  throw new HttpApiError(400, 'bad-request', 'coordination status is invalid')
}

function coordinationBudget(value: unknown): Partial<import('./contracts.js').CoordinationBudget> {
  const record = asRecord(value)
  const fields = [
    ['max_agents', 1, 32],
    ['max_dispatches', 1, 64],
    ['max_wall_clock_seconds', 15, 86_400],
    ['max_tokens', 1, Number.MAX_SAFE_INTEGER],
    ['max_tool_calls', 1, Number.MAX_SAFE_INTEGER],
  ] as const
  const budget: Record<string, number> = {}
  for (const [field, minimum, maximum] of fields) {
    const item = optionalInteger(record[field], field, minimum, maximum)
    if (item !== undefined) budget[field] = item
  }
  if (record.max_cost_usd !== undefined) {
    if (typeof record.max_cost_usd !== 'number' || record.max_cost_usd <= 0) throw new HttpApiError(400, 'bad-request', 'max_cost_usd must be positive')
    budget.max_cost_usd = record.max_cost_usd
  }
  return budget
}

function requestContext(value: unknown): AgoraRequestContext {
  if (value === undefined) return {}
  const record = asRecord(value)
  const actorId = optionalString(record.actorId)
  const provider = optionalString(record.provider)
  const conversationRef = optionalString(record.conversationRef)
  const threadRef = optionalString(record.threadRef)
  return {
    ...(actorId === undefined ? {} : { actorId }),
    ...(provider === undefined ? {} : { provider }),
    ...(conversationRef === undefined ? {} : { conversationRef }),
    ...(threadRef === undefined ? {} : { threadRef }),
  }
}

function writeJson(response: ServerResponse, status: number, body: unknown): void {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  response.end(JSON.stringify(body))
}
