import type {
  IPlanningBindingRepository,
  PlanningBinding,
  PlanningSyncStatus,
  TaskState,
} from '@agora-ts/contracts';
import type { CalendarProviderPort, LinkedCalendarEventState } from './calendar-provider-port.js';
import type { ExternalPlanningTask, ExternalTaskProviderPort } from './external-task-provider-port.js';

export interface PlanningTaskStatePort {
  getTask(taskId: string): { readonly id: string; readonly state: string } | null;
  transitionTask(taskId: string, state: 'done' | 'cancelled', reason: string): { readonly id: string; readonly state: string };
}

export interface PlanningSyncServiceOptions {
  readonly repo: IPlanningBindingRepository;
  readonly taskPort: PlanningTaskStatePort;
  readonly taskProvider?: ExternalTaskProviderPort;
  readonly calendarProvider?: CalendarProviderPort;
  readonly now?: () => Date;
}

export interface PlanningSyncResult {
  readonly taskId: string;
  readonly status: PlanningSyncStatus | 'skipped';
  readonly localState: string | null;
  readonly externalTaskState: 'open' | 'completed' | 'deleted' | null;
  readonly calendarEventState: 'scheduled' | 'cancelled' | null;
  readonly actions: readonly string[];
  readonly error: string | null;
}

export class PlanningSyncService {
  private readonly now: () => Date;

  constructor(private readonly options: PlanningSyncServiceOptions) {
    this.now = options.now ?? (() => new Date());
  }

  async syncTask(taskId: string): Promise<PlanningSyncResult> {
    const binding = this.options.repo.getByTask(required(taskId, 'taskId'));
    if (!binding) return this.result(taskId, 'failed', null, null, null, [], `planning binding not found: ${taskId}`);
    if (binding.syncMode !== 'bidirectional') return this.result(taskId, 'skipped', null, null, null, [], null);

    const task = this.options.taskPort.getTask(taskId);
    if (!task) return this.persist(binding, 'failed', null, null, null, [], `task not found: ${taskId}`);

    try {
      const [externalTask, calendarEvent] = await Promise.all([
        this.readExternalTask(binding),
        this.readCalendarEvent(binding),
      ]);
      const externalState = binding.externalTaskRef ? (externalTask?.status ?? 'deleted') : null;
      const calendarState = calendarEvent?.state ?? null;
      const desired = new Set<'done' | 'cancelled'>();
      if (externalState === 'completed') desired.add('done');
      if (externalState === 'deleted' || calendarState === 'cancelled') desired.add('cancelled');

      if (desired.size > 1) {
        return this.persist(binding, 'conflict', task.state, externalState, calendarState, [], 'provider terminal states disagree');
      }
      const desiredState = [...desired][0];
      if (desiredState && isTerminal(task.state) && task.state !== desiredState) {
        return this.persist(binding, 'conflict', task.state, externalState, calendarState, [], `Agora ${task.state} conflicts with provider ${desiredState}`);
      }

      const actions: string[] = [];
      let localState = task.state;
      if (desiredState && localState !== desiredState) {
        if (!canTransitionFromSync(localState, desiredState)) {
          return this.persist(binding, 'conflict', localState, externalState, calendarState, [], `cannot transition Agora ${localState} to ${desiredState}`);
        }
        localState = this.options.taskPort.transitionTask(taskId, desiredState, 'bidirectional planning state sync').state;
        actions.push(`agora:${desiredState}`);
      }

      if (localState === 'done' && externalState === 'open') {
        const provider = this.requireTaskProvider(binding);
        if (!provider.completeTask) throw new Error(`external task provider ${provider.providerId} cannot complete tasks`);
        await provider.completeTask(this.externalRefs(binding));
        actions.push('external-task:completed');
      }
      if (localState === 'cancelled' && externalState === 'open') {
        const provider = this.requireTaskProvider(binding);
        if (!provider.deleteTask) throw new Error(`external task provider ${provider.providerId} cannot delete tasks`);
        await provider.deleteTask(this.externalRefs(binding));
        actions.push('external-task:deleted');
      }
      if (localState === 'cancelled' && calendarState === 'scheduled') {
        const provider = this.requireCalendarProvider(binding);
        if (!provider.cancelEvent) throw new Error(`calendar provider ${provider.providerId} cannot cancel events`);
        await provider.cancelEvent(binding.domain, binding.calendarEventRef!, calendarEvent?.version);
        actions.push('calendar-event:cancelled');
      }

      return this.persist(binding, 'synced', localState, finalExternalState(localState, externalState), finalCalendarState(localState, calendarState), actions, null);
    } catch (error) {
      return this.persist(binding, 'failed', task.state, null, null, [], error instanceof Error ? error.message : String(error));
    }
  }

