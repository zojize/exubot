import { Buffer } from 'node:buffer'
import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import puppeteer from 'puppeteer'

/**
 * @name 投骰子
 * @description 模拟投掷骰子。
 */
export default defineSlashCommand(async (n: integer) => {
  describeCommand({ defer: 'public' })
  describeOption(n, {
    name: '骰子个数',
    description: '指定骰子的个数。',
    min: 1,
    max: 6,
  })

  await useInteraction()!.deferReply()
  const { animationGif, rollResult } = await getDiceRollAnimationGif(n)
  return reply
    .file(animationGif)
    .send(`投掷了 ${n} 个骰子，结果是：${rollResult}`)
})

async function getDiceRollAnimationGif(n: number) {
  const browser = await puppeteer.launch({ headless: true })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 400, height: 400 })
    const framesReady = Promise.withResolvers<void>()
    page.on('console', (message) => {
      if (/^Stored \d+ frames/.test(message.text()))
        framesReady.resolve()
    })
    const timeout = setTimeout(() => framesReady.reject(new Error('Timed out waiting for dice frames')), 30_000)
    try {
      const url = `https://dice-roll-demo.netlify.app/?numberOfDice=${n}&storeFrames=true&renderFixedFrames=true&cameraType=orthographic`
      const navigate = () => page.goto(url, { timeout: 10_000 })
      await Promise.all([
        navigate().catch(navigate),
        framesReady.promise,
      ])
    }
    finally {
      clearTimeout(timeout)
    }

    const storedFrames = await page.evaluate('window.storedFrames') as { frame: string, duration: number }[]
    const rollResult = await page.$eval('#simulation-result', el => el.textContent?.trim() ?? '')
    if (!Array.isArray(storedFrames) || storedFrames.length === 0
      || !/^[1-6](?:\+[1-6])*$/.test(rollResult) || rollResult.split('+').length !== n) {
      throw new Error('Dice renderer returned an invalid roll')
    }

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'puppeteer-frames-'))
    try {
      const concat = []
      for (const [i, { frame, duration }] of storedFrames.entries()) {
        const file = `frame-${String(i).padStart(3, '0')}.png`
        await fs.writeFile(path.join(tempDir, file), Buffer.from(frame.replace(/^data:image\/png;base64,/, ''), 'base64'))
        concat.push(`file '${file}'`, `duration ${duration / 1000}`)
      }
      concat.push(`file 'frame-${String(storedFrames.length - 1).padStart(3, '0')}.png'`)
      await fs.writeFile(path.join(tempDir, 'frames.txt'), concat.join('\n'))
      const ffmpeg = promisify(execFile)
      const options = { cwd: tempDir, timeout: 60_000 }
      await ffmpeg('ffmpeg', [
        '-loglevel',
        'error',
        '-i',
        'frame-%03d.png',
        '-vf',
        'palettegen=reserve_transparent=1',
        'palette.png',
      ], options)
      await ffmpeg('ffmpeg', [
        '-loglevel',
        'error',
        '-f',
        'concat',
        '-i',
        'frames.txt',
        '-i',
        'palette.png',
        '-loop',
        '1',
        '-lavfi',
        'paletteuse',
        '-gifflags',
        '-offsetting',
        'roll.gif',
      ], options)
      return {
        animationGif: { name: `dice_roll_${n}_${rollResult}.gif`, attachment: await fs.readFile(path.join(tempDir, 'roll.gif')) },
        rollResult,
      }
    }
    finally {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  }
  finally {
    await browser.close()
  }
}
