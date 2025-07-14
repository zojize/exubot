import type { Snowflake } from 'discord.js'
import type { GachaPoolClientData as ClientPool } from 'prts-widgets/widgets/GachaSimulatorV2/gamedata-types'
import type { GachaDBServer, GachaPoolClientData as SeverPool } from 'prts-widgets/widgets/GachaSimulatorV2/types'
import { WEEDY_ENDPOINT } from 'prts-widgets/utils/consts'
import { GachaExecutor } from 'prts-widgets/widgets/GachaSimulatorV2/gacha-utils/base'
import characters from '~~/data/ArknightsGameResource/gamedata/excel/character_table.json'
import gachaClientTable from '~~/data/ArknightsGameResource/gamedata/excel/gacha_table.json'

const gachaExecutors: Record<Snowflake, Record<string, GachaExecutor>> = {}
//                           ^ userId          ^ poolId

export function getGachaExecutor(id: Snowflake, poolId: string, ...args: ConstructorParameters<typeof GachaExecutor>): GachaExecutor {
  gachaExecutors[id] ??= {}
  return gachaExecutors[id][poolId] ??= new GachaExecutor(...args)
}

let gachaServerTable: Record<string, SeverPool> | undefined
let processedClientTable: Record<string, ClientPool> | undefined
let lastFetched = 0
const cacheDuration = 24 * 1000 * 60 * 60 // 24 hours

export async function getGachaTables(): Promise<{
  gachaClientTable: Record<string, ClientPool>
  gachaServerTable: Record<string, SeverPool>
}> {
  if (gachaServerTable && processedClientTable && Date.now() - lastFetched < cacheDuration) {
    return { gachaServerTable, gachaClientTable: processedClientTable }
  }

  lastFetched = Date.now()
  gachaServerTable = await fetch(
    new URL('/gacha_table.json', WEEDY_ENDPOINT),
  )
    .then(res => (res.json() as Promise<GachaDBServer>))
    .then(data => Object.fromEntries(data.gachaPoolClient.map(pool => [pool.gachaPoolId, pool])))
  processedClientTable = Object.fromEntries(
    gachaClientTable.gachaPoolClient.map(pool => [pool.gachaPoolId, pool as any]),
  )

  return {
    gachaServerTable: gachaServerTable!,
    gachaClientTable: processedClientTable,
  }
}

export async function processGachaTable() {
  const { gachaClientTable, gachaServerTable } = await getGachaTables()
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
                .flatMap(({ charIdList }) => charIdList.map(charId => (characters as Record<string, { name: string }>)[charId]!.name))
                .join('，')}）`,
            ]
          : [],
      ]
    }
    pools.sort((a, b) => b.openTime - a.openTime)
  }

  return res
}

let processedGachaTable: Awaited<ReturnType<typeof processGachaTable>> | undefined
let sortedGachaPools: (Awaited<ReturnType<typeof processGachaTable>>[string][number])[] | undefined
export async function getSortedGachaPools() {
  processedGachaTable ??= await processGachaTable()
  sortedGachaPools ??= Object.values(processedGachaTable).flatMap(p => p).sort((a, b) => b.openTime - a.openTime)
  return sortedGachaPools
}

export async function searchGachaPool(query: string) {
  return Iterator.from(sortedGachaPools ?? await getSortedGachaPools())
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
    const names = pull.map(pull => (characters as Record<string, { name: string }>)[pull.charId]!.name)
    const maxLength = Math.max(...names.map(name => name.length))

    return names
      .map((name, i) => `${decorateCharName(name, pull[i].rarity)}${'　'.repeat(maxLength - name.length)}${'　'}${starVariants[pull[i].rarity]}`)
      .join('\n')
  }
  else {
    const char = (characters as Record<string, { name: string }>)[pull.charId]!
    const stars = starVariants[pull.rarity]
    return `${decorateCharName(char.name, pull.rarity)}${'　'}${stars}`
  }
}
