import { describe, expect, it, vi } from 'vitest';
import type { IRoutineRepository, RoutineDto, RoutineRunDto, TaskMemorySummaryDto } from '@agora-ts/contracts';
import type { TaskMemorySummaryService } from '@agora-ts/core';
import { RoutineService } from '@agora-ts/core';
import { buildApp } from './app.js';

class InMemoryRoutineRepository implements IRoutineRepository {
  readonly routines: RoutineDto[] = [];
  readonly runs: RoutineRunDto[] = [];
  insert(record: RoutineDto) { this.routines.push(record); return record; }
  getById(id: string) { return this.routines.find((routine) => routine.routine_id === id) ?? null; }
  list(filters: { owner_ref?: string; agent_ref?: string; status?: RoutineDto['status'] } = {}) {
    return this.routines.filter((routine) => (filters.owner_ref === undefined || routine.owner_ref === filters.owner_ref)
      && (filters.agent_ref === undefined || routine.agent_ref === filters.agent_ref)
      && (filters.status === undefined || routine.status === filters.status));
  }
  updateStatus(id: string, status: RoutineDto['status'], updatedAt: string) {
    const routine = this.getById(id); if (!routine) return null;
    routine.status = status; routine.updated_at = updatedAt; return routine;
  }
  claimDue() { return []; }
  attachDispatch(id: string) { return this.runs.find((run) => run.id === id) ?? null; }
  markSucceeded(id: string) { return this.runs.find((run) => run.id === id) ?? null; }
  markFailed(id: string) { return this.runs.find((run) => run.id === id) ?? null; }
  updateArtifact(id: string) { return this.runs.find((run) => run.id === id) ?? null; }
  updateDelivery(id: string) { return this.runs.find((run) => run.id === id) ?? null; }
  listRuns(filters: { routine_id?: string; status?: RoutineRunDto['status']; delivery_status?: RoutineRunDto['delivery_status'] } = {}) {
    return this.runs.filter((run) => (filters.routine_id === undefined || run.routine_id === filters.routine_id)
      && (filters.status === undefined || run.status === filters.status)
      && (filters.delivery_status === undefined || run.delivery_status === filters.delivery_status));
  }
}

describe('memory summary and routine routes', () => {
  it('exposes idempotent summary scan and routine lifecycle surfaces', async () => {
    const summary: TaskMemorySummaryDto = {
      id: 'summary-1', task_id: 'task-1', scope_ref: 'project:demo', fingerprint: 'a'.repeat(64), memory_id: null,
      status: 'pending', error: null, created_at: '2026-09-01T09:00:00.000Z', updated_at: '2026-09-01T09:00:00.000Z',
    };
    const summaryService = {
      summarizeTask: vi.fn(async () => ({ status: 'already_summarized' as const, summary })),
      listByTask: vi.fn(() => [summary]),
      scanTerminalTasks: vi.fn(async () => ({ scanned: 1, created: 0, skipped: 1, failed: 0 })),
    } as unknown as TaskMemorySummaryService;
    const routineService = new RoutineService({
      repository: new InMemoryRoutineRepository(), now: () => new Date('2026-09-01T09:00:00.000Z'),
    });
    const routineRunner = { runOnce: vi.fn(async () => ({ claimed: 1, dispatched: 1, waiting: 0, completed: 0, failed: 0, delivered: 0, delivery_failed: 0, delivery_skipped: 0 })) };
    const app = buildApp({ taskMemorySummaryService: summaryService, routineService, routineRunner });
    const summaryResponse = await app.inject({ method: 'POST', url: '/api/tasks/task-1/memory-summary', payload: { scope_ref: 'project:demo' } });
    expect(summaryResponse.statusCode).toBe(200);
    expect(summaryResponse.json().status).toBe('already_summarized');
    expect((await app.inject({ method: 'GET', url: '/api/tasks/task-1/memory-summaries' })).json().summaries).toHaveLength(1);
    expect((await app.inject({ method: 'POST', url: '/api/memory-summaries/scan', payload: { limit: 5 } })).json().scanned).toBe(1);

    const routineResponse = await app.inject({ method: 'POST', url: '/api/routines', payload: {
      routine_id: 'routine-1', owner_ref: 'org:demo', agent_ref: 'agent:ea', role_ref: 'role:assistant', name: 'brief',
      prompt: 'summarize priorities', schedule: { kind: 'interval', interval_seconds: 3600 }, first_run_at: '2026-09-01T10:00:00.000Z',
      target_domain: 'work', delivery_binding_ref: 'matrix:room:briefing', metadata: {},
    } });
    expect(routineResponse.statusCode).toBe(201);
    expect((await app.inject({ method: 'GET', url: '/api/routines?owner_ref=org%3Ademo' })).json().routines).toHaveLength(1);
    const statusResponse = await app.inject({ method: 'PATCH', url: '/api/routines/routine-1/status', payload: { status: 'paused' } });
    expect(statusResponse.statusCode).toBe(200);
    expect(statusResponse.json().status).toBe('paused');
    const runResponse = await app.inject({ method: 'POST', url: '/api/routines/run' });
    expect(runResponse.statusCode).toBe(200);
    expect(runResponse.json().claimed).toBe(1);
    expect(routineRunner.runOnce).toHaveBeenCalledTimes(1);
    await app.close();
  });
});
