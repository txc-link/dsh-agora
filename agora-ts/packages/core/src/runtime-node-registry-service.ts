import type {
  CompleteRuntimeNodeDispatchRequestDto,
  CompleteRuntimeNodeDeliveryRequestDto,
  CreateRuntimeNodeDispatchRequestDto,
  RuntimeNodeDispatchDto,
  RuntimeNodeDeliveryDto,
  RuntimeNodeDto,
  RuntimeNodeHeartbeatRequestDto,
  RenewRuntimeNodeDispatchRequestDto,
} from '@agora-ts/contracts';
import { ConflictError, NotFoundError } from './errors.js';
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
  claimDispatch(nodeId: string, instanceId: string, leaseSeconds: number, now?: Date): RuntimeNodeDispatchDto | null;
  renewDispatch(nodeId: string, dispatchId: string, input: RenewRuntimeNodeDispatchRequestDto, now?: Date): RuntimeNodeDispatchDto | null;
  completeDispatch(nodeId: string, dispatchId: string, input: CompleteRuntimeNodeDispatchRequestDto, now?: Date): RuntimeNodeDispatchDto | null;
  claimDelivery(nodeId: string, instanceId: string, leaseSeconds: number, now?: Date): RuntimeNodeDeliveryDto | null;
  completeDelivery(nodeId: string, deliveryId: string, input: CompleteRuntimeNodeDeliveryRequestDto, now?: Date): RuntimeNodeDeliveryDto | null;
}

export class RuntimeNodeRegistryService implements AgentInventorySource, PresenceSource {
  constructor(private readonly repository: RuntimeNodeRepositoryPort) {}

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
    return this.repository.createDispatch(nodeId, input);
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

  completeDispatch(nodeId: string, dispatchId: string, input: CompleteRuntimeNodeDispatchRequestDto): RuntimeNodeDispatchDto {
    this.assertOwner(nodeId, input.instance_id);
    const dispatch = this.repository.completeDispatch(nodeId, dispatchId, input);
    if (!dispatch) throw new ConflictError(`Runtime dispatch ${dispatchId} lease is expired or fenced`);
    return dispatch;
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
