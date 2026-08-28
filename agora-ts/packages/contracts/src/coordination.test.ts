import { describe, expect, it } from 'vitest';
import {
  a2aAgentCardSchema,
  createCoordinationRunRequestSchema,
  createMemoryEntryRequestSchema,
  runtimeResultEnvelopeSchema,
} from './index.js';

describe('coordination and federation contracts', () => {
  it('applies bounded coordination defaults', () => {
    const parsed = createCoordinationRunRequestSchema.parse({
      prompt: 'Inspect the repository independently.',
      mode: 'fanout',
      candidates: [{ runtime_target_ref: 'dsh:node-a:default' }],
      idempotency_key: 'run-1',
    });
    expect(parsed.budget).toMatchObject({
      max_agents: 4,
      max_dispatches: 6,
      max_wall_clock_seconds: 1_800,
      min_information_gain: 0.05,
    });
  });

  it('rejects duplicate or malformed runtime targets', () => {
    expect(() => createCoordinationRunRequestSchema.parse({
      prompt: 'work', mode: 'fanout', candidates: [{ runtime_target_ref: 'not-a-target' }], idempotency_key: 'bad-target',
    })).toThrow();
    expect(() => createCoordinationRunRequestSchema.parse({
      prompt: 'work', mode: 'fanout', candidates: [{ runtime_target_ref: 'dsh:web:a' }, { runtime_target_ref: 'dsh:web:a' }], idempotency_key: 'duplicate-target',
    })).toThrow();
  });

  it('requires selectors for scoped memories', () => {
    expect(() => createMemoryEntryRequestSchema.parse({
      scope: 'agent_private',
      content: 'private observation',
      owner_ref: 'controller',
      visibility: 'private',
      source: { kind: 'agent' },
    })).toThrow(/agent_ref/u);
  });

  it('accepts result usage without making it mandatory', () => {
    const parsed = runtimeResultEnvelopeSchema.parse({
      schema: 'agora.runtime-result/v1',
      answer: 'done',
      usage: { total_tokens: 120, duration_ms: 1_500 },
    });
    expect(parsed.usage?.total_tokens).toBe(120);
    expect(parsed.usage?.tool_calls).toBeNull();
  });

  it('models the A2A 1.0 interface on the Agent Card', () => {
    const card = a2aAgentCardSchema.parse({
      name: 'Agora',
      description: 'Governed runtime targets',
      supportedInterfaces: [{ url: 'https://example.test/a2a', protocolBinding: 'HTTP+JSON', protocolVersion: '1.0' }],
      provider: { organization: 'Agora', url: 'https://example.test' },
      version: '1.0.0',
      capabilities: { streaming: false, pushNotifications: false, extendedAgentCard: false },
      securitySchemes: {},
      securityRequirements: [],
      defaultInputModes: ['text/plain'],
      defaultOutputModes: ['text/plain'],
      skills: [],
    });
    expect(card.supportedInterfaces[0]?.protocolVersion).toBe('1.0');
  });
});
