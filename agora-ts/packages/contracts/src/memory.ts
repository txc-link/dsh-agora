import { z } from 'zod';

export const memoryScopeSchema = z.enum(['task', 'agent_private', 'project_shared', 'decision', 'episodic']);
export type MemoryScopeDto = z.infer<typeof memoryScopeSchema>;

export const memoryVisibilitySchema = z.enum(['private', 'task', 'project', 'shared']);

const memoryEntryBaseSchema = z.object({
  scope: memoryScopeSchema,
  content: z.string().min(1).max(100_000),
  owner_ref: z.string().min(1).max(256),
  project_id: z.string().min(1).nullable().optional(),
  task_id: z.string().min(1).nullable().optional(),
  agent_ref: z.string().min(1).nullable().optional(),
  visibility: memoryVisibilitySchema,
  source: z.object({
    kind: z.enum(['human', 'agent', 'task', 'conversation', 'artifact', 'system']),
    ref: z.string().min(1).nullable().optional(),
  }).strict(),
  artifact_ids: z.array(z.string().min(1)).default([]),
  evidence_ids: z.array(z.string().min(1)).default([]),
  ttl_seconds: z.number().int().positive().max(31_536_000).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
}).strict();

export const createMemoryEntryRequestSchema = memoryEntryBaseSchema.superRefine((value, context) => {
  if (value.scope === 'task' && !value.task_id) context.addIssue({ code: 'custom', message: 'task scope requires task_id', path: ['task_id'] });
  if (value.scope === 'agent_private' && !value.agent_ref) context.addIssue({ code: 'custom', message: 'agent_private scope requires agent_ref', path: ['agent_ref'] });
  if (value.scope === 'project_shared' && !value.project_id) context.addIssue({ code: 'custom', message: 'project_shared scope requires project_id', path: ['project_id'] });
  if (value.scope === 'agent_private' && value.visibility !== 'private') context.addIssue({ code: 'custom', message: 'agent_private scope requires private visibility', path: ['visibility'] });
  if (value.scope === 'task' && value.visibility !== 'task') context.addIssue({ code: 'custom', message: 'task scope requires task visibility', path: ['visibility'] });
  if (value.scope === 'project_shared' && value.visibility !== 'project') context.addIssue({ code: 'custom', message: 'project_shared scope requires project visibility', path: ['visibility'] });
});
export type CreateMemoryEntryRequestDto = z.infer<typeof createMemoryEntryRequestSchema>;

export const memoryEntrySchema = memoryEntryBaseSchema.omit({ ttl_seconds: true }).extend({
  id: z.string().min(1),
  expires_at: z.string().nullable(),
  created_at: z.string(),
});
export type MemoryEntryDto = z.infer<typeof memoryEntrySchema>;

export const memoryQuerySchema = z.object({
  scopes: z.array(memoryScopeSchema).min(1),
  project_id: z.string().min(1).nullable().optional(),
  task_id: z.string().min(1).nullable().optional(),
  agent_ref: z.string().min(1).nullable().optional(),
  owner_ref: z.string().min(1).nullable().optional(),
  limit: z.number().int().min(1).max(200).default(50),
}).strict();
export type MemoryQueryDto = z.infer<typeof memoryQuerySchema>;

export const memoryListResponseSchema = z.object({ entries: z.array(memoryEntrySchema) });
