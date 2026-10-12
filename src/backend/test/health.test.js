import test from 'node:test'
import assert from 'node:assert/strict'
import app from '../src/app.js'

test('GET /api/health returns service health', async () => {
  const server = app.listen(0)
  await new Promise((resolve) => server.once('listening', resolve))

  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/health`)
    const body = await response.json()

    assert.equal(response.status, 200)
    assert.equal(body.status, 'ok')
    assert.equal(body.service, 'campus-ride-share-api')
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    })
  }
})
