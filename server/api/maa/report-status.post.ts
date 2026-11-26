import { Buffer } from 'node:buffer'
import fs from 'node:fs'

const pngSignature = Buffer.from('89504e470d0a1a0a', 'hex')
const pngEnd = Buffer.from('0000000049454e44ae426082', 'hex')

function imageExtension(buffer: Buffer) {
  if (buffer.subarray(0, 8).equals(pngSignature) && buffer.subarray(-12).equals(pngEnd)) {
    return 'png'
  }
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF && buffer.at(-2) === 0xFF && buffer.at(-1) === 0xD9) {
    return 'jpeg'
  }
}

export default defineEventHandler(async (event) => {
  const body = await readBody<MaaStatusReport>(event)
  const { data } = useMAATasks()

  const task = data.value.find(task => task.id === body.task)

  if (!task) {
    return
  }

  if (task.type.startsWith('CaptureImage') && body.status === 'SUCCESS') {
    const buffer = Buffer.from(typeof body.payload === 'string'
      ? body.payload
      : '', 'base64')
    const extension = imageExtension(buffer)
    if (!extension) {
      delete task.payload
      task.status = 'FAILED'
      return
    }

    const imagePath = `data/images/${task.id}.payload.${extension}`
    fs.mkdirSync('data/images', { recursive: true })
    fs.writeFileSync(imagePath, buffer)
    task.payload = imagePath
    task.status = 'SUCCESS'
    return
  }

  task.status = body.status
  task.payload = body.payload
})
