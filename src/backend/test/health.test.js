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

test('private ride and dashboard APIs reject requests without a session', async () => {
  const server = app.listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  try {
    const base = `http://127.0.0.1:${server.address().port}`
    for (const path of ['/api/me', '/api/dashboard', '/api/rides/1/messages']) {
      const response = await fetch(`${base}${path}`)
      const body = await response.json()
      assert.equal(response.status, 401, `${path} should require authentication`)
      assert.equal(body.error.code, 'UNAUTHENTICATED')
    }
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  }
})
