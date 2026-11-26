import crypto from 'node:crypto'
import { until } from '@vueuse/core'

/**
 * @name 截图
 * @description 截图当前模拟器并回复结果。
 */
export default defineSlashCommand(async () => {
  const { data: tasks } = useMAATasks()

  const id = crypto.randomUUID()

  tasks.value.push({
    type: 'CaptureImageNow',
    id,
    status: 'PENDING',
  })

  const task = await until(() => tasks.value.find(task => task.id === id && task.status !== 'PENDING'))
    .toMatch(Boolean, { timeout: 5000 })

  if (task?.status !== 'SUCCESS' || !task.payload) {
    return '截图失败'
  }
  return reply('截图成功', {
    files: [task.payload],
  })
})
