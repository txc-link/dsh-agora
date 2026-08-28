import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DSH_AGORA_EXTENSION_PROTOCOL,
  DSH_AGORA_RUNTIME_PROTOCOL,
  DshAgoraExtensionRegistry,
  HarnessRuntimeAdapter,
} from '../lib/index.js'

test('extension registry versions, isolates, and disposes runtime adapters', () => {
  const registry = new DshAgoraExtensionRegistry()
  const extension = {
    protocol: DSH_AGORA_EXTENSION_PROTOCOL,
    id: 'example-runtime',
    kind: 'runtime',
    capabilities: ['runtime.execute', 'runtime.execute'],
    runtime: {
      protocol: DSH_AGORA_RUNTIME_PROTOCOL,
      describeAgents: () => [],
      execute: async () => ({ sessionId: 's', answer: 'ok' }),
    },
  }
  const dispose = registry.registerExtension(extension)
  assert.deepEqual(registry.listExtensions()[0].capabilities, ['runtime.execute'])
  assert.throws(() => registry.registerExtension(extension), /already registered/)
  dispose()
  assert.equal(registry.listExtensions().length, 0)
})

test('Harness runtime creates a Session and tracks the exact dispatched turn', async () => {
  const calls = []
  let historyCount = 0
  const fetch = async (_url, options) => {
    const request = JSON.parse(options.body)
    calls.push(request)
    let value
    if (request.method === 'workspace.list') value = { items: [{ workspaceId: 'w-1', path: '/repo' }] }
    else if (request.method === 'session.create') value = { sessionId: 'session-1' }
    else if (request.method === 'session.prompt') value = { accepted: true }
    else if (request.method === 'session.history') {
      historyCount += 1
      value = historyCount === 1 ? { events: [] } : {
        events: [
          { event: { seq: 1, type: 'turn/start', data: { turn: 9 } } },
          { event: { seq: 2, type: 'user/message', data: { turn: 9, source: { rpcId: 'agora-dispatch-dispatch-1' } } } },
          { event: { seq: 3, type: 'assistant/message', data: { turn: 9, message: { content: [{ type: 'text', text: 'remote result' }] } } } },
          { event: { seq: 4, type: 'turn/end', data: { turn: 9, reason: 'completed' } } },
        ],
      }
    } else throw new Error(`unexpected ${request.method}`)
    return new Response(JSON.stringify({ type: 'server-response', rpcId: request.rpcId, result: { ok: true, value } }), {
      status: 200, headers: { 'content-type': 'application/json' },
    })
  }
  const runtime = new HarnessRuntimeAdapter({
    baseUrl: 'http://127.0.0.1:3999',
    agents: [{ id: 'developer', workspace: '/repo', preset: 'coding' }],
    fetch,
  })
  const result = await runtime.execute({
    id: 'dispatch-1', node_id: 'node-b', status: 'claimed', claimed_by: 'instance-b', claim_token: 'claim-1', claim_expires_at: null,
    attempt: 1, claimed_at: '', claim_renewed_at: '',
    runtime_target_ref: 'dsh:node-b:developer', prompt: 'Implement it', idempotency_key: 'once',
    task_id: null, participant_binding_id: null, session_id: null, workspace_alias: null, agent_preset: null,
    metadata: null, result: null, error: null, created_at: '', updated_at: '', completed_at: null,
  }, AbortSignal.timeout(5_000))
  assert.equal(result.sessionId, 'session-1')
  assert.equal(result.answer, 'remote result')
  assert.equal(calls.find(call => call.method === 'session.prompt').rpcId, 'agora-dispatch-dispatch-1')
})
