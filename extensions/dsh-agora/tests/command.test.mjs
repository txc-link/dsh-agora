import assert from 'node:assert/strict'
import test from 'node:test'
import { executeAgoraCommand, parseAgoraCommand } from '../lib/index.js'

test('parser supports quoted titles and flags', () => {
  assert.deepEqual(parseAgoraCommand('create --type implementation "DSH Agora adapter" --priority high'), {
    kind: 'create',
    input: { title: 'DSH Agora adapter', type: 'implementation', priority: 'high' },
  })
})

test('IM command context becomes an Agora im_target', async () => {
  let input
  const service = fakeService({
    createTask: async value => {
      input = value
      return task('OC-9', value.title)
    },
  })
  const result = await executeAgoraCommand(service, 'create Fix gateway', {
    actorId: 'discord:user-1', provider: 'discord', conversationRef: 'channel-1', threadRef: 'thread-1',
  })
  assert.equal(result.kind, 'success')
  assert.deepEqual(input, {
    title: 'Fix gateway', creator: 'discord:user-1',
    imTarget: { provider: 'discord', conversation_ref: 'channel-1', thread_ref: 'thread-1' },
  })
})

test('command errors are rendered and never thrown into the DSH surface', async () => {
  const service = fakeService({ health: async () => { throw new Error('connection refused') } })
  assert.deepEqual(await executeAgoraCommand(service, 'health'), { kind: 'error', text: 'connection refused' })
  const invalid = await executeAgoraCommand(service, 'approve OC-1')
  assert.equal(invalid.kind, 'error')
  assert.match(invalid.text, /Human approval and rejection remain/)
})

test('dispatch status separates lease liveness from meaningful progress and evidence', async () => {
  const service = fakeService({
    getRuntimeDispatch: async () => ({
      id: 'dispatch-1',
      status: 'completed',
      runtime_target_ref: 'dsh:node-b:developer',
      session_id: 'session-1',
      claim_renewed_at: '2026-08-28T01:00:00.000Z',
      latest_progress: { attempt: 1, sequence: 5, phase: 'response_completed', percent: 90, message: 'Agent response completed' },
      result_envelope: { claims: [{ id: 'claim-1' }], evidence: [{ id: 'evidence-1' }], confidence: 0.95 },
      error: null,
    }),
    listRuntimeDispatchProgress: async () => [],
  })
  const result = await executeAgoraCommand(service, 'dispatch-status dispatch-1')
  assert.equal(result.kind, 'success')
  assert.match(result.text, /Lease heartbeat:/)
  assert.match(result.text, /Work progress: response_completed \(#1\.5\) 90%/)
  assert.match(result.text, /Evidence: 1 item\(s\), 1 claim\(s\)/)
})

function fakeService(overrides = {}) {
  return {
    serverUrl: 'http://agora.test',
    health: async () => ({ ok: true }),
    listTasks: async () => [],
    getTask: async id => task(id, 'Task'),
    taskStatus: async id => ({ task: task(id, 'Task'), flow_log: [], progress_log: [], subtasks: [] }),
    createTask: async input => task('OC-1', input.title),
    listRuntimeDispatchProgress: async () => [],
    executeCommand: async () => ({ kind: 'success' }),
    snapshot: () => ({ serverUrl: 'http://agora.test', command: '/agora', im: { state: 'unavailable', reason: 'none' } }),
    ...overrides,
  }
}

function task(id, title) {
  return { id, title, type: 'general', priority: 'normal', creator: 'dsh', state: 'created', current_stage: null }
}
