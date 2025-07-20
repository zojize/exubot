import type { Snowflake } from 'discord.js'
import type { GachaPoolClientData as ClientPool } from 'prts-widgets/widgets/GachaSimulatorV2/gamedata-types'
import type { GachaDBServer, GachaPoolClientData as SeverPool } from 'prts-widgets/widgets/GachaSimulatorV2/types'
import fs from 'node:fs'
import { WEEDY_ENDPOINT } from 'prts-widgets/utils/consts'
import { GachaExecutor } from 'prts-widgets/widgets/GachaSimulatorV2/gacha-utils/base'
import request from 'sync-request'

let characters: Record<string, { name: string }> | undefined
export function readCharacters(): Record<string, { name: string }> {
  if (characters)
    return characters
  const data = fs.readFileSync('data/ArknightsGameResource/gamedata/excel/character_table.json', 'utf-8')
  const json = JSON.parse(data)
  characters = Object.fromEntries(
    Object.entries(json).map(([charId, char]) => [charId, { name: (char as { name: string }).name }]),
  )
  return characters
}

// TODO: keep tack of gacha history
const gachaExecutors: Record<
  Snowflake,
  Record<string, {
    timestamp: number
    executor: GachaExecutor & {
      serverPool: SeverPool
      clientPool: NonNullable<typeof sortedGachaPools>[number]
    }
  }>
> = {}

export function getMostRecentGachaExecutor(id: Snowflake) {
  const userGacha = gachaExecutors[id]
  if (!userGacha || Object.keys(userGacha).length === 0) {
    const sortedPools = getSortedGachaPools()
    let mostRecentPool!: ClientPool
    let max = -Infinity
    for (const pool of sortedPools) {
      if (pool.openTime > max) {
        max = pool.openTime
        mostRecentPool = pool
      }
    }
    return getGachaExecutor(id, mostRecentPool.gachaPoolId)
  }
  let max = -Infinity
  let mostRecent!: ReturnType<typeof getGachaExecutor>
  for (const { timestamp, executor } of Object.values(userGacha)) {
    if (timestamp > max) {
      max = timestamp
      mostRecent = executor
    }
  }
  return mostRecent
}

export function getGachaExecutor(id: Snowflake, poolId: string) {
  gachaExecutors[id] ??= {}
  const { gachaServerTable, gachaClientTable } = getGachaTables()
  gachaExecutors[id][poolId] ??= {
    timestamp: Date.now(),
    executor: Object.assign(
      new GachaExecutor(gachaServerTable[poolId], gachaClientTable[poolId]),
      { serverPool: gachaServerTable[poolId], clientPool: gachaClientTable[poolId]! as any },
    ),
  }
  gachaExecutors[id][poolId].timestamp = Date.now()
  return gachaExecutors[id][poolId].executor
}

let gachaServerTable: Record<string, SeverPool> | undefined
let processedClientTable: Record<string, ClientPool> | undefined
let lastFetched = 0
const cacheDuration = 24 * 1000 * 60 * 60 // 24 hours

export function readClientGachaTable(): Record<string, ClientPool> {
  if (processedClientTable)
    return processedClientTable
  const data = fs.readFileSync('data/ArknightsGameResource/gamedata/excel/gacha_table.json', 'utf-8')
  const json = JSON.parse(data)
  processedClientTable = Object.fromEntries(
    json.gachaPoolClient.map((pool: ClientPool) => [pool.gachaPoolId, pool]),
  )
  return processedClientTable
}

export function getGachaTables(): {
  gachaClientTable: Record<string, ClientPool>
  gachaServerTable: Record<string, SeverPool>
} {
  if (gachaServerTable && processedClientTable && Date.now() - lastFetched < cacheDuration) {
    return { gachaServerTable, gachaClientTable: processedClientTable }
  }

  lastFetched = Date.now()
  gachaServerTable = Object.fromEntries(
    (JSON.parse(
      request('GET', new URL('/gacha_table.json', WEEDY_ENDPOINT).toJSON()).getBody('utf-8'),
    ) as GachaDBServer).gachaPoolClient.map(pool => [pool.gachaPoolId, pool]),
  )

  return {
    gachaServerTable: gachaServerTable!,
    gachaClientTable: readClientGachaTable(),
  }
}

export function processGachaTable() {
  const { gachaClientTable, gachaServerTable } = getGachaTables()
  const res = Object.values(gachaClientTable)
    .reduce((acc, pool) => {
      if (!acc[pool.gachaPoolName]) {
        acc[pool.gachaPoolName] = []
      }
      acc[pool.gachaPoolName].push(pool as any)
      return acc
    }, {} as Record<string, (ClientPool & { gachaPoolSearchNames: string[] })[]>)

  for (const pools of Object.values(res)) {
    for (const pool of pools) {
      const poolName = pools.length > 1
        ? `${pool.gachaPoolName.replace('适合多种场合的强力干员', '标准寻访')} (${
          new Date(pool.openTime * 1000).toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        })`
        : pool.gachaPoolName
      if (pools.length > 1) {
        pool.gachaPoolName = poolName
      }
      pool.gachaPoolSearchNames = [
        poolName,
        `${poolName}（${pool.gachaPoolId}）`,
        ...gachaServerTable[pool.gachaPoolId]?.gachaPoolDetail.detailInfo.upCharInfo
          ? [
              `${poolName}（${gachaServerTable[pool.gachaPoolId].gachaPoolDetail.detailInfo.upCharInfo.perCharList
                .flatMap(({ charIdList }) => charIdList.map(charId => readCharacters()[charId]!.name))
                .join('，')}）`,
            ]
          : [],
      ]
    }
    pools.sort((a, b) => b.openTime - a.openTime)
  }

  return res
}

let processedGachaTable: ReturnType<typeof processGachaTable> | undefined
let sortedGachaPools: ReturnType<typeof processGachaTable>[string][number][] | undefined
export function getSortedGachaPools() {
  processedGachaTable ??= processGachaTable()
  sortedGachaPools ??= Object.values(processedGachaTable).flatMap(p => p).sort((a, b) => b.openTime - a.openTime)
  return sortedGachaPools
}

export function searchGachaPool(query: string) {
  return Iterator.from(sortedGachaPools ?? getSortedGachaPools())
    .flatMap((pool) => {
      const searchName = pool.gachaPoolSearchNames.find(name => name.includes(query))
      return searchName ? [{ name: searchName, value: pool.gachaPoolId }] : []
    })
    .take(25)
    .toArray()
}

type MaybeArray<T> = T | T[]
const starVariants = [
  '☆',
  '☆☆',
  '☆☆☆',
  '★★★★',
  '⭐⭐⭐⭐⭐',
  '🌟🌟🌟🌟🌟🌟',
]

function decorateCharName(name: string, rarity: number) {
  return rarity >= 4 ? `**${name}**` : name
}

export function formatGachaPull(pull: MaybeArray<NonNullable<ReturnType<GachaExecutor['doGachaOnce']>>>) {
  if (Array.isArray(pull)) {
    const names = pull.map(pull => readCharacters()[pull.charId]!.name)
    const maxLength = Math.max(...names.map(name => name.length))

    return names
      .map((name, i) => `${decorateCharName(name, pull[i].rarity)}${'　'.repeat(maxLength - name.length)}${'　'}${starVariants[pull[i].rarity]}`)
      .join('\n')
  }
  else {
    const char = readCharacters()[pull.charId]!
    const stars = starVariants[pull.rarity]
    return `${decorateCharName(char.name, pull.rarity)}${'　'}${stars}`
  }
}
