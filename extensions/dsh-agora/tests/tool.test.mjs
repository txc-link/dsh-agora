import assert from 'node:assert/strict'
import test from 'node:test'
import { createAgoraTool, parseToolArgs } from '../lib/index.js'

test('agora_task creates through the DSH agent without any IM dependency', async () => {
  let captured
  const service = fakeService({
    createTask: async input => {
      captured = input
      return task('OC-TOOL', input.title)
    },
  })
  const tool = createAgoraTool(service)
  const value = await tool.execute({
    action: 'create', title: 'Govern this work', task_type: 'implementation', priority: 'high',
  }, { signal: AbortSignal.timeout(1000), agent: { id: 'dsh-session-7' } })
  assert.equal(value.data.id, 'OC-TOOL')
  assert.deepEqual(captured, {
    title: 'Govern this work', creator: 'dsh-session-7', type: 'implementation', priority: 'high',
  })
})

test('agora_task rejects approval and unknown fields', () => {
  assert.throws(() => parseToolArgs({ action: 'approve', task_id: 'OC-1' }), /unsupported/)
  assert.throws(() => parseToolArgs({ action: 'health', token: 'secret' }), /unknown agora_task argument/)
})

function fakeService(overrides = {}) {
  return {
    serverUrl: 'http://agora.test',
    health: async () => ({ ok: true }), listTasks: async () => [],
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
