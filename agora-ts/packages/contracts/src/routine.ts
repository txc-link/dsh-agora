import { z } from 'zod';

export const routineScheduleSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('interval'), interval_seconds: z.number().int().min(60).max(31_536_000) }).strict(),
  z.object({ kind: z.literal('daily'), local_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), timezone: z.string().min(1) }).strict(),
]);
export type RoutineScheduleDto = z.infer<typeof routineScheduleSchema>;

export const routineStatusSchema = z.enum(['active', 'paused', 'archived']);
export type RoutineStatusDto = z.infer<typeof routineStatusSchema>;

export const routineRunStatusSchema = z.enum(['scheduled', 'claimed', 'succeeded', 'failed', 'cancelled']);
export type RoutineRunStatusDto = z.infer<typeof routineRunStatusSchema>;

export const routineDeliveryStatusSchema = z.enum(['pending', 'delivered', 'failed', 'skipped']);
export type RoutineDeliveryStatusDto = z.infer<typeof routineDeliveryStatusSchema>;

const routineInputSchema = z.object({
  routine_id: z.string().min(1),
  owner_ref: z.string().min(1),
  agent_ref: z.string().min(1),
  role_ref: z.string().min(1),
  name: z.string().min(1).max(200),
  prompt: z.string().min(1).max(8000),
  schedule: routineScheduleSchema,
  first_run_at: z.string().datetime({ offset: true }),
  target_domain: z.string().min(1),
  delivery_binding_ref: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).strict();
export const createRoutineRequestSchema = routineInputSchema.transform((value) => ({ ...value, metadata: value.metadata ?? {} }));
export type CreateRoutineRequestDto = z.infer<typeof createRoutineRequestSchema>;

export const routineSchema = routineInputSchema.extend({
  status: routineStatusSchema,
  next_run_at: z.string().datetime({ offset: true }),
  last_run_at: z.string().datetime({ offset: true }).nullable(),
  created_at: z.string(),
  updated_at: z.string(),
}).transform((value) => ({ ...value, metadata: value.metadata ?? {} }));
export type RoutineDto = z.infer<typeof routineSchema>;

export const routineRunSchema = z.object({
  id: z.string().min(1),
  routine_id: z.string().min(1),
  scheduled_for: z.string().datetime({ offset: true }),
  status: routineRunStatusSchema,
  consumer_ref: z.string().nullable(),
  lease_token: z.string().nullable(),
  lease_expires_at: z.string().datetime({ offset: true }).nullable(),
  attempt_count: z.number().int().nonnegative(),
  error: z.string().nullable(),
  runtime_dispatch_id: z.string().min(1).nullable().default(null),
  result: z.record(z.string(), z.unknown()).nullable().default(null),
  artifact_id: z.string().min(1).nullable().default(null),
  delivery_status: routineDeliveryStatusSchema.default('pending'),
  delivery_error: z.string().nullable().default(null),
  created_at: z.string(),
  updated_at: z.string(),
}).strict();
export type RoutineRunDto = z.infer<typeof routineRunSchema>;
