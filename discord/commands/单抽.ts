/**
 * @name 单抽
 * @description 模拟单抽
 */
export default defineSlashCommand(async (pool: string) => {
  describeOption(pool, {
    name: '池子',
    description: '指定单抽的池子名称。',
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

  const result = executor.doGachaOnce()

  if (!result) {
    return '池子剩余抽取次数已耗尽'
  }

  return `你抽到了：${formatGachaPull(result)}！`
})
