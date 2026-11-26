import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { copyFile, mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { test as nodeTest } from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'

const root = resolve(import.meta.dirname, '..')
const host = '127.0.0.1'

nodeTest('gacha counts survive a command edit with widget and Nitro imports', async () => {
  const app = await mkdtemp(join(tmpdir(), 'exubot-gacha-'))
  let dev
  let stopped
  let log = ''

  try {
    const socket = createServer().listen(0, host)
    await once(socket, 'listening')
    const origin = `http://${host}:${socket.address().port}`
    await new Promise(resolve => socket.close(resolve))

    const excel = 'data/ArknightsGameResource/gamedata/excel'
    for (const path of [
      'discord/commands',
      'server/utils',
      'public',
      excel,
    ])
      await mkdir(join(app, path), { recursive: true })
    for (const path of ['discord/commands/1pull.ts', 'discord/commands/10pull.ts', 'server/utils/gacha.ts'])
      await copyFile(join(root, path), join(app, path))
    const modules = join(app, 'node_modules')
    await mkdir(modules)
    for (const name of await readdir(join(root, 'node_modules'))) {
      if (!name.startsWith('.'))
        await symlink(join(root, 'node_modules', name), join(modules, name), 'dir')
    }

    const write = (path, data) => writeFile(join(app, path), data)
    await write('package.json', '{"type":"module","private":true}')
    await write('app.vue', '<template><div /></template>')
    await write('pool-endpoint.mjs', `export const WEEDY_ENDPOINT = ${JSON.stringify(origin)}`)
    await write('nuxt.config.ts', `export default defineNuxtConfig({
      modules: ['nuxt-discord'],
      compatibilityDate: '2026-11-01',
      devtools: { enabled: false },
      discord: { autoStart: false, watch: { enabled: true, hostname: '${host}', port: 0, sync: false } },
      alias: {
        'prts-widgets/utils/consts': ${JSON.stringify(join(app, 'pool-endpoint.mjs'))},
        'prts-widgets': ${JSON.stringify(join(root, 'deps/prts-widgets/src'))},
      },
    })`)
    await write(`${excel}/character_table.json`, JSON.stringify({
      operator: { name: 'Operator' },
    }))
    const pool = {
      gachaPoolId: 'test',
      gachaPoolName: 'Pool',
      openTime: 0,
      gachaRuleType: 'NORMAL',
      guarantee5Avail: 0,
    }
    await write(`${excel}/gacha_table.json`, JSON.stringify({
      gachaPoolClient: [pool],
    }))
    const availCharInfo = {
      perAvailList: [
        {
          rarityRank: 3,
          totalPercent: 1,
          charIdList: ['operator'],
        },
      ],
    }
    const gachaPoolDetail = {
      detailInfo: {
        availCharInfo,
        upCharInfo: { perCharList: [] },
      },
    }
    await write('public/gacha_table.json', JSON.stringify({
      gachaPoolClient: [
        { gachaPoolId: pool.gachaPoolId, gachaPoolDetail },
      ],
    }))

    dev = spawn(process.execPath, [
      join(root, 'node_modules/nuxt/bin/nuxt.mjs'),
      'dev',
      '--no-fork',
      '--host',
      host,
      '--port',
      new URL(origin).port,
    ], {
      cwd: app,
      env: {
        ...process.env,
        DISCORD_TOKEN: 'test',
        DISCORD_CLIENT_ID: '100000000000000000',
        NUXT_TELEMETRY_DISABLED: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    stopped = once(dev, 'exit')
    for (const stream of [dev.stdout, dev.stderr])
      stream.on('data', (data) => { log = (log + data).slice(-12000) })

    const api = `${origin}/api/discord/slash-command`
    async function waitForDescription(description) {
      const deadline = Date.now() + 60_000
      while (Date.now() < deadline && dev.exitCode === null) {
        const catalog = await fetch(`${api}/all`, {
          signal: AbortSignal.timeout(3000),
        }).then(r => r.json()).catch(() => null)
        if (catalog?.commands?.some(command => command.name === '寻访一次' && command.description === description))
          return
        await delay(150)
      }
      assert.fail(`Waiting for command description "${description}" failed.\n${log}`)
    }

    async function pull(name, count) {
      const res = await fetch(`${api}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
        signal: AbortSignal.timeout(10_000),
      })
      const result = await res.json()
      assert.equal(result.ok, true, result.error ?? log)
      assert.match(result.response, new RegExp(`已寻访次数：${count}\\n`))
      assert.match(result.response, /Operator/)
      return result.response
    }

    const description = '模拟单次寻访'
    await waitForDescription(description)
    await pull('寻访一次', 1)
    await pull('寻访十次', 11)

    const single = join(app, 'discord/commands/1pull.ts')
    const before = await readFile(single, 'utf8')
    const edited = before.replace(description, 'Edited pull').replace('return `本次寻访', `if (!(executor instanceof WidgetExecutor)) throw new Error('Widget alias changed identity')
      const store = storage('data')
      await store.setItem('proof', 'Edited reply')
      return \`\${await store.getItem('proof')}\\n本次寻访`)
    await writeFile(single, `import { GachaExecutor as WidgetExecutor } from 'prts-widgets/widgets/GachaSimulatorV2/gacha-utils/base'
import { useStorage as storage } from '#imports'
${edited}`)

    await waitForDescription('Edited pull')
    assert.match(await pull('寻访一次', 12), /^Edited reply\n/)
    await pull('寻访十次', 22)
  }
  finally {
    if (dev && dev.exitCode === null)
      dev.kill()
    if (stopped)
      await stopped
    await rm(app, { recursive: true, force: true })
  }
})
