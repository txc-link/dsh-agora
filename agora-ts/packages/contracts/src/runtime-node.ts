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
  result: z.record(z.string(), z.unknown()).nullable(),
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
  error: z.string().min(1).nullable().optional(),
  delivery_payload: z.record(z.string(), z.unknown()).nullable().optional(),
}).strict();
export type CompleteRuntimeNodeDispatchRequestDto = z.infer<typeof completeRuntimeNodeDispatchRequestSchema>;

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
