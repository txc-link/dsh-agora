import { copyFile, mkdir, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = resolve(root, 'client/index.js')
const output = resolve(root, 'lib/client.js')
const text = await readFile(source, 'utf8')

if (!text.includes("window.__ModuleLoader__.load({ id: 'dsh-agora'")) {
  throw new Error('dsh-agora client source does not declare its module-loader id')
}
if (/from\s+['"]node:|require\(['"]node:/u.test(text)) {
  throw new Error('dsh-agora browser client must not import Node.js built-ins')
}

await mkdir(dirname(output), { recursive: true })
await copyFile(source, output)
console.log(`Wrote ${output}`)
