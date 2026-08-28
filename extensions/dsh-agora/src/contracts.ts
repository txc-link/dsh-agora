export type TaskPriority = 'low' | 'normal' | 'high'

export interface AgoraTask {
  readonly id: string
  readonly version?: number
  readonly title: string
  readonly description?: string | null
  readonly type: string
  readonly priority: TaskPriority
  readonly creator: string
  readonly locale?: string
  readonly project_id?: string | null
  readonly state: string
  readonly current_stage: string | null
  readonly error_detail?: string | null
  readonly created_at?: string
  readonly updated_at?: string
  readonly [key: string]: unknown
}

export interface AgoraTaskStatus {
  readonly task: AgoraTask
  readonly flow_log: readonly Record<string, unknown>[]
  readonly progress_log: readonly Record<string, unknown>[]
  readonly subtasks: readonly Record<string, unknown>[]
  readonly [key: string]: unknown
}

export interface AgoraHealth {
  readonly ok?: boolean
  readonly status?: string
  readonly service?: string
  readonly [key: string]: unknown
}

export const DSH_AGORA_NODE_PROTOCOL = 'dsh-agora.node/v1' as const

export interface RuntimeNodeAgent {
  readonly agent_ref: string
  readonly display_name?: string | null
  readonly preset?: string | null
  readonly model?: string | null
  readonly workspace_alias?: string | null
  readonly roles: readonly string[]
  readonly capabilities: readonly string[]
  readonly metadata?: Readonly<Record<string, unknown>> | null
}

export interface RuntimeNodeBot {
  readonly provider: string
  readonly bot_ref: string
  readonly platform_id?: string | null
  readonly display_name?: string | null
  readonly agent_ref?: string | null
  readonly connected: boolean
  readonly capabilities: readonly string[]
}

export interface RuntimeNodeHeartbeatInput {
  readonly protocol: typeof DSH_AGORA_NODE_PROTOCOL
  readonly instance_id: string
  readonly plugin_version: string
  readonly host_framework: 'deepseek-harness'
  readonly runtime_provider: 'dsh'
  readonly agents: readonly RuntimeNodeAgent[]
  readonly bots: readonly RuntimeNodeBot[]
  readonly capacity: { readonly max_concurrent: number; readonly active: number }
  readonly lease_seconds: number
  readonly metadata?: Readonly<Record<string, unknown>> | null
}

export interface RuntimeNode extends RuntimeNodeHeartbeatInput {
  readonly node_id: string
  readonly presence: 'online' | 'stale'
  readonly registered_at: string
  readonly last_seen_at: string
  readonly expires_at: string
}

export interface RuntimeTarget {
  readonly runtime_target_ref: string
  readonly runtime_provider: string | null
  readonly runtime_flavor: string | null
  readonly host_framework: string | null
  readonly primary_model: string | null
  readonly channel_providers: readonly string[]
  readonly enabled: boolean
  readonly display_name: string | null
  readonly presentation_mode: 'headless' | 'im_presented'
  readonly presentation_provider: string | null
  readonly presentation_identity_ref: string | null
  readonly [key: string]: unknown
}

export interface CreateRuntimeDispatchInput {
  readonly task_id?: string | null
  readonly participant_binding_id?: string | null
  readonly runtime_target_ref: string
  readonly session_id?: string | null
  readonly workspace_alias?: string | null
  readonly agent_preset?: string | null
  readonly prompt: string
  readonly idempotency_key: string
  readonly metadata?: Readonly<Record<string, unknown>> | null
}

export interface DispatchAgentInput extends CreateRuntimeDispatchInput {
  readonly source_session_id?: string
  readonly wait_timeout_ms?: number
  readonly presentation_mode?: 'source_bot' | 'destination_bot' | 'silent'
}

export interface RuntimeDispatch extends CreateRuntimeDispatchInput {
  readonly id: string
  readonly node_id: string
  readonly status: 'pending' | 'claimed' | 'completed' | 'failed' | 'cancelled'
  readonly claimed_by: string | null
  readonly claim_token: string | null
  readonly claim_expires_at: string | null
  readonly attempt: number
  readonly claimed_at: string | null
  readonly claim_renewed_at: string | null
  readonly latest_progress?: RuntimeDispatchProgress | null
  readonly progress_updated_at?: string | null
  readonly result: Readonly<Record<string, unknown>> | null
  readonly result_envelope?: RuntimeResultEnvelope | null
  readonly error: string | null
  readonly created_at: string
  readonly updated_at: string
  readonly completed_at: string | null
}

export interface RuntimeDispatchProgressInput {
  readonly phase: string
  readonly message?: string | null
  readonly percent?: number | null
  readonly details?: Readonly<Record<string, unknown>> | null
}

export interface RecordRuntimeDispatchProgressInput extends RuntimeDispatchProgressInput {
  readonly instance_id: string
  readonly claim_token: string
  readonly sequence: number
}

export interface RuntimeDispatchProgress extends RuntimeDispatchProgressInput {
  readonly id: string
  readonly dispatch_id: string
  readonly node_id: string
  readonly instance_id: string
  readonly attempt: number
  readonly sequence: number
  readonly created_at: string
}

export interface RuntimeResultEvidence {
  readonly id: string
  readonly kind: 'file' | 'url' | 'commit' | 'measurement' | 'log' | 'command' | 'other'
  readonly label?: string | null
  readonly uri?: string | null
  readonly content_hash?: string | null
  readonly revision?: string | null
  readonly line_start?: number | null
  readonly line_end?: number | null
  readonly metadata?: Readonly<Record<string, unknown>> | null
}

