import type { Snowflake } from 'discord.js'
import type { GachaData, GachaPoolClientData } from 'prts-widgets/widgets/GachaSimulatorV2/gamedata-types'
import type { GachaDBServer } from 'prts-widgets/widgets/GachaSimulatorV2/types'
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

let gachaServerTable: GachaDBServer | undefined
let lastFetched = 0
const cacheDuration = 24 * 1000 * 60 * 60 // 24 hours

export async function getGachaTables(): Promise<{
  gachaClientTable: GachaData
  gachaServerTable: GachaDBServer
}> {
  if (gachaServerTable && gachaClientTable && Date.now() - lastFetched < cacheDuration) {
    return { gachaServerTable, gachaClientTable: gachaClientTable as unknown as GachaData }
  }

  lastFetched = Date.now()
  gachaServerTable = await fetch(
    new URL('/gacha_table.json', WEEDY_ENDPOINT),
  ).then(res => res.json())

  return {
    gachaServerTable: gachaServerTable!,
    gachaClientTable: gachaClientTable as unknown as GachaData,
  }
}

let processedGachaTable: ReturnType<typeof processGachaTable> | undefined
export function processGachaTable(table: GachaData): Record<string, GachaPoolClientData[]> {
  const res = table
    .gachaPoolClient
    .reduce((acc, pool) => {
      if (!acc[pool.gachaPoolName]) {
        acc[pool.gachaPoolName] = []
      }
      acc[pool.gachaPoolName].push(pool)
      return acc
    }, {} as Record<string, GachaPoolClientData[]>)

  for (const pools of Object.values(res)) {
    if (pools.length > 1) {
      for (const pool of pools) {
        pool.gachaPoolName = `${pool.gachaPoolName.replace('适合多种场合的强力干员', '标准寻访')} (${
          new Date(pool.openTime * 1000).toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        })`
      }
      pools.sort((a, b) => b.openTime - a.openTime)
    }
  }

  return res
}

let sortedGachaPools: GachaPoolClientData[] | undefined
export function getSortedGachaPools(): GachaPoolClientData[] {
  processedGachaTable ??= processGachaTable(gachaClientTable as unknown as GachaData)
  sortedGachaPools ??= Object.values(processedGachaTable).flatMap(p => p).sort((a, b) => b.openTime - a.openTime)
  return sortedGachaPools
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

export function formatGachaPull(pull: MaybeArray<NonNullable<ReturnType<GachaExecutor['doGachaOnce']>>>) {
  if (Array.isArray(pull)) {
    const names = pull.map(pull => (characters as Record<string, { name: string }>)[pull.charId]!.name)
    const maxLength = Math.max(...names.map(name => name.length))

    return names.map((name, i) => `${
      pull[i].rarity >= 4 ? '**' : ''
    }${name}${
      pull[i].rarity >= 4 ? '**' : ''
    }${'　'.repeat(maxLength - name.length)
    }${'　'}${starVariants[pull[i].rarity]}`)
      .join('\n')
  }
  else {
    const char = (characters as Record<string, { name: string }>)[pull.charId]!
    const stars = starVariants[pull.rarity]
    return `${pull.rarity >= 4 ? '**' : ''}${char.name}${pull.rarity >= 4 ? '**' : ''}${'　'}${stars}`
  }
}
