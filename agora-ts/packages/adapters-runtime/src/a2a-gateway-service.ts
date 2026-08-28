import {
  a2aAgentCardSchema,
  a2aTaskSchema,
  type A2aAgentCardDto,
  type A2aSendMessageRequestDto,
  type A2aTaskDto,
  type RuntimeNodeDispatchDto,
} from '@agora-ts/contracts';
import type { RuntimeNodeRegistryService } from '@agora-ts/core';

export interface A2aGatewayServiceOptions {
  runtimeNodes: Pick<RuntimeNodeRegistryService, 'listNodes' | 'createDispatch' | 'getDispatch' | 'cancelDispatch'>;
  publicBaseUrl: string;
  version?: string;
}

export class A2aGatewayService {
  constructor(private readonly options: A2aGatewayServiceOptions) {}

  agentCard(): A2aAgentCardDto {
    const baseUrl = this.options.publicBaseUrl.replace(/\/+$/u, '');
    const skills = this.options.runtimeNodes.listNodes().flatMap(node => node.presence === 'online'
      ? node.agents.map(agent => ({
          id: `dsh:${node.node_id}:${agent.agent_ref}`,
          name: agent.display_name ?? agent.agent_ref,
          description: `Agora-governed runtime target on ${node.node_id}`,
          tags: [...new Set([...agent.roles, ...agent.capabilities])].sort(),
        }))
      : []);
    return a2aAgentCardSchema.parse({
      name: 'Agora Runtime Federation',
      description: 'Governed asynchronous access to registered Agora runtime targets.',
      supportedInterfaces: [{ url: `${baseUrl}/a2a`, protocolBinding: 'HTTP+JSON', protocolVersion: '1.0' }],
      provider: { organization: 'Agora', url: baseUrl },
      version: this.options.version ?? '1.0.0',
      capabilities: { streaming: false, pushNotifications: false, extendedAgentCard: false },
      securitySchemes: { bearerAuth: { httpAuthSecurityScheme: { scheme: 'bearer' } } },
      securityRequirements: [{ bearerAuth: [] }],
      defaultInputModes: ['text/plain'],
      defaultOutputModes: ['text/plain', 'application/json'],
      skills,
    });
  }

  sendMessage(input: A2aSendMessageRequestDto): A2aTaskDto {
    if (input.configuration.blocking) throw new TypeError('A2A blocking mode is not supported; poll tasks/get');
    const runtimeTargetRef = metadataString(input.metadata, 'runtimeTargetRef')
      ?? metadataString(input.message.metadata, 'runtimeTargetRef')
      ?? this.onlyTarget();
    if (!runtimeTargetRef) throw new TypeError('metadata.runtimeTargetRef is required when more than one skill is available');
    if (!this.agentCard().skills.some(skill => skill.id === runtimeTargetRef)) {
      throw new TypeError(`A2A runtimeTargetRef ${runtimeTargetRef} is not an advertised online skill`);
    }
    const { nodeId } = parseDshTarget(runtimeTargetRef);
    const contextId = input.message.contextId ?? `context-${input.message.messageId}`;
    const dispatch = this.options.runtimeNodes.createDispatch(nodeId, {
      runtime_target_ref: runtimeTargetRef,
      prompt: input.message.parts.map(part => part.text).join('\n'),
      idempotency_key: `a2a:${input.message.messageId}`,
      metadata: {
        ...(input.metadata ?? {}),
        a2a_protocol_version: '1.0',
        a2a_context_id: contextId,
        a2a_message: input.message,
      },
    });
    return this.toTask(dispatch);
  }

  getTask(id: string): A2aTaskDto { return this.toTask(this.options.runtimeNodes.getDispatch(id)); }

  cancelTask(id: string): A2aTaskDto {
    return this.toTask(this.options.runtimeNodes.cancelDispatch(id, 'cancelled through A2A'));
  }

  private onlyTarget(): string | null {
    const targets = this.agentCard().skills.map(skill => skill.id);
    return targets.length === 1 ? targets[0]! : null;
  }

  private toTask(dispatch: RuntimeNodeDispatchDto): A2aTaskDto {
    const original = recordValue(dispatch.metadata, 'a2a_message');
    const contextId = metadataString(dispatch.metadata, 'a2a_context_id') ?? `context-${dispatch.id}`;
    const answer = dispatch.result_envelope?.answer ?? stringResult(dispatch.result, 'answer');
    const agentMessage = answer ? {
      messageId: `message-${dispatch.id}`,
      role: 'agent' as const,
      parts: [{ text: answer }],
      contextId,
      taskId: dispatch.id,
    } : null;
    return a2aTaskSchema.parse({
      id: dispatch.id,
      contextId,
      status: {
        state: taskState(dispatch.status),
        ...(agentMessage ? { message: agentMessage } : {}),
        timestamp: dispatch.updated_at,
      },
      history: original ? [original] : [],
      artifacts: dispatch.result_envelope ? [{
        artifactId: `result-${dispatch.id}`,
        name: 'Agora runtime result',
        parts: [{ text: JSON.stringify(dispatch.result_envelope) }],
        metadata: { schema: dispatch.result_envelope.schema },
      }] : [],
      metadata: {
        runtimeTargetRef: dispatch.runtime_target_ref,
        progress: dispatch.latest_progress,
        error: dispatch.error,
      },
    });
  }
}

function taskState(status: RuntimeNodeDispatchDto['status']): A2aTaskDto['status']['state'] {
  if (status === 'pending') return 'submitted';
  if (status === 'claimed') return 'working';
  return status;
}
function parseDshTarget(value: string): { nodeId: string } {
  const match = /^dsh:([^:]+):.+$/u.exec(value);
  if (!match) throw new TypeError('A2A runtimeTargetRef must use dsh:<node>:<agent>');
  return { nodeId: match[1]! };
}
function metadataString(value: Record<string, unknown> | null | undefined, key: string): string | null {
  const candidate = value?.[key]; return typeof candidate === 'string' && candidate ? candidate : null;
}
function recordValue(value: Record<string, unknown> | null | undefined, key: string): Record<string, unknown> | null {
  const candidate = value?.[key]; return typeof candidate === 'object' && candidate !== null && !Array.isArray(candidate) ? candidate as Record<string, unknown> : null;
}
function stringResult(value: Record<string, unknown> | null, key: string): string | null { const candidate = value?.[key]; return typeof candidate === 'string' ? candidate : null; }
