import { describe, expect, it } from 'vitest';
import type { TaskRecord } from '@agora-ts/contracts';
import { TaskTimelineService } from './task-timeline-service.js';

const task = {
  id: 'task-1', version: 1, title: 'Timeline', creator: 'human:ceo', state: 'active', current_stage: 'research',
  updated_at: '2026-09-01T00:00:00.000Z',
} as TaskRecord;

describe('TaskTimelineService', () => {
  it('merges activity sources and reports stale active work', () => {
    const response = new TaskTimelineService().build({
      task,
      flowLogs: [{ id: 1, task_id: 'task-1', kind: 'state', event: 'started', stage_id: 'research', from_state: 'created', to_state: 'active', detail: null, actor: 'human:ceo', created_at: '2026-09-01T00:01:00.000Z' }],
      progressLogs: [{ id: 2, task_id: 'task-1', kind: 'heartbeat', stage_id: 'research', subtask_id: null, content: 'working', artifacts: null, actor: 'agent:lead', created_at: '2026-09-01T00:02:00.000Z' }],
      now: new Date('2026-09-01T01:00:00.000Z'), stuckAfterMs: 15 * 60 * 1000,
    });
    expect(response.events.map(event => event.source)).toEqual(['task', 'flow_log', 'progress_log']);
    expect(response.stuck).toMatchObject({ is_stuck: true, last_activity_at: '2026-09-01T00:02:00.000Z' });
  });
});
