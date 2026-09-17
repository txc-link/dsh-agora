import test from 'node:test'
import assert from 'node:assert/strict'
import { formatExternalRuntimePrompt } from '../lib/runtime-prompt.js'

test('runtime prompt preserves the task and adds execution contract', () => {
  const prompt = formatExternalRuntimePrompt({
    id: 'dispatch-1',
    node_id: 'node-home-linux',
    runtime_target_ref: 'dsh:node-home-linux:default',
    task_id: null,
    workspace_alias: null,
    idempotency_key: 'once',
    prompt: '去 Obsidian 查不同主机的 SSH 元数据，并把安全字段写入记忆。',
  })

  assert.match(prompt, /Execute it first; do not rewrite it as a dispatch audit/u)
  assert.match(prompt, /URL, API token, host_id, and vault path are bridge\/runtime details/u)
  assert.match(prompt, /never expose or persist passwords, private keys, or access tokens/u)
  assert.match(prompt, /Markdown document for structured results/u)
  assert.match(prompt, /去 Obsidian 查不同主机的 SSH 元数据，并把安全字段写入记忆。$/u)
})
