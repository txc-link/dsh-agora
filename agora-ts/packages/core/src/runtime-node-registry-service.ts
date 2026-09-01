import type {
  CompleteRuntimeNodeDispatchRequestDto,
  CompleteRuntimeNodeDeliveryRequestDto,
  CreateRuntimeNodeDispatchRequestDto,
  RuntimeNodeDispatchDto,
  RuntimeNodeDeliveryDto,
  RuntimeNodeDto,
  RuntimeNodeHeartbeatRequestDto,
  RenewRuntimeNodeDispatchRequestDto,
  RecordRuntimeNodeDispatchProgressRequestDto,
  RuntimeNodeDispatchProgressDto,
} from '@agora-ts/contracts';
import {
  runtimeActionAuditContextSchema,
  type RuntimeActionAuditContextDto,
} from '@agora-ts/contracts';
import { ConflictError, NotFoundError } from './errors.js';
import type { ActionAuditService } from './action-audit-service.js';
import type {
  AgentInventorySource,
  AgentPresenceSnapshot,
  PresenceSource,
  RegisteredAgent,
} from './runtime-ports.js';

export interface RuntimeNodeRepositoryPort {
  upsertNode(nodeId: string, input: RuntimeNodeHeartbeatRequestDto, now?: Date): RuntimeNodeDto;
  getNode(nodeId: string, now?: Date): RuntimeNodeDto | null;
  listNodes(now?: Date): RuntimeNodeDto[];
  deleteNode(nodeId: string): boolean;
  createDispatch(nodeId: string, input: CreateRuntimeNodeDispatchRequestDto, now?: Date): RuntimeNodeDispatchDto;
  getDispatch(dispatchId: string): RuntimeNodeDispatchDto | null;
  listDispatches(nodeId: string, limit?: number): RuntimeNodeDispatchDto[];
  listDispatchesByTask(taskId: string, limit?: number): RuntimeNodeDispatchDto[];
  cancelDispatch(dispatchId: string, reason: string, now?: Date): RuntimeNodeDispatchDto | null;
  claimDispatch(nodeId: string, instanceId: string, leaseSeconds: number, now?: Date): RuntimeNodeDispatchDto | null;
  renewDispatch(nodeId: string, dispatchId: string, input: RenewRuntimeNodeDispatchRequestDto, now?: Date): RuntimeNodeDispatchDto | null;
  recordDispatchProgress(nodeId: string, dispatchId: string, input: RecordRuntimeNodeDispatchProgressRequestDto, now?: Date): RuntimeNodeDispatchProgressDto | null;
  listDispatchProgress(dispatchId: string, limit?: number): RuntimeNodeDispatchProgressDto[];
  completeDispatch(nodeId: string, dispatchId: string, input: CompleteRuntimeNodeDispatchRequestDto, now?: Date): RuntimeNodeDispatchDto | null;
  claimDelivery(nodeId: string, instanceId: string, leaseSeconds: number, now?: Date): RuntimeNodeDeliveryDto | null;
  completeDelivery(nodeId: string, deliveryId: string, input: CompleteRuntimeNodeDeliveryRequestDto, now?: Date): RuntimeNodeDeliveryDto | null;
}

export interface RuntimeNodeRegistryServiceOptions {
  actionAuditService?: ActionAuditService;
  requireGovernanceForTask?: (taskId: string) => boolean;
}

export class RuntimeNodeRegistryService implements AgentInventorySource, PresenceSource {
  private readonly actionAuditService: ActionAuditService | undefined;
  private readonly requireGovernanceForTask: ((taskId: string) => boolean) | undefined;

  constructor(
    private readonly repository: RuntimeNodeRepositoryPort,
    options: RuntimeNodeRegistryServiceOptions = {},
  ) {
    this.actionAuditService = options.actionAuditService;
    this.requireGovernanceForTask = options.requireGovernanceForTask;
  }

  heartbeat(nodeId: string, input: RuntimeNodeHeartbeatRequestDto): RuntimeNodeDto {
    const current = this.repository.getNode(nodeId);
    if (current?.presence === 'online' && current.instance_id !== input.instance_id) {
      throw new ConflictError(`Runtime node ${nodeId} is owned by another live instance`);
    }
    return this.repository.upsertNode(nodeId, input);
  }

  getNode(nodeId: string): RuntimeNodeDto {
    const node = this.repository.getNode(nodeId);
    if (!node) throw new NotFoundError(`Runtime node ${nodeId} not found`);
    return node;
  }

  listNodes(): RuntimeNodeDto[] {
    return this.repository.listNodes();
  }

  removeNode(nodeId: string): boolean {
    return this.repository.deleteNode(nodeId);
  }

