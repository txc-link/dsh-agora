import { z } from 'zod';
import { calendarDomainSchema } from './task-api.js';

export const planningBindingSchema = z.object({
  taskId: z.string().min(1),
  domain: calendarDomainSchema,
  externalTaskProvider: z.string().nullable(),
  externalTaskRef: z.string().nullable(),
  externalTaskProjectRef: z.string().nullable(),
  calendarProvider: z.string().nullable(),
  calendarEventRef: z.string().nullable(),
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
}

export interface IPlanningBindingRepository {
  upsert(input: PlanningBindingUpsertInput): PlanningBinding;
  getByTask(taskId: string): PlanningBinding | undefined;
  list(): readonly PlanningBinding[];
  removeByTask(taskId: string): boolean;
}

export const projectExternalTaskRequestSchema = z.object({
  domain: calendarDomainSchema,
  projectRef: z.string().min(1),
  title: z.string().min(1).optional(),
  content: z.string().optional(),
  start: z.string().optional(),
  due: z.string().optional(),
  timeZone: z.string().optional(),
});
export type ProjectExternalTaskRequestDto = z.infer<typeof projectExternalTaskRequestSchema>;

export const projectCalendarEventRequestSchema = z.object({
  domain: calendarDomainSchema,
  summary: z.string().min(1).optional(),
  start: z.string().min(1),
  end: z.string().min(1),
  location: z.string().nullable().optional(),
});
export type ProjectCalendarEventRequestDto = z.infer<typeof projectCalendarEventRequestSchema>;
