import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DSH_AGORA_EXTENSION_PROTOCOL,
  DSH_AGORA_RUNTIME_PROTOCOL,
  DSH_IM_BRIDGE_PROTOCOL,
  DshAgoraExtensionRegistry,
  RuntimeNodeWorker,
} from '../lib/index.js'

test('node worker heartbeats, executes a durable dispatch, binds its Session, and presents through dsh-im', async () => {
  const completed = []
  const bindings = []
  const sends = []
  const order = []
  let claimed = false
  let deliveryClaimed = false
  const dispatch = {
    id: 'dispatch-1', node_id: 'node-b', status: 'claimed', claimed_by: 'instance-b', claim_token: 'claim-1', claim_expires_at: null,
    attempt: 1, claimed_at: '', claim_renewed_at: '',
    task_id: 'OC-1', participant_binding_id: 'participant-1', runtime_target_ref: 'dsh:node-b:developer',
    session_id: null, workspace_alias: null, agent_preset: null, prompt: 'Review', idempotency_key: 'once',
    metadata: { presentation_target: { mode: 'destination_bot', provider: 'discord', conversation_ref: 'channel-1', thread_ref: 'thread-1' } },
    result: null, error: null, created_at: '', updated_at: '', completed_at: null,
  }
  const client = {
    heartbeatRuntimeNode: async (_nodeId, input) => ({ ...input, node_id: 'node-b' }),
    claimRuntimeDispatch: async () => claimed ? null : (claimed = true, dispatch),
    renewRuntimeDispatch: async () => dispatch,
    bindRuntimeSession: async (...args) => { bindings.push(args); return {} },
    completeRuntimeDispatch: async (_node, _id, input) => {
      order.push('complete-dispatch')
      completed.push(input)
      return { ...dispatch, status: input.status }
    },
    claimRuntimeDelivery: async () => {
      if (completed.length === 0 || deliveryClaimed) return null
      deliveryClaimed = true
      return {
        id: 'delivery-1', dispatch_id: dispatch.id, node_id: 'node-b',
        payload: completed[0].delivery_payload, status: 'claimed', attempt: 1,
        claimed_by: 'instance-b', claim_token: 'delivery-claim-1',
        claim_expires_at: new Date(Date.now() + 60_000).toISOString(), next_attempt_at: '',
        receipt: null, error: null, created_at: '', updated_at: '', delivered_at: null,
      }
    },
    completeRuntimeDelivery: async (_node, _id, input) => {
      order.push('complete-delivery')
      return { status: input.status }
    },
  }
  const registry = new DshAgoraExtensionRegistry()
  registry.registerExtension({
    protocol: DSH_AGORA_EXTENSION_PROTOCOL,
    id: 'runtime', kind: 'runtime', capabilities: ['runtime.execute'],
    runtime: {
      protocol: DSH_AGORA_RUNTIME_PROTOCOL,
      describeAgents: () => [{ agent_ref: 'developer', roles: [], capabilities: [] }],
      execute: async () => ({ sessionId: 'session-b', answer: 'Reviewed' }),
    },
  })
  const bridge = {
    protocol: DSH_IM_BRIDGE_PROTOCOL,
    listBots: async () => [{ provider: 'discord', bot_ref: 'bot-b', platform_id: '2', agent_ref: 'developer', connected: true, capabilities: ['send'] }],
    resolveSession: async () => null,
    send: async request => {
      order.push('send')
      sends.push(request)
      return { provider_message_refs: ['message-1'] }
    },
  }
  const worker = new RuntimeNodeWorker({
    client, registry, nodeId: 'node-b', instanceId: 'instance-b', pluginVersion: 'test',
    heartbeatIntervalMs: 20, dispatchPollIntervalMs: 10, deliveryPollIntervalMs: 10, imBridge: bridge,
  })
  worker.start()
  await waitFor(() => order.includes('complete-delivery'))
  worker.stop()
  assert.equal(completed[0].status, 'completed')
  assert.equal(completed[0].claim_token, 'claim-1')
  assert.equal(completed[0].session_id, 'session-b')
  assert.equal(bindings.length, 1)
  assert.equal(sends[0].bot_ref, 'bot-b')
  assert.equal(sends[0].thread_ref, 'thread-1')
  assert.equal(completed[0].delivery_payload.protocol, 'dsh-agora.presentation/v1')
  assert.deepEqual(order, ['complete-dispatch', 'send', 'complete-delivery'])
})

