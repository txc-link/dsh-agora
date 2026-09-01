import { describe, expect, it } from 'vitest';
import { TickTickTaskAdapter } from './ticktick.js';

describe('TickTickTaskAdapter', () => {
  it('creates a task through the official Open API shape', async () => {
    let request: { url: string; init?: RequestInit } | undefined;
    const adapter = new TickTickTaskAdapter({
      accessToken: async () => 'tick-secret',
      fetchImpl: async (input, init) => {
        request = { url: String(input), ...(init === undefined ? {} : { init }) };
        return Response.json({
          id: 'tt-1', projectId: 'project-1', title: 'Plan sprint', content: 'details',
          startDate: '2026-09-02T09:00:00+0800', dueDate: '2026-09-02T10:00:00+0800',
          timeZone: 'Asia/Shanghai', status: 0,
        });
      },
    });

    const task = await adapter.createTask({
      projectRef: 'project-1', title: 'Plan sprint', content: 'details',
      start: '2026-09-02T09:00:00+0800', due: '2026-09-02T10:00:00+0800', timeZone: 'Asia/Shanghai',
    });

    expect(request?.url).toBe('https://api.ticktick.com/open/v1/task');
    expect(request?.init?.headers).toMatchObject({ authorization: 'Bearer tick-secret' });
    expect(JSON.parse(String(request?.init?.body))).toEqual({
      projectId: 'project-1', title: 'Plan sprint', content: 'details',
      startDate: '2026-09-02T09:00:00+0800', dueDate: '2026-09-02T10:00:00+0800', timeZone: 'Asia/Shanghai',
    });
    expect(task).toMatchObject({ id: 'tt-1', projectRef: 'project-1', status: 'open' });
    expect(JSON.stringify(task)).not.toContain('tick-secret');
  });

  it('completes a task with project and task refs encoded in the path', async () => {
    let url = '';
    const adapter = new TickTickTaskAdapter({
      accessToken: 'token',
      fetchImpl: async (input) => { url = String(input); return new Response(null, { status: 200 }); },
    });

    await adapter.completeTask({ projectRef: 'project/a', taskRef: 'task b' });
    expect(url).toBe('https://api.ticktick.com/open/v1/project/project%2Fa/task/task%20b/complete');
  });
});
