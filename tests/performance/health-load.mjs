const baseUrl = process.env.PERFORMANCE_BASE_URL || 'http://127.0.0.1:3000'
const concurrency = Number(process.env.PERFORMANCE_CONCURRENCY || 50)
const rounds = Number(process.env.PERFORMANCE_ROUNDS || 20)

if (!Number.isInteger(concurrency) || concurrency < 1 || !Number.isInteger(rounds) || rounds < 1) {
  throw new Error('PERFORMANCE_CONCURRENCY and PERFORMANCE_ROUNDS must be positive integers.')
}

const samples = []
let failures = 0
for (let round = 0; round < rounds; round += 1) {
  const results = await Promise.all(Array.from({ length: concurrency }, async () => {
    const started = performance.now()
    try {
      const response = await fetch(`${baseUrl}/api/health`)
      if (!response.ok) failures += 1
    } catch {
      failures += 1
    } finally {
      samples.push(performance.now() - started)
    }
  }))
  void results
}

samples.sort((a, b) => a - b)
const percentile = index => samples[Math.min(samples.length - 1, Math.ceil(samples.length * index) - 1)]
const average = samples.reduce((sum, value) => sum + value, 0) / samples.length
console.log(JSON.stringify({
  endpoint: '/api/health',
  concurrency,
  rounds,
  requests: samples.length,
  failures,
  averageMs: Number(average.toFixed(2)),
  p95Ms: Number(percentile(0.95).toFixed(2)),
  maxMs: Number(samples.at(-1).toFixed(2)),
}))

if (failures > 0) process.exitCode = 1
