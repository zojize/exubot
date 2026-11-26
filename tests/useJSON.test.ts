import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { effectScope, nextTick } from 'vue'
import { useJSON } from '../server/utils/useJSON.ts'

test('the shared queue keeps saving after the first command scope ends', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'exubot-queue-'))
  const filename = join(dir, 'tasks.json')
  const command = effectScope()
  const queue = command.run(() => useJSON<string[]>(filename, []))!
  t.after(() => {
    command.stop()
    queue.stop()
    rmSync(dir, { recursive: true, force: true })
  })

  queue.data.value.push('first')
  await nextTick()
  command.stop()

  useJSON<string[]>(filename, []).data.value.push('second')
  await nextTick()
  assert.deepEqual(JSON.parse(readFileSync(filename, 'utf8')), ['first', 'second'])
})

test('the queue survives an invalid edit or removal and reloads corrected data', { timeout: 5000 }, async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'exubot-queue-'))
  const filename = join(dir, 'tasks.json')
  const queue = useJSON(filename, ['first'])
  t.after(() => {
    queue.stop()
    rmSync(dir, { recursive: true, force: true })
  })
  await once(queue.watcher, 'ready')

  const invalid = once(queue.watcher, 'change')
  writeFileSync(filename, '{')
  await invalid
  assert.ok(queue.error.value instanceof SyntaxError)
  assert.deepEqual(queue.data.value, ['first'])

  const corrected = once(queue.watcher, 'change')
  const content = '[ "second" ]\n'
  writeFileSync(filename, content)
  await corrected
  await nextTick()
  assert.equal(queue.error.value, undefined)
  assert.deepEqual(queue.data.value, ['second'])
  assert.equal(readFileSync(filename, 'utf8'), content)

  const removed = once(queue.watcher, 'unlink')
  unlinkSync(filename)
  await removed
  queue.data.value.push('third')
  await nextTick()
  assert.deepEqual(JSON.parse(readFileSync(filename, 'utf8')), ['second', 'third'])
})
