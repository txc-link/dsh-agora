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
  let claimed = false
  const dispatch = {
    id: 'dispatch-1', node_id: 'node-b', status: 'claimed', claimed_by: 'instance-b', claim_expires_at: null,
    task_id: 'OC-1', participant_binding_id: 'participant-1', runtime_target_ref: 'dsh:node-b:developer',
    session_id: null, workspace_alias: null, agent_preset: null, prompt: 'Review', idempotency_key: 'once',
    metadata: { presentation_target: { mode: 'destination_bot', provider: 'discord', conversation_ref: 'channel-1', thread_ref: 'thread-1' } },
    result: null, error: null, created_at: '', updated_at: '', completed_at: null,
  }
  const client = {
    heartbeatRuntimeNode: async (_nodeId, input) => ({ ...input, node_id: 'node-b' }),
    claimRuntimeDispatch: async () => claimed ? null : (claimed = true, dispatch),
    bindRuntimeSession: async (...args) => { bindings.push(args); return {} },
    completeRuntimeDispatch: async (_node, _id, input) => { completed.push(input); return { ...dispatch, status: input.status } },
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
    send: async request => { sends.push(request); return { provider_message_refs: ['message-1'] } },
  }
  const worker = new RuntimeNodeWorker({
    client, registry, nodeId: 'node-b', instanceId: 'instance-b', pluginVersion: 'test',
    heartbeatIntervalMs: 20, dispatchPollIntervalMs: 10, imBridge: bridge,
  })
  worker.start()
  await waitFor(() => completed.length === 1)
  worker.stop()
  assert.equal(completed[0].status, 'completed')
  assert.equal(completed[0].session_id, 'session-b')
  assert.equal(bindings.length, 1)
  assert.equal(sends[0].bot_ref, 'bot-b')
  assert.equal(sends[0].thread_ref, 'thread-1')
})

async function waitFor(predicate) {
  const deadline = Date.now() + 2_000
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('timed out')
    await new Promise(resolve => setTimeout(resolve, 10))
  }
}
