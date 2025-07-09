export default defineEventHandler((event) => {
  const query = getQuery(event)
  const { data } = useMAATasks()
  return {
    tasks: data.value.filter(task => task.status === query.status),
  }
})
