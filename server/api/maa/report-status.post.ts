import { Buffer } from 'node:buffer'
import fs from 'node:fs'

export default defineEventHandler(async (event) => {
  const body = await readBody<MaaStatusReport>(event)
  const { data } = useMAATasks()

  const task = data.value.find(task => task.id === body.task)

  if (!task) {
    return
  }

  if (task.type.startsWith('CaptureImage')) {
    if (!body.payload) {
      task.status = 'FAILURE'
      return
    }

    const imagePath = `data/images/${task.id}.payload.jpeg`
    const buffer = Buffer.from(body.payload, 'base64')
    fs.mkdirSync('data/images', { recursive: true })
    fs.writeFileSync(imagePath, buffer)
    task.status = 'SUCCESS'
    task.payload = imagePath
    return
  }

  task.status = body.status
  task.payload = body.payload
})
