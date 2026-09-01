import type { CalendarDomainDto, IPlanningBindingRepository, ITaskRepository, PlanningBinding, PlanningSyncMode } from '@agora-ts/contracts';
import type { CalendarProviderPort } from './calendar-provider-port.js';
import type { ExternalTaskProviderPort } from './external-task-provider-port.js';

export interface PlanningServiceOptions {
  readonly repo: IPlanningBindingRepository;
  readonly taskRepo: Pick<ITaskRepository, 'getTask'>;
  readonly calendarProvider?: CalendarProviderPort;
  readonly taskProvider?: ExternalTaskProviderPort;
}

export class PlanningService {
  constructor(private readonly options: PlanningServiceOptions) {}

  get canProjectExternalTasks(): boolean { return this.options.taskProvider !== undefined; }
  get canProjectCalendarEvents(): boolean { return this.options.calendarProvider?.createEvent !== undefined; }

  getByTask(taskId: string): PlanningBinding | undefined { return this.options.repo.getByTask(required(taskId, 'taskId')); }
  list(): readonly PlanningBinding[] { return this.options.repo.list(); }
  removeByTask(taskId: string): boolean { return this.options.repo.removeByTask(required(taskId, 'taskId')); }

  async projectExternalTask(input: {
    taskId: string; domain: CalendarDomainDto; projectRef: string; title?: string | undefined; content?: string | undefined;
    start?: string | undefined; due?: string | undefined; timeZone?: string | undefined; syncMode?: PlanningSyncMode | undefined;
  }): Promise<PlanningBinding> {
    const task = this.requireTask(input.taskId);
    const existing = this.options.repo.getByTask(task.id);
    assertDomain(existing, input.domain);
    if (existing?.externalTaskRef) return existing;
    const provider = this.options.taskProvider;
    if (!provider) throw new Error('external task provider is not configured');
    const projected = await provider.createTask({
      projectRef: required(input.projectRef, 'projectRef'),
      title: input.title?.trim() || task.title,
      content: input.content ?? task.description,
      ...(input.start === undefined ? {} : { start: input.start }),
      ...(input.due === undefined ? {} : { due: input.due }),
      ...(input.timeZone === undefined ? {} : { timeZone: input.timeZone }),
    });
    return this.options.repo.upsert({
      taskId: task.id, domain: input.domain,
      externalTask: { provider: provider.providerId, ref: projected.id, projectRef: projected.projectRef },
      ...(input.syncMode === undefined ? {} : { syncMode: input.syncMode }),
    });
  }

  async projectCalendarEvent(input: {
    taskId: string; domain: CalendarDomainDto; summary?: string | undefined; start: string; end: string; location?: string | null | undefined;
    syncMode?: PlanningSyncMode | undefined;
  }): Promise<PlanningBinding> {
    const task = this.requireTask(input.taskId);
    const existing = this.options.repo.getByTask(task.id);
    assertDomain(existing, input.domain);
    if (existing?.calendarEventRef) return existing;
    const provider = this.options.calendarProvider;
    if (!provider?.createEvent) throw new Error('writable calendar provider is not configured');
    const event = await provider.createEvent(input.domain, {
      summary: input.summary?.trim() || task.title,
      start: required(input.start, 'start'), end: required(input.end, 'end'),
      ...(input.location === undefined ? {} : { location: input.location }),
    });
    return this.options.repo.upsert({
      taskId: task.id, domain: input.domain,
      calendarEvent: { provider: provider.providerId, ref: event.uid },
      ...(input.syncMode === undefined ? {} : { syncMode: input.syncMode }),
    });
  }

  configureSync(taskId: string, mode: PlanningSyncMode): PlanningBinding {
    this.requireTask(taskId);
    return this.options.repo.setSyncMode(required(taskId, 'taskId'), mode);
  }

  private requireTask(taskId: string) {
    const task = this.options.taskRepo.getTask(required(taskId, 'taskId'));
    if (!task) throw new Error(`task not found: ${taskId}`);
    return task;
  }
}

function assertDomain(binding: PlanningBinding | undefined, domain: CalendarDomainDto): void {
  if (binding && binding.domain !== domain) {
    throw new Error(`planning binding domain cannot change from ${binding.domain} to ${domain}`);
  }
}

function required(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new TypeError(`${label} is required`);
  return normalized;
}
