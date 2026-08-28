import { z } from 'zod';

export const runtimeNodeProtocolSchema = z.literal('dsh-agora.node/v1');
export type RuntimeNodeProtocolDto = z.infer<typeof runtimeNodeProtocolSchema>;

export const runtimeNodeAgentSchema = z.object({
  agent_ref: z.string().min(1),
  display_name: z.string().min(1).nullable().optional(),
  preset: z.string().min(1).nullable().optional(),
  model: z.string().min(1).nullable().optional(),
  workspace_alias: z.string().min(1).nullable().optional(),
  roles: z.array(z.string().min(1)).default([]),
  capabilities: z.array(z.string().min(1)).default([]),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
}).strict();
export type RuntimeNodeAgentDto = z.infer<typeof runtimeNodeAgentSchema>;

export const runtimeNodeBotSchema = z.object({
  provider: z.string().min(1),
  bot_ref: z.string().min(1),
  platform_id: z.string().min(1).nullable().optional(),
  display_name: z.string().min(1).nullable().optional(),
  agent_ref: z.string().min(1).nullable().optional(),
  connected: z.boolean(),
  capabilities: z.array(z.string().min(1)).default([]),
}).strict();
export type RuntimeNodeBotDto = z.infer<typeof runtimeNodeBotSchema>;

export const runtimeNodeCapacitySchema = z.object({
  max_concurrent: z.number().int().positive().max(1_000),
  active: z.number().int().nonnegative().max(1_000),
}).strict();
export type RuntimeNodeCapacityDto = z.infer<typeof runtimeNodeCapacitySchema>;

export const runtimeNodeHeartbeatRequestSchema = z.object({
  protocol: runtimeNodeProtocolSchema,
  instance_id: z.string().min(1),
  plugin_version: z.string().min(1),
  host_framework: z.literal('deepseek-harness'),
  runtime_provider: z.literal('dsh'),
  agents: z.array(runtimeNodeAgentSchema).min(1),
  bots: z.array(runtimeNodeBotSchema).default([]),
  capacity: runtimeNodeCapacitySchema,
  lease_seconds: z.number().int().min(15).max(600).default(90),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
}).strict();
export type RuntimeNodeHeartbeatRequestDto = z.infer<typeof runtimeNodeHeartbeatRequestSchema>;

export const runtimeNodePresenceSchema = z.enum(['online', 'stale']);
export type RuntimeNodePresenceDto = z.infer<typeof runtimeNodePresenceSchema>;

export const runtimeNodeSchema = runtimeNodeHeartbeatRequestSchema.extend({
  node_id: z.string().min(1),
  presence: runtimeNodePresenceSchema,
  registered_at: z.string(),
  last_seen_at: z.string(),
  expires_at: z.string(),
});
export type RuntimeNodeDto = z.infer<typeof runtimeNodeSchema>;

export const runtimeNodeListResponseSchema = z.object({
  nodes: z.array(runtimeNodeSchema),
});

export const runtimeNodeDispatchStatusSchema = z.enum([
  'pending',
  'claimed',
  'completed',
  'failed',
  'cancelled',
]);
export type RuntimeNodeDispatchStatusDto = z.infer<typeof runtimeNodeDispatchStatusSchema>;

export const createRuntimeNodeDispatchRequestSchema = z.object({
  task_id: z.string().min(1).nullable().optional(),
  participant_binding_id: z.string().min(1).nullable().optional(),
  runtime_target_ref: z.string().min(1),
  session_id: z.string().min(1).nullable().optional(),
  workspace_alias: z.string().min(1).nullable().optional(),
  agent_preset: z.string().min(1).nullable().optional(),
  prompt: z.string().min(1).max(200_000),
  idempotency_key: z.string().min(1).max(256),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
}).strict();
export type CreateRuntimeNodeDispatchRequestDto = z.infer<typeof createRuntimeNodeDispatchRequestSchema>;

