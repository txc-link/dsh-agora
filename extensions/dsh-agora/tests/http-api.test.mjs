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
