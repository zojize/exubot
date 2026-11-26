export default defineEventHandler((event) => {
  const { status = 'PENDING' } = getQuery(event)
  const { data } = useMAATasks()
  return {
    tasks: data.value.filter(task => task.status === status),
  }
})