export const runtimeResultEvidenceSchema = z.object({
  id: z.string().min(1).max(128),
  kind: z.enum(['file', 'url', 'commit', 'measurement', 'log', 'command', 'other']),
  label: z.string().min(1).max(512).nullable().optional(),
  uri: z.string().min(1).max(4_096).nullable().optional(),
  content_hash: z.string().min(1).max(256).nullable().optional(),
  revision: z.string().min(1).max(256).nullable().optional(),
  line_start: z.number().int().positive().nullable().optional(),
  line_end: z.number().int().positive().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
}).strict();
export type RuntimeResultEvidenceDto = z.infer<typeof runtimeResultEvidenceSchema>;

export const runtimeResultClaimSchema = z.object({
  id: z.string().min(1).max(128),
  statement: z.string().min(1).max(10_000),
  evidence_ids: z.array(z.string().min(1).max(128)).default([]),
  confidence: z.number().min(0).max(1).nullable().optional(),
}).strict();
export type RuntimeResultClaimDto = z.infer<typeof runtimeResultClaimSchema>;

export const runtimeResultEnvelopeSchema = z.object({
  schema: z.literal('agora.runtime-result/v1'),
  answer: z.string().max(200_000),
  claims: z.array(runtimeResultClaimSchema).default([]),
  evidence: z.array(runtimeResultEvidenceSchema).default([]),
  confidence: z.number().min(0).max(1).nullable().optional(),
  environment: z.object({
    runtime_provider: z.string().min(1),
    agent_ref: z.string().min(1).nullable().optional(),
    model: z.string().min(1).nullable().optional(),
    workspace_alias: z.string().min(1).nullable().optional(),
    revision: z.string().min(1).nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  }).strict().nullable().optional(),
  usage: z.object({
    input_tokens: z.number().int().nonnegative().nullable().default(null),
    output_tokens: z.number().int().nonnegative().nullable().default(null),
    total_tokens: z.number().int().nonnegative().nullable().default(null),
    tool_calls: z.number().int().nonnegative().nullable().default(null),
    cost_usd: z.number().nonnegative().nullable().default(null),
    duration_ms: z.number().int().nonnegative().nullable().default(null),
  }).strict().nullable().optional(),
}).strict();
export type RuntimeResultEnvelopeDto = z.infer<typeof runtimeResultEnvelopeSchema>;

export const recordRuntimeNodeDispatchProgressRequestSchema = z.object({
  instance_id: z.string().min(1),
  claim_token: z.string().min(1),
  sequence: z.number().int().positive(),
  phase: z.string().min(1).max(64),
  message: z.string().min(1).max(4_000).nullable().optional(),
  percent: z.number().min(0).max(100).nullable().optional(),
  details: z.record(z.string(), z.unknown()).nullable().optional(),
}).strict();
export type RecordRuntimeNodeDispatchProgressRequestDto = z.infer<typeof recordRuntimeNodeDispatchProgressRequestSchema>;

export const runtimeNodeDispatchProgressSchema = recordRuntimeNodeDispatchProgressRequestSchema.omit({
  claim_token: true,
}).extend({
  id: z.string().min(1),
  dispatch_id: z.string().min(1),
  node_id: z.string().min(1),
  attempt: z.number().int().positive(),
  created_at: z.string(),
});
export type RuntimeNodeDispatchProgressDto = z.infer<typeof runtimeNodeDispatchProgressSchema>;

export const runtimeNodeDispatchProgressListResponseSchema = z.object({
  events: z.array(runtimeNodeDispatchProgressSchema),
});

export const runtimeNodeDispatchSchema = createRuntimeNodeDispatchRequestSchema.extend({
  id: z.string().min(1),
  node_id: z.string().min(1),
  status: runtimeNodeDispatchStatusSchema,
  claimed_by: z.string().nullable(),
  claim_token: z.string().nullable(),
  claim_expires_at: z.string().nullable(),
  attempt: z.number().int().nonnegative(),
  claimed_at: z.string().nullable(),
  claim_renewed_at: z.string().nullable(),
  latest_progress: runtimeNodeDispatchProgressSchema.nullable(),
  progress_updated_at: z.string().nullable(),
  result: z.record(z.string(), z.unknown()).nullable(),
  result_envelope: runtimeResultEnvelopeSchema.nullable(),
  error: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  completed_at: z.string().nullable(),
});
export type RuntimeNodeDispatchDto = z.infer<typeof runtimeNodeDispatchSchema>;

