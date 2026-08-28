import assert from 'node:assert/strict'
import test from 'node:test'
import { DSH_AGORA_COMMAND_ADAPTER_PROTOCOL, DshAgoraCommandAdapter } from '../lib/index.js'

test('first-party command adapter normalizes IM events, deduplicates them, and uses the bridge only for delivery', async () => {
  let executions = 0
  const sends = []
  const adapter = new DshAgoraCommandAdapter({
    execute: async (input, context) => {
      executions += 1
      assert.equal(input, 'runs')
      assert.deepEqual(context, { actorId: 'discord:user-1', provider: 'discord', conversationRef: 'channel-1', threadRef: 'thread-1' })
      return { kind: 'success', text: 'run list' }
    },
    bridge: () => ({
      protocol: 'dsh-im.bridge/v1',
      listBots: () => [], resolveSession: () => null,
      send: async request => { sends.push(request); return { provider_message_refs: ['message-1'] } },
    }),
  })
  const event = {
    protocol: DSH_AGORA_COMMAND_ADAPTER_PROTOCOL,
    idempotency_key: 'discord:event-1', input: 'runs', actor_ref: 'discord:user-1', provider: 'discord',
    conversation_ref: 'channel-1', thread_ref: 'thread-1', reply: { enabled: true, bot_ref: 'bot-1' },
  }

  const [first, replay] = await Promise.all([adapter.ingest(event), adapter.ingest(event)])
  assert.equal(executions, 1)
  assert.equal(sends.length, 1)
  assert.deepEqual(first, replay)
  assert.deepEqual(first.delivery, { sent: true, provider_message_refs: ['message-1'] })
  assert.equal(sends[0].idempotency_key, 'command:discord:event-1')
})

test('command completion survives IM delivery failure without re-executing on replay', async () => {
  let executions = 0
  const adapter = new DshAgoraCommandAdapter({
    execute: async () => { executions += 1; return { kind: 'success', text: 'completed' } },
    bridge: () => ({
      protocol: 'dsh-im.bridge/v1', listBots: () => [], resolveSession: () => null,
      send: async () => { throw new Error('discord unavailable') },
    }),
  })
  const event = {
    protocol: DSH_AGORA_COMMAND_ADAPTER_PROTOCOL, idempotency_key: 'discord:event-failed-delivery',
    input: 'runs', actor_ref: 'discord:user-1', provider: 'discord', conversation_ref: 'channel-1',
    reply: { enabled: true },
  }
  const first = await adapter.ingest(event)
  const replay = await adapter.ingest(event)
  assert.equal(executions, 1)
  assert.deepEqual(first, replay)
  assert.equal(first.result.kind, 'success')
  assert.equal(first.delivery.sent, false)
  assert.match(first.delivery.reason, /discord unavailable/)
})