test('node worker renews a long-running dispatch before its claim expires', async () => {
  let claimed = false
  let releaseExecution
  const renewals = []
  const completions = []
  const dispatch = {
    id: 'dispatch-long', node_id: 'node-b', status: 'claimed', claimed_by: 'instance-b', claim_token: 'claim-long',
    claim_expires_at: new Date(Date.now() + 15_000).toISOString(), attempt: 1, claimed_at: '', claim_renewed_at: '',
    task_id: null, participant_binding_id: null, runtime_target_ref: 'dsh:node-b:developer', session_id: null,
    workspace_alias: null, agent_preset: null, prompt: 'Long review', idempotency_key: 'long-once', metadata: null,
    result: null, error: null, created_at: '', updated_at: '', completed_at: null,
  }
  const client = {
    heartbeatRuntimeNode: async (_nodeId, input) => ({ ...input, node_id: 'node-b' }),
    claimRuntimeDispatch: async () => claimed ? null : (claimed = true, dispatch),
    renewRuntimeDispatch: async (...args) => { renewals.push(args); return dispatch },
    completeRuntimeDispatch: async (_node, _id, input) => { completions.push(input); return { ...dispatch, status: input.status } },
    claimRuntimeDelivery: async () => null,
    completeRuntimeDelivery: async () => { throw new Error('unexpected delivery completion') },
  }
  const registry = new DshAgoraExtensionRegistry()
  registry.registerExtension({
    protocol: DSH_AGORA_EXTENSION_PROTOCOL,
    id: 'runtime', kind: 'runtime', capabilities: ['runtime.execute'],
    runtime: {
      protocol: DSH_AGORA_RUNTIME_PROTOCOL,
      describeAgents: () => [{ agent_ref: 'developer', roles: [], capabilities: [] }],
      execute: () => new Promise(resolve => { releaseExecution = () => resolve({ sessionId: 'session-long', answer: 'done' }) }),
    },
  })
  const worker = new RuntimeNodeWorker({
    client, registry, nodeId: 'node-b', instanceId: 'instance-b', pluginVersion: 'test',
    heartbeatIntervalMs: 20, dispatchPollIntervalMs: 10, dispatchLeaseSeconds: 15,
    dispatchRenewIntervalMs: 20, deliveryPollIntervalMs: 10,
  })
  worker.start()
  await waitFor(() => renewals.length > 0)
  assert.deepEqual(renewals[0].slice(0, 5), ['node-b', 'dispatch-long', 'instance-b', 'claim-long', 15])
  releaseExecution()
  await waitFor(() => completions.length === 1)
  worker.stop()
})

test('node worker returns a failed IM delivery to the durable outbox for retry', async () => {
  let deliveryClaimed = false
  const retries = []
  const client = {
    heartbeatRuntimeNode: async (_nodeId, input) => ({ ...input, node_id: 'node-b' }),
    claimRuntimeDispatch: async () => null,
    renewRuntimeDispatch: async () => { throw new Error('unexpected renewal') },
    completeRuntimeDispatch: async () => { throw new Error('unexpected dispatch completion') },
    claimRuntimeDelivery: async () => {
      if (deliveryClaimed) return null
      deliveryClaimed = true
      return {
        id: 'delivery-retry', dispatch_id: 'dispatch-retry', node_id: 'node-b',
        payload: {
          protocol: 'dsh-agora.presentation/v1', runtime_target_ref: 'dsh:node-b:developer', text: 'result',
          target: { provider: 'discord', conversation_ref: 'channel-1' },
        },
        status: 'claimed', attempt: 1, claimed_by: 'instance-b', claim_token: 'delivery-token',
        claim_expires_at: new Date(Date.now() + 60_000).toISOString(), next_attempt_at: '', receipt: null,
        error: null, created_at: '', updated_at: '', delivered_at: null,
      }
    },
    completeRuntimeDelivery: async (_node, _id, input) => { retries.push(input); return { status: input.status } },
  }
  const registry = new DshAgoraExtensionRegistry()
  registry.registerExtension({
    protocol: DSH_AGORA_EXTENSION_PROTOCOL,
    id: 'runtime', kind: 'runtime', capabilities: ['runtime.execute'],
    runtime: {
      protocol: DSH_AGORA_RUNTIME_PROTOCOL,
      describeAgents: () => [{ agent_ref: 'developer', roles: [], capabilities: [] }],
      execute: async () => ({ sessionId: 'unused', answer: 'unused' }),
    },
  })
  const bridge = {
    protocol: DSH_IM_BRIDGE_PROTOCOL,
    listBots: async () => [{ provider: 'discord', bot_ref: 'bot-b', agent_ref: 'developer', connected: true, capabilities: ['send'] }],
    resolveSession: async () => null,
    send: async () => { throw new Error('Discord unavailable') },
  }
  const worker = new RuntimeNodeWorker({
    client, registry, nodeId: 'node-b', instanceId: 'instance-b', pluginVersion: 'test',
    heartbeatIntervalMs: 20, dispatchPollIntervalMs: 10, deliveryPollIntervalMs: 10, imBridge: bridge,
  })
  worker.start()
  await waitFor(() => retries.length === 1)
  worker.stop()
  assert.equal(retries[0].status, 'retry')
  assert.equal(retries[0].claim_token, 'delivery-token')
  assert.match(retries[0].error, /Discord unavailable/)
  assert.ok(retries[0].retry_delay_seconds >= 5)
})

async function waitFor(predicate) {
  const deadline = Date.now() + 2_000
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('timed out')
    await new Promise(resolve => setTimeout(resolve, 10))
  }
}
