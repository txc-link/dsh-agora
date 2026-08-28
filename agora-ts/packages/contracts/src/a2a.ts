import { z } from 'zod';

export const a2aTextPartSchema = z.object({ text: z.string().min(1) }).strict();
export const a2aMessageSchema = z.object({
  messageId: z.string().min(1),
  role: z.enum(['user', 'agent']),
  parts: z.array(a2aTextPartSchema).min(1),
  contextId: z.string().min(1).nullable().optional(),
  taskId: z.string().min(1).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
}).strict();

export const a2aSendMessageRequestSchema = z.object({
  message: a2aMessageSchema,
  configuration: z.object({ blocking: z.boolean().default(false) }).strict().default({ blocking: false }),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
}).strict();
export type A2aSendMessageRequestDto = z.infer<typeof a2aSendMessageRequestSchema>;

export const a2aTaskStateSchema = z.enum(['submitted', 'working', 'completed', 'failed', 'cancelled', 'rejected']);
export const a2aTaskSchema = z.object({
  id: z.string().min(1),
  contextId: z.string().min(1),
  status: z.object({
    state: a2aTaskStateSchema,
    message: a2aMessageSchema.nullable().optional(),
    timestamp: z.string(),
  }).strict(),
  history: z.array(a2aMessageSchema).default([]),
  artifacts: z.array(z.object({
    artifactId: z.string().min(1),
    name: z.string().min(1),
    parts: z.array(a2aTextPartSchema).min(1),
    metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  }).strict()).default([]),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
}).strict();
export type A2aTaskDto = z.infer<typeof a2aTaskSchema>;

export const a2aAgentCardSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  supportedInterfaces: z.array(z.object({
    url: z.string().url(),
    protocolBinding: z.literal('HTTP+JSON'),
    protocolVersion: z.literal('1.0'),
  }).strict()).min(1),
  provider: z.object({ organization: z.string().min(1), url: z.string().url() }).strict(),
  version: z.string().min(1),
  capabilities: z.object({
    streaming: z.literal(false),
    pushNotifications: z.literal(false),
    extendedAgentCard: z.literal(false),
  }).strict(),
  securitySchemes: z.record(z.string(), z.unknown()),
  securityRequirements: z.array(z.record(z.string(), z.array(z.string()))),
  defaultInputModes: z.array(z.string().min(1)).min(1),
  defaultOutputModes: z.array(z.string().min(1)).min(1),
  skills: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().min(1),
    tags: z.array(z.string()),
  }).strict()),
}).strict();
export type A2aAgentCardDto = z.infer<typeof a2aAgentCardSchema>;
