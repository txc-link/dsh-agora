import { z } from 'zod';

export const taskTimelineEventSourceSchema = z.enum([
  'task', 'flow_log', 'progress_log', 'action_attempt', 'action_receipt', 'runtime_dispatch', 'artifact',
]);
export type TaskTimelineEventSourceDto = z.infer<typeof taskTimelineEventSourceSchema>;

export const taskTimelineEventSchema = z.object({
  id: z.string().min(1),
  source: taskTimelineEventSourceSchema,
  event: z.string().min(1),
  task_id: z.string().min(1),
  stage_id: z.string().min(1).nullable(),
  actor: z.string().min(1).nullable(),
  summary: z.string().min(1),
  detail: z.record(z.string(), z.unknown()).default({}),
  created_at: z.string().datetime({ offset: true }),
}).strict();
export type TaskTimelineEventDto = z.infer<typeof taskTimelineEventSchema>;

export const taskStuckStateSchema = z.object({
  is_stuck: z.boolean(),
  idle_ms: z.number().int().nonnegative(),
  last_activity_at: z.string().datetime({ offset: true }).nullable(),
  threshold_ms: z.number().int().positive(),
}).strict();
export type TaskStuckStateDto = z.infer<typeof taskStuckStateSchema>;

export const taskTimelineResponseSchema = z.object({
  task_id: z.string().min(1),
  generated_at: z.string().datetime({ offset: true }),
  events: z.array(taskTimelineEventSchema),
  stuck: taskStuckStateSchema,
}).strict();
export type TaskTimelineResponseDto = z.infer<typeof taskTimelineResponseSchema>;
