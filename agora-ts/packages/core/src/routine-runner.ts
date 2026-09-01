import type { RoutineDto, RoutineRunDto } from '@agora-ts/contracts';

export interface RoutineRuntimeTarget {
  node_id: string;
  runtime_target_ref: string;
}

export interface RoutineRuntimeDispatchSnapshot {
  id: string;
  status: 'pending' | 'claimed' | 'completed' | 'failed' | 'cancelled';
  result?: Record<string, unknown> | null;
  result_envelope?: Record<string, unknown> | null;
  error?: string | null;
}

export interface RoutineRuntimePort {
  resolveTarget(agentRef: string): RoutineRuntimeTarget | null;
  createDispatch(input: {
    node_id: string;
    runtime_target_ref: string;
    prompt: string;
    idempotency_key: string;
    metadata: Record<string, unknown>;
  }): { id: string };
  getDispatch(dispatchId: string): RoutineRuntimeDispatchSnapshot | null;
}

export interface RoutineArtifactPort {
  createMarkdown(input: {
    name: string;
    content: string;
    ownerRef: string;
    metadata: Record<string, unknown>;
  }): { id: string };
}

export interface RoutineDeliveryPort {
  deliver(input: {
    bindingRef: string;
    text: string;
    routine: RoutineDto;
    run: RoutineRunDto;
    artifactId?: string;
  }): Promise<void>;
}

export interface RoutineRunnerServicePort {
  claimDue(input: { consumer_ref: string; limit?: number; lease_ms?: number }): RoutineRunDto[];
  get(routineId: string): RoutineDto;
  attachDispatch(id: string, leaseToken: string, dispatchId: string): RoutineRunDto;
  markSucceeded(id: string, leaseToken: string, result?: Record<string, unknown> | null): RoutineRunDto;
  markFailed(id: string, leaseToken: string, error: string): RoutineRunDto;
  updateArtifact(id: string, artifactId: string): RoutineRunDto;
  updateDelivery(id: string, status: 'pending' | 'delivered' | 'failed' | 'skipped', error?: string | null): RoutineRunDto;
}

export interface RoutineRunnerOptions {
  routineService: RoutineRunnerServicePort;
  repository: { listRuns(filters?: { status?: RoutineRunDto['status']; delivery_status?: RoutineRunDto['delivery_status'] }): RoutineRunDto[] };
  runtime: RoutineRuntimePort;
  artifacts?: RoutineArtifactPort;
  delivery?: RoutineDeliveryPort;
  consumerRef: string;
  limit?: number;
  leaseMs?: number;
  now?: () => Date;
}

export interface RoutineRunnerResult {
  claimed: number;
  dispatched: number;
  waiting: number;
  completed: number;
  failed: number;
  delivered: number;
  delivery_failed: number;
  delivery_skipped: number;
}

/**
 * Durable routine worker. Core owns lifecycle and idempotency; runtime,
 * artifact, and delivery implementations remain adapters supplied by the app.
 */
export class RoutineRunner {
  private readonly now: () => Date;

  constructor(private readonly options: RoutineRunnerOptions) {
    this.now = options.now ?? (() => new Date());
  }

  async runOnce(): Promise<RoutineRunnerResult> {
    const result: RoutineRunnerResult = {
      claimed: 0, dispatched: 0, waiting: 0, completed: 0, failed: 0,
      delivered: 0, delivery_failed: 0, delivery_skipped: 0,
    };

    await this.retryFailedDeliveries(result);
    await this.reconcileClaimedRuns(result);

    const claimInput: { consumer_ref: string; limit?: number; lease_ms?: number } = { consumer_ref: this.options.consumerRef };
    if (this.options.limit !== undefined) claimInput.limit = this.options.limit;
    if (this.options.leaseMs !== undefined) claimInput.lease_ms = this.options.leaseMs;
    const claimed = this.options.routineService.claimDue(claimInput);
    result.claimed = claimed.length;
    for (const run of claimed) {
      await this.dispatchClaim(run, result);
    }
    return result;
  }

  private async retryFailedDeliveries(result: RoutineRunnerResult): Promise<void> {
    if (!this.options.delivery) return;
    const runs = this.options.repository.listRuns({ status: 'succeeded', delivery_status: 'failed' });
    for (const run of runs) {
      const routine = this.options.routineService.get(run.routine_id);
      const text = resultText(run.result);
      if (!text) {
        this.options.routineService.updateDelivery(run.id, 'skipped', 'dispatch completed without textual output');
        result.delivery_skipped += 1;
        continue;
      }
      try {
        await this.options.delivery.deliver({ bindingRef: routine.delivery_binding_ref, text, routine, run, ...(run.artifact_id ? { artifactId: run.artifact_id } : {}) });
        this.options.routineService.updateDelivery(run.id, 'delivered', null);
        result.delivered += 1;
      } catch (error) {
        this.options.routineService.updateDelivery(run.id, 'failed', errorMessage(error));
        result.delivery_failed += 1;
      }
    }
  }

