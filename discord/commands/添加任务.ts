import crypto from 'node:crypto'
import { until } from '@vueuse/core'

/**
 * @name 添加任务
 * @description 添加一个远程任务到任务列表中。
 */
export default defineSlashCommand(async function* (type: string, params?: string) {
  describeOption(type, {
    name: '类型',
    description: '远程任务类型。',
    choices: [
      { name: '一键长草', value: 'LinkStart' },
      { name: '基建换班', value: 'LinkStart-Base' },
      { name: '开始唤醒', value: 'LinkStart-WakeUp' },
      { name: '刷理智', value: 'LinkStart-Combat' },
      { name: '自动公招', value: 'LinkStart-Recruiting' },
      { name: '收取信用及购物', value: 'LinkStart-Mall' },
      { name: '领取奖励', value: 'LinkStart-Mission' },
      { name: '自动肉鸽', value: 'LinkStart-AutoRoguelike' },
      { name: '生息演算', value: 'LinkStart-Reclamation' },
      { name: '单抽', value: 'Toolbox-GachaOnce' },
      { name: '十连', value: 'Toolbox-GachaTenTimes' },
      { name: '截图', value: 'CaptureImage' },
      { name: '设置连接地址', value: 'Settings-ConnectAddress' },
      // { name: '设置???', value: 'Settings-Stage1' },
      { name: '立刻截图', value: 'CaptureImageNow' },
      { name: '结束当前任务', value: 'StopTask' },
      { name: '心跳', value: 'HeartBeat' },
    ],
  })

  describeOption(params, {
    name: '参数',
    description: '任务参数（可选），用于设置个别任务的具体参数。',
  })

  const { data } = useMAATasks()

  const id = crypto.randomUUID()

  const idx = data.value.length

  if (type.startsWith('Settings-')) {
    data.value.push({
      type: type as MaaSettingsTask['type'],
      id,
      params: params || '',
      status: 'PENDING',
    })
  }
  else {
    data.value.push({
      type: type as Exclude<MaaTaskType, MaaSettingsTask['type']>,
      id,
      status: 'PENDING',
    })
  }

  yield `任务已添加, ID: ${id}`

  const task = await until(() => data.value[idx])
    .toMatch(task => task.status !== 'PENDING')

  if (!task) {
    return '任务因未知原因添加失败，可能是服务器未响应或任务超时。'
  }

  return `任务已完成，状态: ${task.status}\n${task.payload?.length ? `结果: ${task.payload}` : ''}`
})
