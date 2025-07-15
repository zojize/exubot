/**
 * @name 寻访一次
 * @description 模拟单次寻访
 */
export default defineSlashCommand(async (pool: string) => {
  describeOption(pool, {
    name: '寻访卡池',
    description: '指定单次寻访的卡池名称。',
    autocomplete: searchGachaPool,
  })

  const interaction = useInteraction()!
  const { gachaServerTable, gachaClientTable } = await getGachaTables()

  const gachaClientPool = gachaClientTable[pool]
  const gachaServerPool = gachaServerTable[pool]

  if (!gachaClientPool || !gachaServerPool) {
    return '未找到指定的寻访卡池，请检查卡池名称是否正确。'
  }

  const userId = interaction.user.id
  const executor = getGachaExecutor(userId, pool, gachaServerPool, gachaClientPool)

  const result = executor.doGachaOnce()

  if (!result) {
    return '寻访卡池剩余抽取次数已耗尽'
  }

  return `本次寻访卡池为：${gachaClientPool.gachaPoolName}
已寻访次数：${executor.state.counter}
你抽到了：${formatGachaPull(result)}`
})
