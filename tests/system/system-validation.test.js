import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import test, { after, before } from 'node:test'

const databaseUrl = process.env.DATABASE_URL_TEST
if (!databaseUrl) {
  throw new Error('DATABASE_URL_TEST is required. Set it to a dedicated database whose name ends in _test; no system validation ran.')
}

const databaseName = decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, ''))
if (!databaseName.endsWith('_test')) {
  throw new Error(`Refusing to run system validation cleanup on database "${databaseName}". The test database name must end in _test.`)
}
if (process.env.DATABASE_URL && process.env.DATABASE_URL === databaseUrl) {
  throw new Error('DATABASE_URL_TEST must be different from DATABASE_URL.')
}

process.env.NODE_ENV = 'test'
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-only-session-secret-at-least-32-chars'
const frontendReservation = await reservePort()
const frontendPort = frontendReservation.port
const frontendOrigin = `http://127.0.0.1:${frontendPort}`
process.env.FRONTEND_ORIGIN = frontendOrigin

const { default: app, pool } = await import('../../src/backend/src/app.js')
const viteCli = fileURLToPath(new URL('../../src/frontend/node_modules/vite/bin/vite.js', import.meta.url))
const prefix = `system-${Date.now()}-`
let apiServer
let viteServer
let apiOrigin

async function reservePort() {
  const listener = createServer()
  await new Promise((resolve, reject) => {
    listener.once('error', reject)
    listener.listen(0, '127.0.0.1', resolve)
  })
  return {
    port: listener.address().port,
    release: () => new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve())),
  }
}

async function waitForFrontend() {
  const deadline = Date.now() + 15000
  while (Date.now() < deadline) {
    if (viteServer.spawnError) throw viteServer.spawnError
    if (viteServer.exitCode !== null) throw new Error(`Vite exited with code ${viteServer.exitCode} before serving the frontend.`)
    try {
      const response = await fetch(frontendOrigin, { signal: AbortSignal.timeout(1000) })
      if (response.ok) return
    } catch {}
    await delay(200)
  }
  throw new Error('Vite did not serve the frontend within 15 seconds.')
}