  private async reconcileClaimedRuns(result: RoutineRunnerResult): Promise<void> {
    const runs = this.options.repository.listRuns({ status: 'claimed' });
    for (const run of runs) {
      if (!run.lease_token) continue;
      if (!run.runtime_dispatch_id) {
        result.waiting += 1;
        continue;
      }
      const dispatch = this.options.runtime.getDispatch(run.runtime_dispatch_id);
      if (!dispatch || dispatch.status === 'pending' || dispatch.status === 'claimed') {
        result.waiting += 1;
        continue;
      }
      if (dispatch.status !== 'completed') {
        this.options.routineService.markFailed(run.id, run.lease_token, dispatch.error ?? `runtime dispatch ${dispatch.status}`);
        result.failed += 1;
        continue;
      }
      const text = resultText(dispatch.result_envelope ?? dispatch.result);
      const completed = this.options.routineService.markSucceeded(run.id, run.lease_token, dispatch.result_envelope ?? dispatch.result ?? null);
      result.completed += 1;
      let artifactId: string | undefined;
      if (this.options.artifacts && text) {
        const routine = this.options.routineService.get(run.routine_id);
        artifactId = this.options.artifacts.createMarkdown({
          name: `${routine.name}-${run.scheduled_for.slice(0, 10)}.md`, content: text, ownerRef: run.id,
          metadata: { routine_id: routine.routine_id, routine_run_id: run.id, target_domain: routine.target_domain },
        }).id;
        this.options.routineService.updateArtifact(run.id, artifactId);
      }
      const routine = this.options.routineService.get(run.routine_id);
      if (!this.options.delivery) {
        this.options.routineService.updateDelivery(run.id, 'skipped', null);
        result.delivery_skipped += 1;
      } else if (!text) {
        this.options.routineService.updateDelivery(run.id, 'skipped', 'dispatch completed without textual output');
        result.delivery_skipped += 1;
      } else {
        try {
          await this.options.delivery.deliver({ bindingRef: routine.delivery_binding_ref, text, routine, run: completed, ...(artifactId ? { artifactId } : {}) });
          this.options.routineService.updateDelivery(run.id, 'delivered', null);
          result.delivered += 1;
        } catch (error) {
          this.options.routineService.updateDelivery(run.id, 'failed', errorMessage(error));
          result.delivery_failed += 1;
        }
      }
    }
  }

  private async dispatchClaim(run: RoutineRunDto, result: RoutineRunnerResult): Promise<void> {
    if (!run.lease_token) return;
    let routine: RoutineDto;
    try { routine = this.options.routineService.get(run.routine_id); } catch (error) {
      this.options.routineService.markFailed(run.id, run.lease_token, errorMessage(error)); result.failed += 1; return;
    }
    const target = this.options.runtime.resolveTarget(routine.agent_ref);
    if (!target) {
      this.options.routineService.markFailed(run.id, run.lease_token, `runtime target unavailable: ${routine.agent_ref}`);
      result.failed += 1;
      return;
    }
    try {
      const dispatch = this.options.runtime.createDispatch({
        node_id: target.node_id, runtime_target_ref: target.runtime_target_ref,
        prompt: renderPrompt(routine, run), idempotency_key: `routine:${routine.routine_id}:${run.scheduled_for}`,
        metadata: {
          source: 'routine', routine_id: routine.routine_id, routine_run_id: run.id,
          role_ref: routine.role_ref, target_domain: routine.target_domain, delivery_binding_ref: routine.delivery_binding_ref,
        },
      });
      this.options.routineService.attachDispatch(run.id, run.lease_token, dispatch.id);
      result.dispatched += 1;
    } catch (error) {
      this.options.routineService.markFailed(run.id, run.lease_token, errorMessage(error));
      result.failed += 1;
    }
  }
}

function resultText(value: Record<string, unknown> | null | undefined): string {
  if (!value) return '';
  const candidates = [value.answer, value.output, value.text, value.content];
  return candidates.find((candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length > 0)?.trim() ?? '';
}

function renderPrompt(routine: RoutineDto, run: RoutineRunDto): string {
  return [
    `你是角色 ${routine.role_ref}，负责例行任务“${routine.name}”。`,
    `目标域：${routine.target_domain}。计划执行时间：${run.scheduled_for}。`,
    routine.prompt,
    '请输出可审计的简洁结果；若无法完成，明确说明阻塞原因和下一步。',
  ].join('\n');
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