  createDispatch(nodeId: string, input: CreateRuntimeNodeDispatchRequestDto): RuntimeNodeDispatchDto {
    this.getNode(nodeId);
    const expectedPrefix = `dsh:${nodeId}:`;
    if (!input.runtime_target_ref.startsWith(expectedPrefix)) {
      throw new TypeError(`runtime_target_ref must start with ${expectedPrefix}`);
    }
    const audit = this.readAuditContext(input.metadata);
    if (!audit) {
      if (input.task_id && this.requireGovernanceForTask?.(input.task_id)) {
        throw new ConflictError('task requires a governed dispatch envelope');
      }
      return this.repository.createDispatch(nodeId, input);
    }
    if (!input.task_id) throw new ConflictError('audited runtime dispatch requires task_id');
    if (!this.actionAuditService) throw new ConflictError('action audit service is not configured');
    const attempt = this.actionAuditService.admit({
      task_id: input.task_id,
      collaboration_plan_id: audit.collaboration_plan_id ?? null,
      execution_baseline_id: audit.execution_baseline_id ?? null,
      delegation_authority_id: audit.delegation_authority_id,
      subtask_spec_id: audit.subtask_spec_id ?? null,
      actor_ref: audit.actor_ref,
      action: audit.action,
      subject_ref: audit.subject_ref,
      idempotency_key: audit.idempotency_key,
    });
    if (attempt.decision === 'deny') {
      throw new ConflictError(`ActionAttempt ${attempt.id} denied: ${attempt.decision_reason}`);
    }
    const auditedMetadata = {
      ...(input.metadata ?? {}),
      action_audit: { ...audit, attempt_id: attempt.id },
    };
    try {
      return this.repository.createDispatch(nodeId, { ...input, metadata: auditedMetadata });
    } catch (error) {
      this.recordAuditReceipt(attempt.id, {
        outcome: 'failed',
        provider_ref: `runtime-dispatch:create:${input.idempotency_key}`,
        evidence_refs: [],
        error_code: 'RUNTIME_DISPATCH_CREATE_FAILED',
        summary: error instanceof Error ? error.message : String(error),
        created_by: `runtime-node:${nodeId}`,
        idempotency_key: `runtime-dispatch:create:${input.idempotency_key}`,
      });
      throw error;
    }
  }

  getDispatch(dispatchId: string): RuntimeNodeDispatchDto {
    const dispatch = this.repository.getDispatch(dispatchId);
    if (!dispatch) throw new NotFoundError(`Runtime dispatch ${dispatchId} not found`);
    return dispatch;
  }

  listDispatches(nodeId: string, limit?: number): RuntimeNodeDispatchDto[] {
    this.getNode(nodeId);
    return this.repository.listDispatches(nodeId, limit);
  }

  listDispatchesByTask(taskId: string, limit?: number): RuntimeNodeDispatchDto[] {
    return this.repository.listDispatchesByTask(taskId, limit);
  }

  cancelDispatch(dispatchId: string, reason: string): RuntimeNodeDispatchDto {
    const previous = this.repository.getDispatch(dispatchId);
    const dispatch = this.repository.cancelDispatch(dispatchId, reason);
    if (!dispatch) throw new NotFoundError(`Runtime dispatch ${dispatchId} not found`);
    if (previous?.status !== 'cancelled' && dispatch.status === 'cancelled') {
      this.recordDispatchReceipt(dispatch, {
        outcome: 'failed',
        error_code: 'RUNTIME_DISPATCH_CANCELLED',
        summary: reason,
      });
    }
    return dispatch;
  }

  claimDispatch(nodeId: string, instanceId: string, leaseSeconds: number): RuntimeNodeDispatchDto | null {
    this.assertOwner(nodeId, instanceId);
    return this.repository.claimDispatch(nodeId, instanceId, leaseSeconds);
  }

  renewDispatch(
    nodeId: string,
    dispatchId: string,
    input: RenewRuntimeNodeDispatchRequestDto,
  ): RuntimeNodeDispatchDto {
    this.assertOwner(nodeId, input.instance_id);
    const dispatch = this.repository.renewDispatch(nodeId, dispatchId, input);
    if (!dispatch) throw new ConflictError(`Runtime dispatch ${dispatchId} lease is expired or fenced`);
    return dispatch;
  }

  recordDispatchProgress(
    nodeId: string,
    dispatchId: string,
    input: RecordRuntimeNodeDispatchProgressRequestDto,
  ): RuntimeNodeDispatchProgressDto {
    this.assertOwner(nodeId, input.instance_id);
    const event = this.repository.recordDispatchProgress(nodeId, dispatchId, input);
    if (!event) throw new ConflictError(`Runtime dispatch ${dispatchId} lease is expired or fenced`);
    return event;
  }

  listDispatchProgress(dispatchId: string, limit?: number): RuntimeNodeDispatchProgressDto[] {
    this.getDispatch(dispatchId);
    return this.repository.listDispatchProgress(dispatchId, limit);
  }

