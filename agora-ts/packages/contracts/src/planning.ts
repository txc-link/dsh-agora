import { z } from 'zod';
import { calendarDomainSchema } from './task-api.js';

export const planningSyncModeSchema = z.enum(['manual', 'bidirectional']);
export type PlanningSyncMode = z.infer<typeof planningSyncModeSchema>;
export const planningSyncStatusSchema = z.enum(['pending', 'synced', 'conflict', 'failed']);
export type PlanningSyncStatus = z.infer<typeof planningSyncStatusSchema>;

export const planningBindingSchema = z.object({
  taskId: z.string().min(1),
  domain: calendarDomainSchema,
  externalTaskProvider: z.string().nullable(),
  externalTaskRef: z.string().nullable(),
  externalTaskProjectRef: z.string().nullable(),
  calendarProvider: z.string().nullable(),
  calendarEventRef: z.string().nullable(),
  syncMode: planningSyncModeSchema,
  lastSyncStatus: planningSyncStatusSchema,
  lastSyncAt: z.string().nullable(),
  lastSyncError: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PlanningBinding = z.infer<typeof planningBindingSchema>;

export interface PlanningBindingUpsertInput {
  readonly taskId: string;
  readonly domain: 'work' | 'life';
  readonly externalTask?: {
    readonly provider: string;
    readonly ref: string;
    readonly projectRef?: string | null;
  };
  readonly calendarEvent?: {
    readonly provider: string;
    readonly ref: string;
  };
  readonly syncMode?: PlanningSyncMode;
}

export interface IPlanningBindingRepository {
  upsert(input: PlanningBindingUpsertInput): PlanningBinding;
  getByTask(taskId: string): PlanningBinding | undefined;
  list(): readonly PlanningBinding[];
  removeByTask(taskId: string): boolean;
  setSyncMode(taskId: string, mode: PlanningSyncMode): PlanningBinding;
  recordSyncResult(taskId: string, input: {
    readonly status: PlanningSyncStatus;
    readonly syncedAt: string;
    readonly error?: string | null;
  }): PlanningBinding;
}

export const projectExternalTaskRequestSchema = z.object({
  domain: calendarDomainSchema,
  projectRef: z.string().min(1),
  title: z.string().min(1).optional(),
  content: z.string().optional(),
  start: z.string().optional(),
  due: z.string().optional(),
  timeZone: z.string().optional(),
  syncMode: planningSyncModeSchema.default('bidirectional'),
});
export type ProjectExternalTaskRequestDto = z.infer<typeof projectExternalTaskRequestSchema>;

export const projectCalendarEventRequestSchema = z.object({
  domain: calendarDomainSchema,
  summary: z.string().min(1).optional(),
  start: z.string().min(1),
  end: z.string().min(1),
  location: z.string().nullable().optional(),
  syncMode: planningSyncModeSchema.default('bidirectional'),
});
export type ProjectCalendarEventRequestDto = z.infer<typeof projectCalendarEventRequestSchema>;

export const configurePlanningSyncRequestSchema = z.object({
  mode: planningSyncModeSchema,
});
export type ConfigurePlanningSyncRequestDto = z.infer<typeof configurePlanningSyncRequestSchema>;
