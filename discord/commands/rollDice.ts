import { execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import puppeteer from 'puppeteer'

/**
 * @name 投骰子
 * @description 模拟投掷骰子。
 */
export default defineSlashCommand(async (n: integer) => {
  describeOption(n, {
    name: '骰子个数',
    description: '指定骰子的个数。',
    min: 1,
    max: 6,
  })

  const [animationGif, rollResult] = await getDiceRollAnimationGif(n)
  return reply
    .file(animationGif)
    .send(`投掷了 ${n} 个骰子，结果是：${rollResult}`)
})

async function getDiceRollAnimationGif(n: number) {
  type FrameData = [string, number] // [filename, duration in seconds]

  // Create a temporary directory for this session
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'puppeteer-frames-'))
  const framesDir = path.join(tempDir, 'frames')

  const browser = await puppeteer.launch({ headless: true })
  const page = await browser.newPage()
  const { resolve, promise } = Promise.withResolvers<void>()
  page.on('console', (msg) => {
    if (msg.text().includes('Stored'))
      resolve()
  })
  await page.setViewport({ width: 400, height: 400 })
  let gotoAttempts = 0
  let failed = true
  while (gotoAttempts < 2) {
    try {
      await page.goto(`https://dice-roll-demo.netlify.app/?numberOfDice=${n}&storeFrames=true&renderFixedFrames=true&cameraType=orthographic`, { timeout: 5000 })
      failed = false
      break
    }
    catch {
      gotoAttempts++
      console.warn(`Attempt ${gotoAttempts} to navigate to dice roll simulation page failed, retrying...`)
    }
  }
  if (failed) {
    console.error('Failed to navigate to dice roll simulation page after 5 attempts, retrying with a new browser instance...')
    await browser.close()
    return getDiceRollAnimationGif(n)
  }
  await promise
  const storedFrames = await page.evaluate(`window.storedFrames`) as { frame: string, duration: number }[]
  const rollResult: string = await (await page.waitForSelector('#simulation-result'))?.evaluate(el => el.textContent?.trim())

  fs.mkdirSync(framesDir, { recursive: true })

  let i = 0
  const framesData: FrameData[] = []
  for (const { frame: frameData, duration } of storedFrames) {
    const fileName = path.join(framesDir, `frame-${(i++).toString().padStart(3, '0')}.png`)
    const base64Data = frameData
      .replace(/^data:image\/png;base64,/, '')
    fs.writeFileSync(
      fileName,
      base64Data,
      'base64',
    )
    framesData.push([fileName, duration / 1000])
    // console.log(`Saved frame: ${fileName}`)
  }

  // console.log('Frames:', res.length)
  const outputGifPath = `data/dice_roll_${n}_${rollResult}.gif`

  try {
    createVideoFromFrames(framesData, outputGifPath, tempDir)
  }
  finally {
    fs.rmSync(tempDir, { recursive: true })
    await browser.close()
  }

  return [outputGifPath, rollResult]

  function createVideoFromFrames(
    frames: FrameData[],
    outputGifPath: string,
    tempDir: string,
  ) {
    // Create concat file content
    let concatFileContent = ''
    for (let i = 0; i < frames.length; i++) {
      const [filename, duration] = frames[i]!
      concatFileContent += `file '${filename}'\n`
      // For all but the last frame, specify duration
      if (i < frames.length - 1 && duration != null) {
        concatFileContent += `duration ${duration}\n`
      }
    }
    // Repeat last file without duration to ensure last frame is shown
    concatFileContent += `file '${frames[frames.length - 1]![0]}'\n`

    // Write concat file in temp directory
    const concatFilePath = path.join(tempDir, 'frames.txt')
    fs.writeFileSync(concatFilePath, concatFileContent)

    // Create palette file in temp directory
    const paletteFilePath = path.join(tempDir, 'palette.png')
    const framesPattern = path.join(tempDir, 'frames', 'frame-%03d.png')

    execSync(`ffmpeg -y -i "${framesPattern}" -vf palettegen=reserve_transparent=1 "${paletteFilePath}"`, { stdio: 'inherit' })
    execSync(`ffmpeg -y -f concat -safe 0 -i "${concatFilePath}" -i "${paletteFilePath}" -loop -1 -lavfi paletteuse -gifflags -offsetting "${outputGifPath}"`, { stdio: 'inherit' })
  }
}
