import crypto from 'node:crypto'
import { until } from '@vueuse/core'

/**
 * @name 截图
 * @description 截图当前模拟器并回复结果。
 */
export default defineSlashCommand(async () => {
  const { data: tasks } = useMAATasks()

  const id = crypto.randomUUID()

  const idx = tasks.value.push({
    type: 'CaptureImageNow',
    id,
    status: 'PENDING',
  }) - 1

  const task = await until(() => tasks.value[idx]!)
    .toMatch(task => task.status !== 'PENDING', { timeout: 5000, throwOnTimeout: true, deep: true })
    .catch(() => null)

  if (!task || task.status !== 'SUCCESS' || !task.payload) {
    return '截图失败'
  }
  else {
    return reply('截图成功', { files: [task.payload!] })
  }
})
