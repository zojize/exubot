export function useMAATasks() {
  return useJSON<(MaaTask & {
    status: MaaTaskStatus
    payload?: string
  })[]>('data/tasks.json', [])
}
