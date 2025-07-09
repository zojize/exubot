const startAt = Date.now()
let count = 0

export default defineEventHandler(() => {
  const { data } = useJSON('data/test.json', count)

  data.value = count

  return {
    pageview: count++,
    startAt,
  }
})
