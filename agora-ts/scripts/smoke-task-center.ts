/**
 * Smoke harness for the task-center surfaces (2026-08-31 next-batch).
 *
 * Boots an isolated SQLite DB, creates a real TaskService via
 * createTaskServiceFromDb, builds a pending approval_request directly
 * (mimicking the gate flow), then drives:
 *
 *   - taskService.getTaskProgress(taskId)  → aggregate over seeded subtasks
 *   - taskService.listPendingApprovals()   → finds the seeded approval
 *   - taskService.decideApproval(id, ...) → resolves the row + gates the task
 *
 * Self-contained — no homeserver, no Discord, no live deployment.
 *
 * Run: `npx tsx scripts/smoke-task-center.ts`
 * Exit: 0 on success, 1 on any mismatch.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ApprovalRequestRepository,
  TaskRepository,
  createAgoraDatabase,
  runMigrations,
} from '@agora-ts/db';
import { createTaskServiceFromDb } from '@agora-ts/testing';

interface SmokeResult {
  task_id: string;
  initial_state: string | null;
  progress_total: number;
  progress_percent: number;
  pending_seeded: number;
  pending_listed: number;
  decide_rejected_with: string | null;
}

async function main(): Promise<SmokeResult> {
  const dir = mkdtempSync(join(tmpdir(), 'agora-ts-smoke-task-center-'));
  try {
    const dbPath = join(dir, 'tasks.db');
    const db = createAgoraDatabase({ dbPath });
    runMigrations(db);

    const tasks = new TaskRepository(db);
    tasks.insertTask({
      id: 'OC-SMOKE-TC-1',
      title: 'smoke task center',
      description: '',
      type: 'document',
      priority: 'normal',
      creator: 'archon',
      team: { members: [] },
      workflow: { stages: [] },
    });

    const service = createTaskServiceFromDb(db);
    const initialTask = service.getTask('OC-SMOKE-TC-1');
    const progress = service.getTaskProgress('OC-SMOKE-TC-1');
    if (progress.subtasks_total !== 0) {
      throw new Error(`expected 0 subtasks initially, got ${progress.subtasks_total}`);
    }

    // Seed a pending approval row directly via the repo.
    const approvals = new ApprovalRequestRepository(db);
    approvals.insert({
      id: 'approval-smoke-1',
      task_id: 'OC-SMOKE-TC-1',
      stage_id: 'review',
      gate_type: 'approval',
      requested_by: 'archon',
      request_comment: 'smoke harness',
    });
    const pendingSeeded = approvals.listPending().length;
    const pendingListed = service.listPendingApprovals().length;

    // The task is in 'draft' state — decideApproval must reject with a clear
    // state-guard error (TaskApprovalService.approveTask → assertTaskActive).
    // This proves the wiring + the A4/active-task invariant end-to-end.
    let decideRejected: string | null = null;
    try {
      service.decideApproval('approval-smoke-1', {
        reviewerId: 'dashboard-smoke',
        decision: 'approve',
        comment: 'lgtm',
      });
    } catch (cause) {
      decideRejected = cause instanceof Error ? cause.message : String(cause);
    }

    return {
      task_id: 'OC-SMOKE-TC-1',
      initial_state: initialTask?.state ?? null,
      progress_total: progress.subtasks_total,
      progress_percent: progress.percent,
      pending_seeded: pendingSeeded,
      pending_listed: pendingListed,
      decide_rejected_with: decideRejected,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

main()
  .then((result) => {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ ok: true, ...result }, null, 2));
    if (result.pending_seeded !== 1) throw new Error(`expected 1 pending seeded, got ${result.pending_seeded}`);
    if (result.pending_listed !== 1) throw new Error(`expected 1 pending listed, got ${result.pending_listed}`);
    if (result.progress_total !== 0 || result.progress_percent !== 0) {
      throw new Error(`expected empty progress, got total=${result.progress_total} percent=${result.progress_percent}`);
    }
    if (!result.decide_rejected_with || !/state|active/i.test(result.decide_rejected_with)) {
      throw new Error(`expected decide to reject with state-guard error, got: ${result.decide_rejected_with}`);
    }
  })
  .catch((cause: unknown) => {
    // eslint-disable-next-line no-console
    console.error('smoke-task-center failed:', cause instanceof Error ? cause.message : cause);
    process.exit(1);
  });