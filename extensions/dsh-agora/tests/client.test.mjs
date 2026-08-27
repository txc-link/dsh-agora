import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'

test('browser client registers an Agora better-sidebar dashboard', async () => {
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(manifest.exports['./client'], './lib/client.js')
  assert.equal(manifest.dsh.client.platform, 'web')
  const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
  let registration
  const sandbox = {
    window: { __ModuleLoader__: { load(value) { registration = value } } },
    console,
    setInterval,
    clearInterval,
  }
  vm.runInNewContext(source, sandbox, { filename: 'dsh-agora-client.js' })
  assert.equal(registration.id, 'dsh-agora')

  const React = { createElement() { return null } }
  const plugin = registration.factory((name) => {
    assert.equal(name, 'react')
    return React
  })
  assert.equal(typeof plugin.apply, 'function')

  let optionalPlugin
  const disposers = []
  const ctx = {
    effect(effect) { disposers.push(effect()) },
    plugin(value) { optionalPlugin = value },
  }
  plugin.apply(ctx)
  assert.deepEqual(Array.from(optionalPlugin.inject), ['betterSidebar'])

  let tab
  optionalPlugin.apply({
    betterSidebar: { registerTab(value) { tab = value; return () => {} } },
    effect(effect) { disposers.push(effect()) },
  })
  assert.equal(tab.id, 'dsh-agora:dashboard')
  assert.equal(tab.title(), 'Agora 协同')
  assert.equal(tab.single, true)
  assert.equal(typeof tab.component, 'function')

  for (const dispose of disposers.reverse()) dispose?.()
})
