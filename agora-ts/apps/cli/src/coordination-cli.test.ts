import { describe, expect, it, vi } from 'vitest';
import { createCliProgram } from './index.js';

describe('coordination CLI', () => {
  it('creates a validated budgeted run through the agent-first CLI', async () => {
    const output: string[] = [];
    const createRun = vi.fn(input => ({ ...input, id: 'run-1', status: 'running', members: [] }));
    const program = createCliProgram({
      coordinationService: {
        createRun,
        getRun: vi.fn(), listRuns: vi.fn(() => []), reconcileRun: vi.fn(), cancelRun: vi.fn(), listScorecards: vi.fn(() => []),
      },
      stdout: { write: chunk => { output.push(chunk); } },
      stderr: { write: () => {} },
    }).exitOverride();

    await program.parseAsync([
      'coordination', 'create', '--mode', 'council', '--agent', 'dsh:web-1:alpha', '--agent', 'dsh:web-2:beta',
      '--max-agents', '2', '--max-dispatches', '3', '--max-seconds', '600', '--idempotency-key', 'cli-test-1',
      'Inspect', 'the', 'repository',
    ], { from: 'user' });

    expect(createRun).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'council', prompt: 'Inspect the repository', idempotency_key: 'cli-test-1',
      candidates: [{ runtime_target_ref: 'dsh:web-1:alpha', capabilities: [], priority: 0 }, { runtime_target_ref: 'dsh:web-2:beta', capabilities: [], priority: 0 }],
      budget: expect.objectContaining({ max_agents: 2, max_dispatches: 3, max_wall_clock_seconds: 600 }),
    }));
    expect(output.join('')).toContain('run-1');
  });
});
