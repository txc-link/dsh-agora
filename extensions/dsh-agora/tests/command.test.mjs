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

function fakeService(overrides = {}) {
  return {
    serverUrl: 'http://agora.test',
    health: async () => ({ ok: true }),
    listTasks: async () => [],
    getTask: async id => task(id, 'Task'),
    taskStatus: async id => ({ task: task(id, 'Task'), flow_log: [], progress_log: [], subtasks: [] }),
    createTask: async input => task('OC-1', input.title),
    executeCommand: async () => ({ kind: 'success' }),
    snapshot: () => ({ serverUrl: 'http://agora.test', command: '/agora', im: { state: 'unavailable', reason: 'none' } }),
    ...overrides,
  }
}

function task(id, title) {
  return { id, title, type: 'general', priority: 'normal', creator: 'dsh', state: 'created', current_stage: null }
}
