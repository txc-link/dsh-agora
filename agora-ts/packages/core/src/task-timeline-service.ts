import {
  taskTimelineEventSchema,
  taskTimelineResponseSchema,
  type ActionAttemptRecord,
  type ActionReceiptRecord,
  type ArtifactDto,
  type FlowLogRecord,
  type ProgressLogRecord,
  type RuntimeNodeDispatchDto,
  type TaskRecord,
  type TaskTimelineResponseDto,
} from '@agora-ts/contracts';

export interface TaskTimelineInput {
  task: TaskRecord;
  flowLogs?: FlowLogRecord[];
  progressLogs?: ProgressLogRecord[];
  actionAttempts?: ActionAttemptRecord[];
  actionReceipts?: ActionReceiptRecord[];
  dispatches?: RuntimeNodeDispatchDto[];
  artifacts?: ArtifactDto[];
  now?: Date;
  stuckAfterMs?: number;
}

/** Builds one provider-neutral, audit-safe view of task activity and liveness. */
export class TaskTimelineService {
  constructor(private readonly defaultStuckAfterMs = 15 * 60 * 1_000) {}

  build(input: TaskTimelineInput): TaskTimelineResponseDto {
    const now = input.now ?? new Date();
    const events = [
      ...this.taskEvent(input.task),
      ...(input.flowLogs ?? []).map(log => taskTimelineEventSchema.parse({
        id: `flow_log:${log.id}`, source: 'flow_log', event: log.event, task_id: log.task_id,
        stage_id: log.stage_id, actor: log.actor, summary: log.detail ?? log.event,
        detail: { kind: log.kind, from_state: log.from_state, to_state: log.to_state }, created_at: log.created_at,
      })),
      ...(input.progressLogs ?? []).map(log => taskTimelineEventSchema.parse({
        id: `progress_log:${log.id}`, source: 'progress_log', event: log.kind, task_id: log.task_id,
        stage_id: log.stage_id, actor: log.actor, summary: log.content,
        detail: { subtask_id: log.subtask_id, artifacts: log.artifacts }, created_at: log.created_at,
      })),
      ...(input.actionAttempts ?? []).map(attempt => taskTimelineEventSchema.parse({
        id: `action_attempt:${attempt.id}`, source: 'action_attempt', event: attempt.decision,
        task_id: attempt.task_id, stage_id: null, actor: attempt.actor_ref,
        summary: `${attempt.action}: ${attempt.decision_reason}`,
        detail: { subject_ref: attempt.subject_ref, collaboration_plan_id: attempt.collaboration_plan_id, attempt_id: attempt.id },
        created_at: attempt.created_at,
      })),
      ...(input.actionReceipts ?? []).map(receipt => taskTimelineEventSchema.parse({
        id: `action_receipt:${receipt.id}`, source: 'action_receipt', event: receipt.outcome,
        task_id: receipt.task_id, stage_id: null, actor: receipt.created_by,
        summary: receipt.summary ?? receipt.outcome,
        detail: { provider_ref: receipt.provider_ref, error_code: receipt.error_code, evidence_refs: receipt.evidence_refs },
        created_at: receipt.created_at,
      })),
      ...(input.dispatches ?? []).map(dispatch => taskTimelineEventSchema.parse({
        id: `runtime_dispatch:${dispatch.id}`, source: 'runtime_dispatch', event: dispatch.status,
        task_id: dispatch.task_id!, stage_id: null, actor: dispatch.claimed_by,
        summary: `${dispatch.runtime_target_ref} ${dispatch.status}`,
        detail: { dispatch_id: dispatch.id, node_id: dispatch.node_id, attempt: dispatch.attempt, progress: dispatch.latest_progress?.phase ?? null },
        created_at: dispatch.updated_at ?? dispatch.created_at,
      })),
      ...(input.artifacts ?? []).map(artifact => taskTimelineEventSchema.parse({
        id: `artifact:${artifact.id}`, source: 'artifact', event: 'artifact_created', task_id: artifact.owner_ref,
        stage_id: null, actor: null, summary: artifact.name,
        detail: { artifact_id: artifact.id, kind: artifact.kind, media_type: artifact.media_type, sha256: artifact.sha256, metadata: artifact.metadata },
        created_at: artifact.created_at,
      })),
    ].sort((left, right) => Date.parse(left.created_at) - Date.parse(right.created_at) || left.id.localeCompare(right.id));
    const lastActivityAt = events.reduce<string | null>((latest, event) => !latest || Date.parse(event.created_at) > Date.parse(latest) ? event.created_at : latest, input.task.updated_at);
    const thresholdMs = input.stuckAfterMs ?? this.defaultStuckAfterMs;
    const idleMs = lastActivityAt ? Math.max(0, now.getTime() - Date.parse(lastActivityAt)) : 0;
    return taskTimelineResponseSchema.parse({
      task_id: input.task.id,
      generated_at: now.toISOString(),
      events,
      stuck: {
        is_stuck: ['active', 'blocked'].includes(input.task.state) && idleMs >= thresholdMs,
        idle_ms: idleMs,
        last_activity_at: lastActivityAt,
        threshold_ms: thresholdMs,
      },
    });
  }

  private taskEvent(task: TaskRecord) {
    return [taskTimelineEventSchema.parse({
      id: `task:${task.id}:updated`, source: 'task', event: `state:${task.state}`, task_id: task.id,
      stage_id: task.current_stage, actor: task.creator, summary: `task ${task.state}`,
      detail: { version: task.version, title: task.title }, created_at: task.updated_at,
    })];
  }
}
