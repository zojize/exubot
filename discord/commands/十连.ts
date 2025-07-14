/**
 * @name 十连
 * @description 模拟十连抽
 */
export default defineSlashCommand(async (pool: string) => {
  describeOption(pool, {
    name: '池子',
    description: '指定十连抽的池子名称。',
    autocomplete: (query) => {
      return Iterator.from(getSortedGachaPools())
        .filter(pool => pool.gachaPoolName.includes(query.toLowerCase()))
        .map(pool => ({ name: pool.gachaPoolName, value: pool.gachaPoolId }))
        .take(25)
        .toArray()
    },
  })

  const interaction = useInteraction()!
  const { gachaServerTable, gachaClientTable } = await getGachaTables()

  const gachaClientPool = gachaClientTable.gachaPoolClient.find(
    poolData => poolData.gachaPoolId === pool,
  )
  const gachaServerPool = gachaServerTable.gachaPoolClient.find(
    poolData => poolData.gachaPoolId === pool,
  )

  if (!gachaClientPool || !gachaServerPool) {
    return '未找到指定的池子，请检查池子名称是否正确。'
  }

  const userId = interaction.user.id
  const executor = getGachaExecutor(userId, pool, gachaServerPool, gachaClientPool)

  const results: NonNullable<ReturnType<typeof executor['doGachaOnce']>>[] = []

  for (let i = 0; i < 10; i++) {
    const result = executor.doGachaOnce()
    if (!result && i === 0) {
      return '池子剩余抽取次数已耗尽'
    }
    else if (!result) {
      break
    }
    results.push(result)
  }

  return formatGachaPull(results)
})