  completeDispatch(nodeId: string, dispatchId: string, input: CompleteRuntimeNodeDispatchRequestDto): RuntimeNodeDispatchDto {
    this.assertOwner(nodeId, input.instance_id);
    const dispatch = this.repository.completeDispatch(nodeId, dispatchId, input);
    if (!dispatch) throw new ConflictError(`Runtime dispatch ${dispatchId} lease is expired or fenced`);
    if (dispatch.status === 'completed' || dispatch.status === 'failed') {
      this.recordDispatchReceipt(dispatch, {
        outcome: dispatch.status === 'completed' ? 'succeeded' : 'failed',
        error_code: dispatch.status === 'failed' ? 'RUNTIME_DISPATCH_FAILED' : null,
        summary: dispatch.error ?? `Runtime dispatch ${dispatch.status}`,
      });
    }
    return dispatch;
  }

  private readAuditContext(metadata: Record<string, unknown> | null | undefined): RuntimeActionAuditContextDto | null {
    if (!metadata || !Object.prototype.hasOwnProperty.call(metadata, 'action_audit')) return null;
    return runtimeActionAuditContextSchema.parse(metadata.action_audit);
  }

  private recordDispatchReceipt(
    dispatch: RuntimeNodeDispatchDto,
    result: {
      outcome: 'succeeded' | 'failed';
      error_code: string | null;
      summary: string;
    },
  ): void {
    const audit = this.readAuditContext(dispatch.metadata);
    if (!audit?.attempt_id || !this.actionAuditService) return;
    const evidenceRefs = [`runtime-dispatch:${dispatch.id}`];
    for (const evidence of dispatch.result_envelope?.evidence ?? []) {
      evidenceRefs.push(
        evidence.uri
        ?? evidence.revision
        ?? evidence.content_hash
        ?? `runtime-evidence:${dispatch.id}:${evidence.id}`,
      );
    }
    if (!dispatch.task_id) return;
    this.recordAuditReceipt(audit.attempt_id, {
      ...result,
      provider_ref: `runtime-dispatch:${dispatch.id}`,
      evidence_refs: [...new Set(evidenceRefs)],
      created_by: `runtime-node:${dispatch.node_id}`,
      idempotency_key: `runtime-dispatch:${dispatch.id}:${result.outcome}`,
    });
  }

  private recordAuditReceipt(
    attemptId: string,
    input: {
      outcome: 'succeeded' | 'failed';
      provider_ref: string;
      evidence_refs: string[];
      error_code: string | null;
      summary: string;
      created_by: string;
      idempotency_key: string;
    },
  ): void {
    if (!this.actionAuditService) return;
    this.actionAuditService.recordReceipt({ attempt_id: attemptId, ...input });
  }

  claimDelivery(nodeId: string, instanceId: string, leaseSeconds: number): RuntimeNodeDeliveryDto | null {
    this.assertOwner(nodeId, instanceId);
    return this.repository.claimDelivery(nodeId, instanceId, leaseSeconds);
  }

  completeDelivery(
    nodeId: string,
    deliveryId: string,
    input: CompleteRuntimeNodeDeliveryRequestDto,
  ): RuntimeNodeDeliveryDto {
    this.assertOwner(nodeId, input.instance_id);
    const delivery = this.repository.completeDelivery(nodeId, deliveryId, input);
    if (!delivery) throw new ConflictError(`Runtime delivery ${deliveryId} lease is expired or fenced`);
    return delivery;
  }

  private assertOwner(nodeId: string, instanceId: string): void {
    const node = this.getNode(nodeId);
    if (node.instance_id !== instanceId) {
      throw new ConflictError('instance_id does not own the current runtime node lease');
    }
  }

  listAgents(): RegisteredAgent[] {
    return this.repository.listNodes().flatMap((node) => node.agents.map((agent) => {
      const bots = node.bots.filter((bot) => bot.agent_ref === null
        || bot.agent_ref === undefined
        || bot.agent_ref === agent.agent_ref);
      const runtimeTargetRef = runtimeTargetRefFor(node.node_id, agent.agent_ref);
      return {
        id: runtimeTargetRef,
        inventory_kind: 'runtime_target' as const,
        host_framework: 'deepseek-harness',
        runtime_provider: 'dsh',
        runtime_flavor: agent.preset ?? null,
        runtime_target_ref: runtimeTargetRef,
        channel_providers: unique(bots.map((bot) => bot.provider)),
        inventory_sources: ['dsh-node'],
        primary_model: agent.model ?? null,
        workspace_dir: null,
        discord_bot_user_ids: unique(
          bots.filter((bot) => bot.provider === 'discord')
            .map((bot) => bot.platform_id ?? bot.bot_ref),
        ),
        agent_origin: 'user_managed' as const,
      };
    }));
  }

  listPresence(): AgentPresenceSnapshot[] {
    return this.repository.listNodes().flatMap((node) => node.agents.map((agent) => ({
      agent_id: runtimeTargetRefFor(node.node_id, agent.agent_ref),
      presence: node.presence,
      provider: 'dsh',
      account_id: node.node_id,
      last_seen_at: node.last_seen_at,
      reason: node.presence === 'online' ? 'runtime_node_heartbeat' : 'runtime_node_lease_expired',
    })));
  }
}

export function runtimeTargetRefFor(nodeId: string, agentRef: string): string {
  return `dsh:${nodeId}:${agentRef}`;
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}
