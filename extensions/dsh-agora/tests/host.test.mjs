import assert from 'node:assert/strict'
import test from 'node:test'
import { apply, DSH_IM_COMMAND_GATEWAY_PROTOCOL } from '../lib/index.js'

test('host registers one slash command, service accessor, API, and IM gateway command', async () => {
  let command
  let imCommand
  let route
  const accessors = new Map()
  let tool
  const disposers = []
  const gateway = {
    protocol: DSH_IM_COMMAND_GATEWAY_PROTOCOL,
    registerCommand(value) { imCommand = value; return () => {} },
  }
  const ctx = {
    commands: { register(value) { command = value; return () => {} } },
    tools: { register(value) { tool = value; return () => {} } },
    get(name) {
      if (name === 'dshImCommandGateway') return gateway
      if (name === 'webServer') return { register(value) { route = value; return () => {} } }
      return undefined
    },
    accessor(name, descriptor) { accessors.set(name, descriptor) },
    effect(effect) { disposers.push(effect()) },
  }
  apply(ctx, { serverUrl: 'http://127.0.0.1:3999', commandName: 'agora' })
  assert.equal(command.name, 'agora')
  assert.equal(tool.name, 'agora_task')
  assert.equal(imCommand.name, 'agora')
  assert.equal(route.path, '/dsh-agora/api')
  assert.equal(accessors.get('dshAgora').get().snapshot().im.state, 'connected')
  assert.equal(accessors.get('dshAgoraCommandAdapter').get().protocol, 'dsh-agora.command-adapter/v1')
  const result = await command.handler({ rawInput: 'dashboard', agent: { id: 'session-1' }, signal: AbortSignal.timeout(1000) })
  assert.deepEqual(result, { kind: 'success', text: 'http://127.0.0.1:3999/dashboard/' })
  assert.equal(disposers.length, 3)
})

test('host stays useful when dsh-im has no public command gateway', () => {
  const accessors = new Map()
  const ctx = {
    commands: { register() { return () => {} } },
    tools: { register() { return () => {} } },
    get() { return undefined },
    accessor(name, descriptor) { accessors.set(name, descriptor) },
    effect(effect) { effect() },
  }
  apply(ctx)
  assert.equal(accessors.get('dshAgora').get().snapshot().im.state, 'unavailable')
  assert.equal(accessors.get('dshAgora').get().snapshot().commandAdapter.state, 'ready')
})
