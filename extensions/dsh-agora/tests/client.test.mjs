import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'

test('browser client registers an Agora dashboard and visible launcher', async () => {
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(manifest.exports['./client'], './lib/client.js')
  assert.equal(manifest.dsh.client.platform, 'web')
  const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
  assert.match(source, /latest_progress/)
  assert.match(source, /result_envelope/)
  assert.match(source, /租约心跳与工作进度分开显示/)
  assert.match(source, /coordination-create/)
  assert.match(source, /Agent Scorecard/)
  assert.match(source, /环境漂移/)
  let registration
  const storage = new Map()
  const nodes = []
  const createElement = (tag) => ({
    tag,
    children: [],
    attributes: {},
    listeners: {},
    append(...children) { this.children.push(...children) },
    appendChild(child) { this.children.push(child); nodes.push(child) },
    setAttribute(name, value) { this.attributes[name] = value },
    addEventListener(name, listener) { this.listeners[name] = listener },
    removeEventListener(name) { delete this.listeners[name] },
    remove() { const at = nodes.indexOf(this); if (at >= 0) nodes.splice(at, 1) },
  })
  const head = createElement('head')
  const body = createElement('body')
  const sandbox = {
    window: {
      __ModuleLoader__: { load(value) { registration = value } },
      sessionStorage: {
        getItem(key) { return storage.get(key) ?? null },
        setItem(key, value) { storage.set(key, value) },
      },
    },
    document: {
      body,
      head,
      documentElement: head,
      createElement,
      querySelector(selector) {
        if (selector === '[data-dsh-agora-launcher]') {
          return nodes.find((node) => node.attributes?.['data-dsh-agora-launcher'] === '')
        }
        return undefined
      },
    },
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

  const optionalPlugins = []
  const disposers = []
  const ctx = {
    effect(effect) { disposers.push(effect()) },
    plugin(value) { optionalPlugins.push(value) },
  }
  plugin.apply(ctx)
  assert.equal(optionalPlugins.length, 1)
  assert.deepEqual(Array.from(optionalPlugins[0].inject), ['betterSidebar'])

  let tab
  const opened = []
  const sidebar = {
    registerTab(value) { tab = value; return () => {} },
    openTab(value) { opened.push(value) },
  }
  optionalPlugins[0].apply({
    betterSidebar: sidebar,
    effect(effect) { disposers.push(effect()) },
  })
  await Promise.resolve()
  assert.equal(tab.id, 'dsh-agora:dashboard')
  assert.equal(tab.title(), 'Agora 协同')
  assert.equal(tab.single, true)
  assert.equal(typeof tab.component, 'function')
  assert.equal(opened.length, 1)
  assert.equal(opened[0].type, 'dsh-agora:dashboard')
  assert.equal(opened[0].path, 'dsh-agora://dashboard')
  const launcher = nodes.find((node) => node.attributes?.['data-dsh-agora-launcher'] === '')
  assert.equal(launcher.attributes['aria-label'], '打开 Agora 协同')
  launcher.listeners.click()
  assert.equal(opened.length, 2)

  for (const dispose of disposers.reverse()) dispose?.()
})
