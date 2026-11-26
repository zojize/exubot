import type { GachaPoolClientData as ClientPool } from 'prts-widgets/widgets/GachaSimulatorV2/gamedata-types'
import type { GachaDBServer, GachaPoolClientData as ServerPool } from 'prts-widgets/widgets/GachaSimulatorV2/types'
import fs from 'node:fs'
import { setTimeout as delay } from 'node:timers/promises'
import { WEEDY_ENDPOINT } from 'prts-widgets/utils/consts'
import { GachaExecutor } from 'prts-widgets/widgets/GachaSimulatorV2/gacha-utils/base'

let characters: Record<string, { name: string }> | undefined
export function readCharacters(): Record<string, { name: string }> {
  if (characters)
    return characters
  const data = fs.readFileSync('data/ArknightsGameResource/gamedata/excel/character_table.json', 'utf-8')
  const json = JSON.parse(data)
  characters = Object.fromEntries(
    Object.entries(json).map(([charId, char]) => [
      charId,
      { name: (char as { name: string }).name },
    ]),
  )
  return characters
}

type Executor = GachaExecutor & { clientPool: ClientPool }
const users = new Map<string, { last: Executor, pools: Map<string, Executor> }>()

type ServerTable = Record<string, ServerPool>
let serverTable: ServerTable | undefined
let pending: Promise<ServerTable> | undefined
let lastFetched = 0
const cacheDuration = 24 * 60 * 60 * 1000

async function loadServerTable() {
  const response = await fetch(new URL('/gacha_table.json', WEEDY_ENDPOINT), {
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok)
    throw new Error(`Could not load gacha pools (HTTP ${response.status})`)

  const data: GachaDBServer = await response.json()
  serverTable = Object.fromEntries(data.gachaPoolClient.map(pool => [pool.gachaPoolId, pool]))
  lastFetched = Date.now()
  return serverTable
}

function getServerTable() {
  if (serverTable && Date.now() - lastFetched < cacheDuration)
    return Promise.resolve(serverTable)

  pending ??= loadServerTable().catch((error) => {
    if (serverTable)
      return serverTable
    throw error
  }).finally(() => {
    pending = undefined
  })
  return pending
}

let clientPools: ClientPool[] | undefined

function getClientPools() {
  if (clientPools)
    return clientPools

  const data = fs.readFileSync('data/ArknightsGameResource/gamedata/excel/gacha_table.json', 'utf-8')
  const { gachaPoolClient }: { gachaPoolClient: ClientPool[] } = JSON.parse(data)
  const nameCounts = new Map<string, number>()
  for (const { gachaPoolName: name } of gachaPoolClient)
    nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1)

  for (const pool of gachaPoolClient) {
    if (nameCounts.get(pool.gachaPoolName)! > 1) {
      const date = new Date(pool.openTime * 1000).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
      pool.gachaPoolName = `${pool.gachaPoolName.replace('适合多种场合的强力干员', '标准寻访')} (${date})`
    }
  }
  clientPools = gachaPoolClient.sort((a, b) => b.openTime - a.openTime)
  return clientPools
}

export async function getGachaExecutor(userId: string, poolId?: string) {
  const tables = await getServerTable()
  const user = users.get(userId)
  if (!poolId && user)
    return user.last

  const clientPool = poolId
    ? getClientPools().find(pool => pool.gachaPoolId === poolId)
    : getClientPools().find(pool => tables[pool.gachaPoolId])
  if (!clientPool)
    return
  const serverPool = tables[clientPool.gachaPoolId]
  if (!serverPool)
    return

  const pools = user?.pools ?? new Map<string, Executor>()
  const executor = pools.get(clientPool.gachaPoolId)
    ?? Object.assign(new GachaExecutor(serverPool, clientPool), { clientPool })
  pools.set(clientPool.gachaPoolId, executor)
  users.set(userId, { last: executor, pools })
  return executor
}

export async function searchGachaPool(query: string) {
  // Autocomplete cannot defer its response while the remote pool metadata loads.
  const loading = getServerTable().catch(() => undefined)
  if (query && !serverTable) {
    await Promise.race([
      loading,
      delay(750, undefined, { ref: false }),
    ])
  }

  const choices: { name: string, value: string }[] = []
  for (const { gachaPoolId: id, gachaPoolName: name } of getClientPools()) {
    if (serverTable && !serverTable[id])
      continue

    let label = name
    if (!label.includes(query)) {
      label = `${name}（${id}）`
      if (!label.includes(query)) {
        const featured = serverTable?.[id]?.gachaPoolDetail.detailInfo.upCharInfo?.perCharList
        if (!featured)
          continue
        const names = featured.flatMap(({ charIdList }) => charIdList.map(id => readCharacters()[id]?.name ?? id))
        label = `${name}（${names.join('，')}）`
        if (!label.includes(query))
          continue
      }
    }

    choices.push({ name: label, value: id })
    if (choices.length === 25)
      break
  }
  return choices
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
  return rarity >= 4
    ? `**${name}**`
    : name
}

export function formatGachaPull(pull: MaybeArray<NonNullable<ReturnType<GachaExecutor['doGachaOnce']>>>) {
  const chars = readCharacters()
  const rows = (Array.isArray(pull)
    ? pull
    : [pull])
    .map(({ charId, rarity }) => ({ name: chars[charId]?.name ?? charId, rarity }))
  const maxLength = Math.max(...rows.map(({ name }) => name.length))
  return rows
    .map(({ name, rarity }) => `${decorateCharName(name, rarity)}${'　'.repeat(maxLength - name.length + 1)}${starVariants[rarity]}`)
    .join('\n')
}
