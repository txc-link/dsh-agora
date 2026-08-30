import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash, generateKeyPairSync, sign } from 'node:crypto'
import {
  DSH_AGORA_EXTENSION_PROTOCOL,
  DSH_AGORA_RUNTIME_PROTOCOL,
  DshAgoraExtensionRegistry,
  HarnessRuntimeAdapter,
  DSH_AGORA_EXTENSION_MANIFEST_PROTOCOL,
  runExtensionConformance,
} from '../lib/index.js'

test('extension registry versions, isolates, and disposes runtime adapters', () => {
  const registry = new DshAgoraExtensionRegistry()
  const extension = {
    protocol: DSH_AGORA_EXTENSION_PROTOCOL,
    id: 'example-runtime',
    kind: 'runtime',
    capabilities: ['runtime.execute'],
    runtime: {
      protocol: DSH_AGORA_RUNTIME_PROTOCOL,
      describeAgents: () => [],
      execute: async () => ({ sessionId: 's', answer: 'ok' }),
    },
  }
  const dispose = registry.registerExtension(extension)
  assert.deepEqual(registry.listExtensions()[0].capabilities, ['runtime.execute'])
  assert.throws(() => registry.registerExtension({ ...extension, id: 'duplicate-capabilities', capabilities: ['runtime.execute', 'runtime.execute'] }), /must be unique/)
  assert.throws(() => registry.registerExtension(extension), /already registered/)
  dispose()
  assert.equal(registry.listExtensions().length, 0)
})

test('extension registry routes targets to explicit third-party runtime adapters', () => {
  const registry = new DshAgoraExtensionRegistry()
  const makeExtension = (id, prefix) => ({
    protocol: DSH_AGORA_EXTENSION_PROTOCOL,
    id,
    kind: 'runtime',
    capabilities: ['runtime.execute'],
    runtime: {
      protocol: DSH_AGORA_RUNTIME_PROTOCOL,
      supportsTarget: target => target.startsWith(prefix),
      describeAgents: () => [],
      execute: async () => ({ sessionId: 's', answer: id }),
    },
  })
  const alpha = makeExtension('alpha-runtime', 'alpha:')
  const beta = makeExtension('beta-runtime', 'beta:')
  registry.registerExtension(alpha)
  registry.registerExtension(beta)
  assert.equal(registry.runtimeForTarget('beta:worker'), beta.runtime)
  assert.equal(registry.runtimeForTarget('unknown:worker'), null)
})

test('extension registry does not route an explicitly unsupported target through a sole adapter', () => {
  const registry = new DshAgoraExtensionRegistry()
  registry.registerExtension({
    protocol: DSH_AGORA_EXTENSION_PROTOCOL,
    id: 'explicit-runtime',
    kind: 'runtime',
    capabilities: ['runtime.execute'],
    runtime: {
      protocol: DSH_AGORA_RUNTIME_PROTOCOL,
      supportsTarget: () => false,
      describeAgents: () => [],
      execute: async () => { throw new Error('must not execute') },
    },
  })
  assert.equal(registry.runtimeForTarget('custom:node:agent'), null)
})

test('third-party extensions require trusted Ed25519 manifests under strict policy', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  const extension = {
    protocol: DSH_AGORA_EXTENSION_PROTOCOL,
    id: 'signed-runtime',
    kind: 'runtime',
    capabilities: ['runtime.execute'],
    runtime: { protocol: DSH_AGORA_RUNTIME_PROTOCOL, describeAgents: () => [{ agent_ref: 'signed', roles: [], capabilities: [] }], execute: async () => ({ sessionId: 's', answer: 'ok' }) },
  }
  const unsigned = {
    protocol: DSH_AGORA_EXTENSION_MANIFEST_PROTOCOL,
    id: extension.id,
    version: '1.0.0',
    kind: extension.kind,
    integrity_sha256: createHash('sha256').update('package').digest('hex'),
    capabilities: ['runtime.execute'],
    permissions: [{ capability: 'runtime.execute', resources: ['runtime:dsh:*'] }],
    publisher: { id: 'example', key_id: 'main' },
  }
  const manifest = { ...unsigned, signature: { algorithm: 'Ed25519', value: sign(null, Buffer.from(stableJson(unsigned)), privateKey).toString('base64url') } }
  const registry = new DshAgoraExtensionRegistry({
    requireSignedThirdParty: true,
    trustedPublicKeys: { 'example:main': publicKey.export({ type: 'spki', format: 'pem' }) },
  })

  assert.throws(() => registry.registerExtension(extension), /requires a signed manifest/)
  assert.throws(() => registry.registerExtension(extension, manifest), /requires package bytes/)
  registry.registerExtension(extension, manifest, Buffer.from('package'))
  assert.equal(registry.manifestFor('signed-runtime').version, '1.0.0')
  assert.deepEqual((await runExtensionConformance(extension, manifest)).ok, true)
})

test('Harness runtime creates a Session and tracks the exact dispatched turn', async () => {
  const calls = []
  const progress = []
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
          { event: { seq: 3, type: 'assistant/message', data: { turn: 9, message: { content: [{ type: 'text', text: 'remote result\n\n<agora-evidence>{"claims":[{"id":"claim-1","statement":"Tests passed","evidence_ids":["evidence-1"],"confidence":0.95}],"evidence":[{"id":"evidence-1","kind":"measurement","label":"test suite","metadata":{"passed":42}}],"confidence":0.95,"revision":"abc123"}</agora-evidence>' }] } } } },
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
  }, AbortSignal.timeout(5_000), {
    reportProgress: async event => { progress.push(event) },
  })
  assert.equal(result.sessionId, 'session-1')
  assert.equal(result.answer, 'remote result')
  assert.deepEqual(result.metadata, {
    agent_ref: 'developer',
    node_id: 'node-b',
    runtime_target_ref: 'dsh:node-b:developer',
    dispatch_id: 'dispatch-1',
  })
  assert.deepEqual(progress.map(event => event.phase), ['session_ready', 'prompt_accepted', 'response_started', 'response_completed'])
  assert.equal(result.resultEnvelope.schema, 'agora.runtime-result/v1')
  assert.equal(result.resultEnvelope.claims[0].statement, 'Tests passed')
  assert.equal(result.resultEnvelope.evidence[0].metadata.passed, 42)
  assert.equal(result.resultEnvelope.environment.revision, 'abc123')
  assert.equal(result.resultEnvelope.environment.agent_ref, 'developer')
  assert.deepEqual(result.resultEnvelope.environment.metadata, {
    node_id: 'node-b',
    runtime_target_ref: 'dsh:node-b:developer',
    dispatch_id: 'dispatch-1',
  })
  assert.equal(typeof result.resultEnvelope.usage.duration_ms, 'number')
  const promptCall = calls.find(call => call.method === 'session.prompt')
  assert.equal(promptCall.rpcId, 'agora-dispatch-dispatch-1')
  const prompt = promptCall.payload.content[0].text
  assert.match(prompt, /Authoritative runtime context/)
  assert.match(prompt, /Runtime node: node-b/)
  assert.match(prompt, /Runtime target: dsh:node-b:developer/)
  assert.match(prompt, /Dispatch: dispatch-1/)
  assert.match(prompt, /Do not infer or replace these values/)
})

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(',')}}`
  return JSON.stringify(value) ?? 'null'
}