export interface RuntimeResultClaim {
  readonly id: string
  readonly statement: string
  readonly evidence_ids: readonly string[]
  readonly confidence?: number | null
}

export interface RuntimeResultEnvelope {
  readonly schema: 'agora.runtime-result/v1'
  readonly answer: string
  readonly claims: readonly RuntimeResultClaim[]
  readonly evidence: readonly RuntimeResultEvidence[]
  readonly confidence?: number | null
  readonly environment?: {
    readonly runtime_provider: string
    readonly agent_ref?: string | null
    readonly model?: string | null
    readonly workspace_alias?: string | null
    readonly revision?: string | null
    readonly metadata?: Readonly<Record<string, unknown>> | null
  } | null
}

export interface RuntimeDelivery {
  readonly id: string
  readonly dispatch_id: string
  readonly node_id: string
  readonly payload: Readonly<Record<string, unknown>>
  readonly status: 'pending' | 'claimed' | 'delivered' | 'failed'
  readonly attempt: number
  readonly claimed_by: string | null
  readonly claim_token: string | null
  readonly claim_expires_at: string | null
  readonly next_attempt_at: string
  readonly receipt: Readonly<Record<string, unknown>> | null
  readonly error: string | null
  readonly created_at: string
  readonly updated_at: string
  readonly delivered_at: string | null
}

export interface RuntimeSessionBinding {
  readonly id: string
  readonly participant_binding_id: string
  readonly runtime_provider: 'dsh'
  readonly runtime_session_ref: string
  readonly runtime_actor_ref: string | null
  readonly continuity_ref: string | null
  readonly presence_state: 'active' | 'idle' | 'closed'
  readonly last_seen_at: string
  readonly [key: string]: unknown
}

export interface AgoraImTarget {
  readonly provider?: string
  readonly conversation_ref?: string
  readonly thread_ref?: string
  readonly visibility?: 'public' | 'private'
  readonly participant_refs?: readonly string[]
}

export interface CreateAgoraTaskInput {
  readonly title: string
  readonly type?: string
  readonly creator?: string
  readonly description?: string
  readonly priority?: TaskPriority
  readonly locale?: 'zh-CN' | 'en-US'
  readonly projectId?: string
  readonly imTarget?: AgoraImTarget
}

export interface AgoraRequestContext {
  readonly actorId?: string
  readonly provider?: string
  readonly conversationRef?: string
  readonly threadRef?: string
}

export type AgoraCommandResult =
  | { readonly kind: 'success'; readonly text?: string }
  | { readonly kind: 'error'; readonly text: string }

export type DshAgoraImStatus =
  | { readonly state: 'connected'; readonly service: string; readonly protocol: string }
  | { readonly state: 'unavailable'; readonly reason: string }
  | { readonly state: 'incompatible'; readonly service: string; readonly reason: string }

export interface DshAgoraSnapshot {
  readonly serverUrl: string
  readonly command: string
  readonly im: DshAgoraImStatus
  readonly imBridge: DshAgoraImStatus
  readonly node: DshAgoraNodeStatus
  readonly extensions: readonly DshAgoraExtensionSummary[]
}

export type DshAgoraNodeStatus =
  | { readonly state: 'disabled'; readonly nodeId: string }
  | { readonly state: 'connecting'; readonly nodeId: string }
  | { readonly state: 'online'; readonly nodeId: string; readonly lastHeartbeatAt: string }
  | { readonly state: 'error'; readonly nodeId: string; readonly error: string; readonly lastHeartbeatAt?: string }

export interface DshAgoraExtensionSummary {
  readonly id: string
  readonly protocol: string
  readonly kind: string
  readonly capabilities: readonly string[]
}

export interface DshAgoraServiceApi {
  readonly serverUrl: string
  health(signal?: AbortSignal): Promise<AgoraHealth>
  listTasks(state?: string, projectId?: string, signal?: AbortSignal): Promise<AgoraTask[]>
  getTask(taskId: string, signal?: AbortSignal): Promise<AgoraTask>
  taskStatus(taskId: string, signal?: AbortSignal): Promise<AgoraTaskStatus>
  createTask(input: CreateAgoraTaskInput, signal?: AbortSignal): Promise<AgoraTask>
  listRuntimeNodes(signal?: AbortSignal): Promise<RuntimeNode[]>
  listRuntimeTargets(signal?: AbortSignal): Promise<RuntimeTarget[]>
  createRuntimeDispatch(nodeId: string, input: CreateRuntimeDispatchInput, signal?: AbortSignal): Promise<RuntimeDispatch>
  getRuntimeDispatch(dispatchId: string, signal?: AbortSignal): Promise<RuntimeDispatch>
  listRuntimeDispatchProgress(dispatchId: string, signal?: AbortSignal): Promise<RuntimeDispatchProgress[]>
  dispatchAgent(input: DispatchAgentInput, signal?: AbortSignal): Promise<RuntimeDispatch>
  bindRuntimeSession(taskId: string, participantBindingId: string, sessionId: string, agentRef?: string, signal?: AbortSignal): Promise<RuntimeSessionBinding>
  executeCommand(rawInput: string, context?: AgoraRequestContext, signal?: AbortSignal): Promise<AgoraCommandResult>
  snapshot(): DshAgoraSnapshot
}
