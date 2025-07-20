/**
 * @name 寻访十次
 * @description 模拟十连寻访
 */
export default defineSlashCommand((pool?: string) => {
  describeOption(pool, {
    name: '寻访卡池',
    description: '指定十连寻访的卡池名称。',
    autocomplete: searchGachaPool,
  })

  const interaction = useInteraction()!
  const userId = interaction.user.id
  const { gachaServerTable, gachaClientTable } = getGachaTables()

  let executor: ReturnType<typeof getMostRecentGachaExecutor>

  if (!pool) {
    executor = getMostRecentGachaExecutor(userId)
  }
  else {
    const gachaClientPool = gachaClientTable[pool]
    const gachaServerPool = gachaServerTable[pool]

    if (!gachaClientPool || !gachaServerPool) {
      return '未找到指定的寻访卡池，请检查卡池名称是否正确。'
    }

    executor = getGachaExecutor(userId, pool)
  }

  const results: NonNullable<ReturnType<typeof executor['doGachaOnce']>>[] = []

  for (let i = 0; i < 10; i++) {
    const result = executor.doGachaOnce()
    if (!result && i === 0) {
      return '寻访卡池剩余抽取次数已耗尽'
    }
    else if (!result) {
      break
    }
    results.push(result)
  }

  return `本次寻访卡池为：${executor.clientPool.gachaPoolName}
已寻访次数：${executor.state.counter}
${formatGachaPull(results)}`
})
