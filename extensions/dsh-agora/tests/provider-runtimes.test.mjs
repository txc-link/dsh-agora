import assert from 'node:assert/strict'
import test from 'node:test'
import { HermesdRuntimeAdapter, OpenClawRuntimeAdapter } from '../lib/index.js'

function dispatch(target, overrides = {}) {
  return {
    id: 'dispatch-1', node_id: 'node-mac', status: 'claimed', claimed_by: 'instance', claim_token: 'claim', claim_expires_at: null,
    attempt: 1, claimed_at: '', claim_renewed_at: '', runtime_target_ref: target, prompt: 'Research it', idempotency_key: 'stable-1',
    task_id: 'task-1', participant_binding_id: null, session_id: null, workspace_alias: null, agent_preset: null,
    metadata: null, result: null, error: null, created_at: '', updated_at: '', completed_at: null,
    ...overrides,
  }
}

test('OpenClaw runtime executes a namespaced agent with a stable session and JSON envelope', async () => {
  let commandRequest
  const progress = []
  const runtime = new OpenClawRuntimeAdapter({
    agents: [{ id: 'researcher', displayName: 'OpenClaw Researcher', workspace: '/repo', model: 'openai/gpt-5.4' }],
    runCommand: async request => {
      commandRequest = request
      return {
        exitCode: 0, stderr: '',
        stdout: JSON.stringify({ ok: true, status: 'ok', final: 'OpenClaw result', sessionId: 'oc-session-1', usage: { input: 12, output: 5, total: 17 }, costUsd: 0.01 }),
      }
    },
  })

  assert.equal(runtime.supportsTarget('dsh:node-mac:openclaw/researcher'), true)
  assert.equal(runtime.supportsTarget('dsh:node-mac:researcher'), false)
  assert.equal(runtime.describeAgents()[0].agent_ref, 'openclaw/researcher')
  const result = await runtime.execute(dispatch('dsh:node-mac:openclaw/researcher'), AbortSignal.timeout(5_000), {
    reportProgress: async event => { progress.push(event) },
  })

  assert.equal(commandRequest.command, 'openclaw')
  assert.deepEqual(commandRequest.args.slice(0, 4), ['agent', '--agent', 'researcher', '--message-file'])
  assert.ok(commandRequest.args.includes('--session-key'))
  assert.match(commandRequest.input, /Authoritative Agora runtime context/)
  assert.equal(result.sessionId, 'oc-session-1')
  assert.equal(result.answer, 'OpenClaw result')
  assert.equal(result.resultEnvelope.usage.total_tokens, 17)
  assert.equal(result.resultEnvelope.usage.cost_usd, 0.01)
  assert.deepEqual(progress.map(item => item.phase), ['runtime_started', 'response_completed'])
})

test('Hermesd runtime creates and polls a run with the dispatch idempotency key', async () => {
  const calls = []
  let polls = 0
  const runtime = new HermesdRuntimeAdapter({
    baseUrl: 'http://127.0.0.1:8642',
    apiKey: 'hermes-secret',
    pollIntervalMs: 1,
    profiles: [{ id: 'analyst', serverProfile: 'analysis' }],
    fetch: async (input, init) => {
      const url = new URL(String(input))
      calls.push({ url, init })
      if (init?.method === 'POST' && url.pathname.endsWith('/v1/runs')) {
        return Response.json({ run_id: 'run-1', status: 'started' }, { status: 202 })
      }
      if (init?.method === 'GET') {
        polls += 1
        return Response.json(polls === 1
          ? { run_id: 'run-1', status: 'running', session_id: 'hermes-session' }
          : { run_id: 'run-1', status: 'completed', session_id: 'hermes-session', output: 'Hermes result', usage: { input_tokens: 20, output_tokens: 8, total_tokens: 28 } })
      }
      throw new Error(`unexpected ${init?.method} ${url}`)
    },
  })

  assert.equal(runtime.supportsTarget('dsh:node-home-linux:hermes/analyst'), true)
  assert.equal(runtime.supportsTarget('dsh:node-home-linux:hermesd/analyst'), true)
  const result = await runtime.execute(dispatch('dsh:node-home-linux:hermes/analyst'), AbortSignal.timeout(5_000))

  assert.equal(calls.filter(call => call.init?.method === 'POST').length, 1)
  assert.equal(calls[0].url.pathname, '/p/analysis/v1/runs')
  assert.equal(calls[0].init.headers.authorization, 'Bearer hermes-secret')
  assert.equal(calls[0].init.headers['idempotency-key'], 'stable-1')
  assert.equal(result.sessionId, 'hermes-session')
  assert.equal(result.answer, 'Hermes result')
  assert.equal(result.resultEnvelope.usage.total_tokens, 28)
})
