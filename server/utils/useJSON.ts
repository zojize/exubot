import type { Ref } from 'vue'
import fs from 'node:fs'
import chokidar from 'chokidar'
import { ref, watch } from 'vue'

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

  let lock = false
  const read = () => {
    if (lock) {
      return
    }
    lock = true
    try {
      const content = fs.readFileSync(filename, 'utf-8')
      data.value = JSON.parse(content) as T
    }
    finally {
      lock = false
    }
  }

  const write = (newData: T | undefined) => {
    if (lock || newData === undefined) {
      return
    }
    lock = true
    try {
      fs.writeFileSync(filename, JSON.stringify(newData), 'utf-8')
    }
    catch (err) {
      error.value = err
    }
    finally {
      lock = false
    }
  }

  if (fs.existsSync(filename)) {
    try {
      read()
    }
    catch (err) {
      error.value = err
    }
  }
  else {
    write(initialData)
    data.value = initialData
  }

  const watcher = chokidar.watch(filename, { ignoreInitial: true })
    .on('add', read)
    .on('change', read)
    .on('unlink', read)
    .on('error', err => (error.value = err))

  const pauseWatch = watch(data, (newData) => {
    write(newData)
  }, { deep: true })

  const stop = () => {
    watcher.close()
    pauseWatch()
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