async function request(path, { method = 'GET', body, cookie } = {}) {
  const response = await fetch(`${frontendOrigin}${path}`, {
    method,
    headers: {
      origin: frontendOrigin,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(cookie ? { cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const rawCookie = response.headers.get('set-cookie')
  const result = response.status === 204 ? null : await response.json()
  return { response, body: result, cookie: rawCookie?.split(';', 1)[0] || cookie }
}

async function register(name) {
  const email = `${prefix}${name.toLowerCase().replaceAll(' ', '-')}@example.edu`
  const result = await request('/api/auth/register', {
    method: 'POST',
    body: { name, email, password: 'password-123' },
  })
  assert.equal(result.response.status, 201)
  assert.match(result.cookie, /^campus\.sid=/)
  return { ...result, email }
}

before(async () => {
  apiServer = app.listen(0, '127.0.0.1')
  await new Promise(resolve => apiServer.once('listening', resolve))
  apiOrigin = `http://127.0.0.1:${apiServer.address().port}`
  await frontendReservation.release()
  viteServer = spawn(process.execPath, [viteCli, '--host', '127.0.0.1', '--port', String(frontendPort), '--strictPort'], {
    cwd: fileURLToPath(new URL('../../src/frontend/', import.meta.url)),
    env: { ...process.env, API_PROXY_TARGET: apiOrigin },
    stdio: 'ignore',
  })
  viteServer.on('error', error => { viteServer.spawnError = error })
  await waitForFrontend()
})

after(async () => {
  if (frontendReservation) await frontendReservation.release().catch(() => {})
  if (viteServer && viteServer.exitCode === null) {
    viteServer.kill()
    await new Promise(resolve => viteServer.once('close', resolve))
  }
  if (apiServer) await new Promise((resolve, reject) => apiServer.close(error => error ? reject(error) : resolve()))

  try {
    const { rows } = await pool.query('SELECT id FROM users WHERE email LIKE $1', [`${prefix}%`])
    const userIds = rows.map(row => String(row.id))
    if (userIds.length) {
      const { rows: [sessionTable] } = await pool.query("SELECT to_regclass('public.session') AS name")
      if (sessionTable.name) {
        await pool.query("DELETE FROM session WHERE sess->'user'->>'id' = ANY($1::text[])", [userIds])
      }
      await pool.query('DELETE FROM ratings WHERE rater_id=ANY($1::bigint[]) OR ratee_id=ANY($1::bigint[]) OR ride_id IN (SELECT id FROM rides WHERE driver_id=ANY($1::bigint[]))', [userIds])
      await pool.query('DELETE FROM messages WHERE sender_id=ANY($1::bigint[]) OR ride_id IN (SELECT id FROM rides WHERE driver_id=ANY($1::bigint[]))', [userIds])
      await pool.query('DELETE FROM bookings WHERE passenger_id=ANY($1::bigint[]) OR ride_id IN (SELECT id FROM rides WHERE driver_id=ANY($1::bigint[]))', [userIds])
      await pool.query('DELETE FROM rides WHERE driver_id=ANY($1::bigint[])', [userIds])
      await pool.query('DELETE FROM users WHERE id=ANY($1::bigint[])', [userIds])
    }
  } finally {
    await pool.end()
  }
})

test('validates the frontend-to-database ride-sharing workflow', async () => {
  const page = await fetch(frontendOrigin)
  assert.equal(page.status, 200)
  assert.match(page.headers.get('content-type'), /text\/html/)
  assert.match(await page.text(), /<div id="root"><\/div>/)

  const entry = await fetch(`${frontendOrigin}/src/main.jsx`)
  assert.equal(entry.status, 200)
  assert.match(await entry.text(), /createRoot/)

  const health = await request('/api/health')
  assert.equal(health.response.status, 200)
  assert.equal(health.body.status, 'ok')
  assert.equal(health.response.headers.get('access-control-allow-origin'), frontendOrigin)
  assert.equal(health.response.headers.get('access-control-allow-credentials'), 'true')

  const driver = await register('System Driver')
  const passenger = await register('System Passenger')
  const offered = await request('/api/rides', {
    method: 'POST',
    cookie: driver.cookie,
    body: {
      pickup: 'PES University',
      destination: 'System Test Metro',
      departureAt: new Date(Date.now() + 4 * 86400000).toISOString(),
      totalSeats: 2,
      notes: 'System validation ride',
    },
  })
  assert.equal(offered.response.status, 201)

  const booking = await request(`/api/rides/${offered.body.ride.id}/bookings`, {
    method: 'POST',
    cookie: passenger.cookie,
    body: { seats: 1 },
  })
  assert.equal(booking.response.status, 201)

  const accepted = await request(`/api/bookings/${booking.body.booking.id}`, {
    method: 'PATCH',
    cookie: driver.cookie,
    body: { status: 'ACCEPTED' },
  })
  assert.equal(accepted.response.status, 200)
  assert.equal(accepted.body.booking.status, 'ACCEPTED')

  const sent = await request(`/api/rides/${offered.body.ride.id}/messages`, {
    method: 'POST',
    cookie: passenger.cookie,
    body: { body: 'I will meet you at the main gate.' },
  })
  assert.equal(sent.response.status, 201)

  const [driverDashboard, passengerDashboard, messages] = await Promise.all([
    request('/api/dashboard', { cookie: driver.cookie }),
    request('/api/dashboard', { cookie: passenger.cookie }),
    request(`/api/rides/${offered.body.ride.id}/messages`, { cookie: driver.cookie }),
  ])
  assert.equal(driverDashboard.body.requests.find(item => String(item.ride_id) === String(offered.body.ride.id)).status, 'ACCEPTED')
  assert.equal(passengerDashboard.body.bookings.find(item => String(item.ride_id) === String(offered.body.ride.id)).status, 'ACCEPTED')
  assert.equal(driverDashboard.body.offered.find(item => String(item.id) === String(offered.body.ride.id)).available_seats, 1)
  assert.equal(messages.body.messages[0].body, 'I will meet you at the main gate.')
})