  async syncAll(): Promise<{ results: readonly PlanningSyncResult[]; synced: number; conflicts: number; failed: number; skipped: number }> {
    const results: PlanningSyncResult[] = [];
    for (const binding of this.options.repo.list()) results.push(await this.syncTask(binding.taskId));
    return {
      results,
      synced: results.filter(item => item.status === 'synced').length,
      conflicts: results.filter(item => item.status === 'conflict').length,
      failed: results.filter(item => item.status === 'failed').length,
      skipped: results.filter(item => item.status === 'skipped').length,
    };
  }

  private async readExternalTask(binding: PlanningBinding): Promise<ExternalPlanningTask | null> {
    if (!binding.externalTaskRef) return null;
    const provider = this.requireTaskProvider(binding);
    if (!provider.getTask) throw new Error(`external task provider ${provider.providerId} cannot read tasks`);
    return provider.getTask(this.externalRefs(binding));
  }

  private async readCalendarEvent(binding: PlanningBinding): Promise<LinkedCalendarEventState | null> {
    if (!binding.calendarEventRef) return null;
    const provider = this.requireCalendarProvider(binding);
    if (!provider.getEventState) throw new Error(`calendar provider ${provider.providerId} cannot read event state`);
    return provider.getEventState(binding.domain, binding.calendarEventRef);
  }

  private requireTaskProvider(binding: PlanningBinding): ExternalTaskProviderPort {
    const provider = this.options.taskProvider;
    if (!provider || provider.providerId !== binding.externalTaskProvider) throw new Error(`external task provider ${binding.externalTaskProvider ?? 'unknown'} is not configured`);
    return provider;
  }

  private requireCalendarProvider(binding: PlanningBinding): CalendarProviderPort {
    const provider = this.options.calendarProvider;
    if (!provider || provider.providerId !== binding.calendarProvider) throw new Error(`calendar provider ${binding.calendarProvider ?? 'unknown'} is not configured`);
    return provider;
  }

  private externalRefs(binding: PlanningBinding): { projectRef: string; taskRef: string } {
    return { projectRef: required(binding.externalTaskProjectRef ?? '', 'external task project ref'), taskRef: required(binding.externalTaskRef ?? '', 'external task ref') };
  }

  private persist(binding: PlanningBinding, status: PlanningSyncStatus, localState: string | null, externalTaskState: PlanningSyncResult['externalTaskState'], calendarEventState: PlanningSyncResult['calendarEventState'], actions: readonly string[], error: string | null): PlanningSyncResult {
    this.options.repo.recordSyncResult(binding.taskId, { status, syncedAt: this.now().toISOString(), error });
    return this.result(binding.taskId, status, localState, externalTaskState, calendarEventState, actions, error);
  }

  private result(taskId: string, status: PlanningSyncResult['status'], localState: string | null, externalTaskState: PlanningSyncResult['externalTaskState'], calendarEventState: PlanningSyncResult['calendarEventState'], actions: readonly string[], error: string | null): PlanningSyncResult {
    return Object.freeze({ taskId, status, localState, externalTaskState, calendarEventState, actions: Object.freeze([...actions]), error });
  }
}

function isTerminal(state: string): state is Extract<TaskState, 'done' | 'cancelled'> { return state === 'done' || state === 'cancelled'; }
function canTransitionFromSync(from: string, to: 'done' | 'cancelled'): boolean {
  return to === 'done' ? from === 'active' : from === 'active' || from === 'blocked' || from === 'paused';
}
function finalExternalState(local: string, before: PlanningSyncResult['externalTaskState']): PlanningSyncResult['externalTaskState'] {
  if (before === null) return null;
  return local === 'done' ? 'completed' : local === 'cancelled' ? 'deleted' : before;
}
function finalCalendarState(local: string, before: PlanningSyncResult['calendarEventState']): PlanningSyncResult['calendarEventState'] {
  return before === null ? null : local === 'cancelled' ? 'cancelled' : before;
}
function required(value: string, label: string): string { const normalized = value.trim(); if (!normalized) throw new TypeError(`${label} is required`); return normalized; }
