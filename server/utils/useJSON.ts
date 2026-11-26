import type { Ref } from 'vue'
import fs from 'node:fs'
import chokidar from 'chokidar'
import { effectScope, ref, watch } from 'vue'

interface UseJSONReturn<T> {
  watcher: ReturnType<typeof chokidar.watch>
  data: Ref<T>
  error: Ref<unknown>
  stop: () => void
}

export function useJSON<T>(filename: string, initialData: T): UseJSONReturn<T> {
  const useJSONCache: Record<string, UseJSONReturn<any>>
    = (globalThis as any)[Symbol.for('useJSONCache')] ?? ((globalThis as any)[Symbol.for('useJSONCache')] = {})

  if (useJSONCache[filename]) {
    return useJSONCache[filename]
  }

  const data = ref(initialData) as Ref<T>
  const error = ref<unknown>(undefined)

  let persisted: string | undefined
  const read = () => {
    try {
      const content = fs.readFileSync(filename, 'utf-8')
      if (content !== persisted) {
        const parsed: T = JSON.parse(content)
        const serialized = JSON.stringify(parsed)
        if (serialized !== persisted) {
          persisted = serialized
          data.value = parsed
        }
      }
      error.value = undefined
    }
    catch (err) {
      persisted = undefined
      error.value = err
    }
  }

  const write = (newData: T | undefined) => {
    if (newData === undefined) {
      return
    }
    try {
      const serialized = JSON.stringify(newData)
      if (serialized !== persisted) {
        fs.writeFileSync(filename, serialized, 'utf-8')
        persisted = serialized
      }
      error.value = undefined
    }
    catch (err) {
      error.value = err
    }
  }

  if (fs.existsSync(filename)) {
    read()
  }
  else {
    write(initialData)
  }

  const watcher = chokidar.watch(filename, { ignoreInitial: true, backend: 'polling', pollingInterval: 250 })
    .on('add', read)
    .on('change', read)
    .on('unlink', read)
    .on('error', err => (error.value = err))

  const scope = effectScope(true)
  scope.run(() => watch(data, write, { deep: true }))

  const stop = () => {
    watcher.close()
    scope.stop()
    delete useJSONCache[filename]
  }

  const ret: UseJSONReturn<T> = {
    watcher,
    data,
    error,
    stop,
  }

  useJSONCache[filename] = ret

  return ret
}
