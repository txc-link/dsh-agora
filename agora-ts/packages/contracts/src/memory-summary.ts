import { z } from 'zod';

export const taskMemorySummaryStatusSchema = z.enum(['pending', 'succeeded', 'failed']);
export type TaskMemorySummaryStatusDto = z.infer<typeof taskMemorySummaryStatusSchema>;

export const taskMemorySummarySchema = z.object({
  id: z.string().min(1),
  task_id: z.string().min(1),
  scope_ref: z.string().min(1),
  fingerprint: z.string().length(64),
  memory_id: z.string().min(1).nullable(),
  status: taskMemorySummaryStatusSchema,
  error: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
}).strict();
export type TaskMemorySummaryDto = z.infer<typeof taskMemorySummarySchema>;

