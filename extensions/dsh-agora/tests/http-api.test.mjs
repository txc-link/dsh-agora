import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import test from 'node:test'
import { handleHttpRequest } from '../lib/index.js'

test('host API exposes coordination creation, listing, and scorecards to the web panel', async () => {
  let created
  const service = {
    createCoordinationRun: async input => { created = input; return { id: 'run-1', mode: input.mode, status: 'running' } },
    listCoordinationRuns: async () => [{ id: 'run-1' }],
    listAgentScorecards: async () => [{ runtime_target_ref: 'dsh:web:alpha', score: 88 }],
  }
  const creation = await request('coordination-create', {
    mode: 'fanout', prompt: 'Inspect repository', runtimeTargetRefs: ['dsh:web:alpha', 'dsh:web:beta'],
    budget: { max_agents: 2, max_dispatches: 2, max_wall_clock_seconds: 600 }, idempotencyKey: 'ui-1',
  }, service)
  assert.equal(creation.status, 200)
  assert.equal(creation.body.value.id, 'run-1')
  assert.deepEqual(created.budget, { max_agents: 2, max_dispatches: 2, max_wall_clock_seconds: 600 })
  assert.equal((await request('coordination-runs', {}, service)).body.value.length, 1)
  assert.equal((await request('scorecards', {}, service)).body.value[0].score, 88)
})

test('host API rejects invalid coordination strategies before reaching the server', async () => {
  const result = await request('coordination-create', {
    mode: 'unknown', prompt: 'work', runtimeTargetRefs: ['dsh:web:alpha'], idempotencyKey: 'ui-2',
  }, { createCoordinationRun: async () => { throw new Error('must not run') } })
  assert.equal(result.status, 400)
  assert.equal(result.body.error.code, 'bad-request')
})

test('dispatch derives a per-message Agora key and resumes the room session', async () => {
  const calls = []
  const service = {
    dispatchAgent: async input => {
      calls.push(input)
      return { id: `d-${calls.length}`, status: 'completed', session_id: input.session_id ?? 'session-1' }
    },
  }

  // First message of the conversation: room-scoped key + eventId, no session yet.
  const first = await request('dispatch', {
    runtimeTargetRef: 'dsh:node-a:default', prompt: 'hi',
    idempotencyKey: 'matrix-mx_room', eventId: '$evt-1', waitTimeoutMs: 0,
  }, service)
  assert.equal(first.status, 200)
  assert.equal(calls[0].idempotency_key, 'matrix-mx_room#$evt-1',
    'the room-scoped key alone would make Agora replay this dispatch forever')
  assert.equal(calls[0].session_id, undefined)

  // Second message of the same conversation: fresh dispatch key, same session.
  await request('dispatch', {
    runtimeTargetRef: 'dsh:node-a:default', prompt: 'again',
    idempotencyKey: 'matrix-mx_room', eventId: '$evt-2', waitTimeoutMs: 0,
  }, service)
  assert.equal(calls[1].idempotency_key, 'matrix-mx_room#$evt-2')
  assert.equal(calls[1].session_id, 'session-1', 'the room must keep one DSH session')
})

test('dispatch without an eventId keeps the caller-supplied idempotency key verbatim', async () => {
  let seen
  const service = { dispatchAgent: async input => { seen = input; return { id: 'd-1', status: 'completed' } } }

  await request('dispatch', {
    runtimeTargetRef: 'dsh:node-a:default', prompt: 'task', idempotencyKey: 'task-abc', waitTimeoutMs: 0,
  }, service)

  assert.equal(seen.idempotency_key, 'task-abc')
  assert.equal(seen.session_id, undefined)
})

async function request(method, payload, service) {
  const input = Readable.from([Buffer.from(JSON.stringify(payload))])
  input.method = 'POST'
  input.url = `/dsh-agora/api/${method}`
  input.headers = {}
  input.socket = { remoteAddress: '127.0.0.1' }
  const response = {
    statusCode: 200,
    headers: {},
    setHeader(name, value) { this.headers[name] = value },
    end(value) { this.value = value },
  }
  await handleHttpRequest(input, response, service, {})
  return { status: response.statusCode, body: JSON.parse(response.value) }
}