export const claimRuntimeNodeDispatchRequestSchema = z.object({
  instance_id: z.string().min(1),
  lease_seconds: z.number().int().min(15).max(600).default(120),
}).strict();

export const renewRuntimeNodeDispatchRequestSchema = z.object({
  instance_id: z.string().min(1),
  claim_token: z.string().min(1),
  lease_seconds: z.number().int().min(15).max(600).default(120),
}).strict();
export type RenewRuntimeNodeDispatchRequestDto = z.infer<typeof renewRuntimeNodeDispatchRequestSchema>;

export const completeRuntimeNodeDispatchRequestSchema = z.object({
  instance_id: z.string().min(1),
  claim_token: z.string().min(1),
  status: z.enum(['completed', 'failed']),
  session_id: z.string().min(1).nullable().optional(),
  result: z.record(z.string(), z.unknown()).nullable().optional(),
  result_envelope: runtimeResultEnvelopeSchema.nullable().optional(),
  error: z.string().min(1).nullable().optional(),
  delivery_payload: z.record(z.string(), z.unknown()).nullable().optional(),
}).strict();
export type CompleteRuntimeNodeDispatchRequestDto = z.infer<typeof completeRuntimeNodeDispatchRequestSchema>;

export const cancelRuntimeNodeDispatchRequestSchema = z.object({
  reason: z.string().min(1).max(4_000),
}).strict();
export type CancelRuntimeNodeDispatchRequestDto = z.infer<typeof cancelRuntimeNodeDispatchRequestSchema>;

export const runtimeNodeDeliveryStatusSchema = z.enum([
  'pending',
  'claimed',
  'delivered',
  'failed',
]);
export type RuntimeNodeDeliveryStatusDto = z.infer<typeof runtimeNodeDeliveryStatusSchema>;

export const runtimeNodeDeliverySchema = z.object({
  id: z.string().min(1),
  dispatch_id: z.string().min(1),
  node_id: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  status: runtimeNodeDeliveryStatusSchema,
  attempt: z.number().int().nonnegative(),
  claimed_by: z.string().nullable(),
  claim_token: z.string().nullable(),
  claim_expires_at: z.string().nullable(),
  next_attempt_at: z.string(),
  receipt: z.record(z.string(), z.unknown()).nullable(),
  error: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  delivered_at: z.string().nullable(),
}).strict();
export type RuntimeNodeDeliveryDto = z.infer<typeof runtimeNodeDeliverySchema>;

export const claimRuntimeNodeDeliveryRequestSchema = z.object({
  instance_id: z.string().min(1),
  lease_seconds: z.number().int().min(15).max(600).default(60),
}).strict();

export const completeRuntimeNodeDeliveryRequestSchema = z.discriminatedUnion('status', [
  z.object({
    instance_id: z.string().min(1),
    claim_token: z.string().min(1),
    status: z.literal('delivered'),
    receipt: z.record(z.string(), z.unknown()).nullable().optional(),
  }).strict(),
  z.object({
    instance_id: z.string().min(1),
    claim_token: z.string().min(1),
    status: z.literal('retry'),
    error: z.string().min(1),
    retry_delay_seconds: z.number().int().min(1).max(3_600),
  }).strict(),
  z.object({
    instance_id: z.string().min(1),
    claim_token: z.string().min(1),
    status: z.literal('failed'),
    error: z.string().min(1),
  }).strict(),
]);
export type CompleteRuntimeNodeDeliveryRequestDto = z.infer<typeof completeRuntimeNodeDeliveryRequestSchema>;
