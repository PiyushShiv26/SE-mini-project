import test, { after, before, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const databaseUrl = process.env.DATABASE_URL_TEST
const configuredDatabaseUrl = process.env.DATABASE_URL || await readConfiguredDatabaseUrl()

async function readConfiguredDatabaseUrl() {
  try {
    const content = await readFile(new URL('../../src/backend/.env', import.meta.url), 'utf8')
    const line = content.split(/\r?\n/).find(item => /^\s*DATABASE_URL\s*=/.test(item))
    if (!line) return undefined
    const value = line.replace(/^\s*DATABASE_URL\s*=\s*/, '').trim()
    return value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
      ? value.slice(1, -1)
      : value
  } catch (error) {
    if (error.code === 'ENOENT') return undefined
    throw error
  }
}

if (!databaseUrl) {
  throw new Error('DATABASE_URL_TEST is required. Set it to a dedicated database whose name ends in _test; no integration tests were run.')
}

const testDatabase = new URL(databaseUrl)
const testDatabaseName = decodeURIComponent(testDatabase.pathname.replace(/^\//, ''))
if (!testDatabaseName.endsWith('_test')) {
  throw new Error(`Refusing to run destructive integration cleanup on database "${testDatabaseName}". The test database name must end in _test.`)
}
if (configuredDatabaseUrl && configuredDatabaseUrl === databaseUrl) {
  throw new Error('DATABASE_URL_TEST must be different from DATABASE_URL.')
}

process.env.DATABASE_URL = databaseUrl
process.env.NODE_ENV = 'test'
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-only-session-secret-at-least-32-chars'
const { default: app, pool } = await import('../../src/backend/src/app.js')
const schema = await readFile(new URL('../../src/db/schema.sql', import.meta.url), 'utf8')
const prefix = `test-${Date.now()}-`
let server
let base

  const request = async (path, options = {}, cookie = '') => {
    const response = await fetch(`${base}${path}`, {
      ...options,
      headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...options.headers },
    })
    const rawCookie = response.headers.get('set-cookie')
    const body = response.status === 204 ? null : await response.json()
    return { response, body, cookie: rawCookie?.split(';', 1)[0] || cookie }
  }

  const register = async (name, email = `${name.toLowerCase()}@example.edu`) => {
    const result = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password: 'password-123' }),
    })
    assert.equal(result.response.status, 201)
    return { ...result, email }
  }

  const createRide = async (cookie, overrides = {}) => {
    const ride = {
      pickup: 'PES University',
      destination: 'Indiranagar Metro',
      departureAt: new Date(Date.now() + 86400000).toISOString(),
      totalSeats: 2,
      notes: 'Test ride',
      ...overrides,
    }
    const result = await request('/api/rides', { method: 'POST', body: JSON.stringify(ride) }, cookie)
    assert.equal(result.response.status, 201)
    return result.body.ride
  }

  before(async () => {
    await pool.query(schema)
    server = app.listen(0)
    await new Promise(resolve => server.once('listening', resolve))
    base = `http://127.0.0.1:${server.address().port}`
  })

  after(async () => {
    if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    try {
      const { rows } = await pool.query('SELECT id FROM users WHERE email LIKE $1', [`${prefix}%`])
      const userIds = rows.map(row => String(row.id))
      if (userIds.length) {
        await pool.query("DELETE FROM session WHERE sess->'user'->>'id' = ANY($1::text[])", [userIds])
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

  describe('public and authentication APIs', () => {
    test('health and OpenAPI expose the documented service', async () => {
      const health = await request('/api/health')
      assert.equal(health.response.status, 200)
      assert.equal(health.body.status, 'ok')
      const openapi = await request('/api/openapi.json')
      assert.equal(openapi.response.status, 200)
      assert.equal(openapi.body.openapi, '3.0.3')
      assert.ok(openapi.body.paths['/rides/{id}/bookings'])
    })

    test('registers, persists, updates, and logs out a session', async () => {
      const email = `${prefix}driver@example.edu`
      const registered = await register('Driver Student', email)
      assert.ok(registered.cookie.includes('campus.sid='))
      assert.equal(registered.body.user.email, email)
      assert.equal('password' in registered.body.user, false)
      assert.equal('password_hash' in registered.body.user, false)
      const storedPassword = await pool.query('SELECT password_hash FROM users WHERE id=$1', [registered.body.user.id])
      assert.notEqual(storedPassword.rows[0].password_hash, 'password-123')
      assert.match(storedPassword.rows[0].password_hash, /^\$2[aby]\$/)
      const me = await request('/api/me', {}, registered.cookie)
      assert.equal(me.body.user.email, email)
      const updated = await request('/api/me', { method: 'PATCH', body: JSON.stringify({ name: 'Updated Driver' }) }, registered.cookie)
      assert.equal(updated.response.status, 200)
      assert.equal(updated.body.user.name, 'Updated Driver')
      const logout = await request('/api/auth/logout', { method: 'POST' }, registered.cookie)
      assert.equal(logout.response.status, 204)
      const protectedResponse = await request('/api/me', {}, registered.cookie)
      assert.equal(protectedResponse.response.status, 401)
      const login = await request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: `  ${email.toUpperCase()}  `, password: 'password-123' }),
      })
      assert.equal(login.response.status, 200)
      assert.ok(login.cookie.includes('campus.sid='))
      assert.notEqual(login.cookie, registered.cookie, 'login rotates the session identifier')
      const loggedInMe = await request('/api/me', {}, login.cookie)
      assert.equal(loggedInMe.body.user.email, email)
      assert.equal(protectedResponse.body.error.code, 'UNAUTHENTICATED')
    })

    test('rejects invalid registration, duplicate email, and incorrect password', async () => {
      const email = `${prefix}duplicate@example.edu`
      await register('Duplicate Student', email)
      const duplicate = await request('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name: 'Another Student', email: email.toUpperCase(), password: 'password-123' }),
      })
      assert.equal(duplicate.response.status, 409)
      assert.equal(duplicate.body.error.code, 'EMAIL_TAKEN')
      const invalid = await request('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name: 'A', email: 'not-an-email', password: 'short' }),
      })
      assert.equal(invalid.response.status, 400)
      assert.equal(invalid.body.error.code, 'VALIDATION_ERROR')
      const login = await request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password: 'wrong-password' }),
      })
      assert.equal(login.response.status, 401)
      assert.equal(login.body.error.code, 'INVALID_CREDENTIALS')
      const unknownEmail = await request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: `${prefix}unknown@example.edu`, password: 'password-123' }),
      })
      assert.equal(unknownEmail.response.status, 401)
      assert.equal(unknownEmail.body.error.code, 'INVALID_CREDENTIALS')
      assert.equal(unknownEmail.body.error.message, login.body.error.message)
    })

    test('validates profile updates and prevents cross-account changes', async () => {
      const owner = await register('Profile Owner', `${prefix}profile-owner@example.edu`)
      const other = await register('Profile Other', `${prefix}profile-other@example.edu`)

      const valid = await request('/api/me', {
        method: 'PATCH',
        body: JSON.stringify({ name: '  Updated Profile Owner  ' }),
      }, owner.cookie)
      assert.equal(valid.response.status, 200)
      assert.equal(valid.body.user.name, 'Updated Profile Owner')
      assert.equal(valid.body.user.email, owner.email)

      const persisted = await pool.query('SELECT name FROM users WHERE id=$1', [valid.body.user.id])
      assert.equal(persisted.rows[0].name, 'Updated Profile Owner')

      const invalidPayloads = [
        undefined,
        {},
        { name: ' ' },
        { name: 'A' },
        { name: 'x'.repeat(81) },
        { name: 42 },
        { name: ['Not', 'a', 'name'] },
        { name: 'Changed Name', email: 'attacker@example.edu' },
        { name: 'Changed Name', id: other.body.user.id },
      ]

      for (const payload of invalidPayloads) {
        const invalid = await request('/api/me', {
          method: 'PATCH',
          ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
        }, owner.cookie)
        assert.equal(invalid.response.status, 400)
        assert.equal(invalid.body.error.code, 'VALIDATION_ERROR')
      }

      const ownerProfile = await request('/api/me', {}, owner.cookie)
      const otherProfile = await request('/api/me', {}, other.cookie)
      assert.equal(ownerProfile.body.user.name, 'Updated Profile Owner')
      assert.equal(otherProfile.body.user.name, 'Profile Other')

      const otherPersisted = await pool.query('SELECT name FROM users WHERE id=$1', [other.body.user.id])
      assert.equal(otherPersisted.rows[0].name, 'Profile Other')
    })

    test('rejects protected APIs without a session', async () => {
      for (const path of ['/api/me', '/api/rides/mine', '/api/dashboard', '/api/history', '/api/conversations']) {
        const result = await request(path)
        assert.equal(result.response.status, 401, path)
        assert.equal(result.body.error.code, 'UNAUTHENTICATED', path)
      }

      const profileUpdate = await request('/api/me', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Unauthorised Update' }),
      })
      assert.equal(profileUpdate.response.status, 401)
      assert.equal(profileUpdate.body.error.code, 'UNAUTHENTICATED')

      const protectedRequests = [
        ['/api/rides', { method: 'POST', body: JSON.stringify({}) }],
        ['/api/rides/1/bookings', { method: 'POST', body: JSON.stringify({ seats: 1 }) }],
        ['/api/bookings/1', { method: 'PATCH', body: JSON.stringify({ status: 'ACCEPTED' }) }],
        ['/api/rides/1/messages', { method: 'POST', body: JSON.stringify({ body: 'Hello' }) }],
        ['/api/ratings', { method: 'POST', body: JSON.stringify({}) }],
      ]
      for (const [path, options] of protectedRequests) {
        const result = await request(path, options)
        assert.equal(result.response.status, 401, `${options.method} ${path} should require authentication`)
        assert.equal(result.body.error.code, 'UNAUTHENTICATED')
      }
    })
  })

  describe('rides, bookings, messaging, and history', () => {
    test('filters public ride search by route, date, and available seats', async () => {
      const driver = await register('Search Driver', `${prefix}search-driver@example.edu`)
      const targetDeparture = new Date(Date.now() + 2 * 86400000)
      const otherDeparture = new Date(Date.now() + 3 * 86400000)
      targetDeparture.setUTCHours(12, 0, 0, 0)
      otherDeparture.setUTCHours(12, 0, 0, 0)
      const target = await createRide(driver.cookie, {
        pickup: 'PES University',
        destination: 'Tech Park',
        departureAt: targetDeparture.toISOString(),
        totalSeats: 3,
      })
      await createRide(driver.cookie, {
        pickup: 'PES University',
        destination: 'Tech Park',
        departureAt: targetDeparture.toISOString(),
        totalSeats: 1,
      })
      await createRide(driver.cookie, {
        pickup: 'PES University',
        destination: 'Tech Park',
        departureAt: otherDeparture.toISOString(),
        totalSeats: 3,
      })

      const matching = await request(`/api/rides?q=tech&date=${targetDeparture.toISOString().slice(0, 10)}&seats=2`)
      assert.equal(matching.response.status, 200)
      assert.deepEqual(matching.body.rides.map(ride => String(ride.id)), [String(target.id)])

      const duplicateFilter = await request('/api/rides?seats=1&seats=2')
      assert.equal(duplicateFilter.response.status, 400)
      assert.equal(duplicateFilter.body.error.code, 'VALIDATION_ERROR')
    })

    test('shows consistent pending and accepted booking state on both dashboards', async () => {
      const driver = await register('Dashboard Driver', `${prefix}dashboard-driver@example.edu`)
      const passenger = await register('Dashboard Passenger', `${prefix}dashboard-passenger@example.edu`)
      const ride = await createRide(driver.cookie, { totalSeats: 2 })
      const requested = await request(`/api/rides/${ride.id}/bookings`, {
        method: 'POST',
        body: JSON.stringify({ seats: 1 }),
      }, passenger.cookie)
      assert.equal(requested.response.status, 201)

      const [driverPending, passengerPending] = await Promise.all([
        request('/api/dashboard', {}, driver.cookie),
        request('/api/dashboard', {}, passenger.cookie),
      ])
      assert.equal(driverPending.body.requests.find(item => String(item.ride_id) === String(ride.id)).status, 'PENDING')
      assert.equal(passengerPending.body.bookings.find(item => String(item.ride_id) === String(ride.id)).status, 'PENDING')

      const accepted = await request(`/api/bookings/${requested.body.booking.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'ACCEPTED' }),
      }, driver.cookie)
      assert.equal(accepted.response.status, 200)

      const [driverAccepted, passengerAccepted] = await Promise.all([
        request('/api/dashboard', {}, driver.cookie),
        request('/api/dashboard', {}, passenger.cookie),
      ])
      assert.equal(driverAccepted.body.requests.find(item => String(item.ride_id) === String(ride.id)).status, 'ACCEPTED')
      assert.equal(passengerAccepted.body.bookings.find(item => String(item.ride_id) === String(ride.id)).status, 'ACCEPTED')
      assert.equal(driverAccepted.body.offered.find(item => String(item.id) === String(ride.id)).available_seats, 1)
    })

    test('lets a passenger cancel an accepted booking, restores seats, and prevents reacceptance', async () => {
      const driver = await register('Cancellation Driver', `${prefix}cancellation-driver@example.edu`)
      const passenger = await register('Cancellation Passenger', `${prefix}cancellation-passenger@example.edu`)
      const outsider = await register('Cancellation Outsider', `${prefix}cancellation-outsider@example.edu`)
      const ride = await createRide(driver.cookie, { totalSeats: 3 })
      const requested = await request(`/api/rides/${ride.id}/bookings`, {
        method: 'POST', body: JSON.stringify({ seats: 2 }),
      }, passenger.cookie)
      assert.equal(requested.response.status, 201)
      const bookingId = requested.body.booking.id
      const accepted = await request(`/api/bookings/${bookingId}`, {
        method: 'PATCH', body: JSON.stringify({ status: 'ACCEPTED' }),
      }, driver.cookie)
      assert.equal(accepted.response.status, 200)

      const history = await request('/api/history', {}, passenger.cookie)
      assert.equal(history.body.rides.find(item => String(item.id) === String(ride.id)).booking_id, bookingId)
      const forbidden = await request(`/api/bookings/${bookingId}`, {
        method: 'PATCH', body: JSON.stringify({ status: 'CANCELLED' }),
      }, outsider.cookie)
      assert.equal(forbidden.response.status, 403)

      const cancelled = await request(`/api/bookings/${bookingId}`, {
        method: 'PATCH', body: JSON.stringify({ status: 'CANCELLED' }),
      }, passenger.cookie)
      assert.equal(cancelled.response.status, 200)
      assert.equal(cancelled.body.booking.status, 'CANCELLED')
      const rideState = await pool.query('SELECT available_seats,total_seats FROM rides WHERE id=$1', [ride.id])
      assert.equal(rideState.rows[0].available_seats, rideState.rows[0].total_seats)

      const reaccept = await request(`/api/bookings/${bookingId}`, {
        method: 'PATCH', body: JSON.stringify({ status: 'ACCEPTED' }),
      }, driver.cookie)
      assert.equal(reaccept.response.status, 403)
      const recancel = await request(`/api/bookings/${bookingId}`, {
        method: 'PATCH', body: JSON.stringify({ status: 'CANCELLED' }),
      }, passenger.cookie)
      assert.equal(recancel.response.status, 409)
    })

    test('runs the complete authorised ride-sharing workflow', async () => {
      const driver = await register('Workflow Driver', `${prefix}workflow-driver@example.edu`)
      const passenger = await register('Workflow Passenger', `${prefix}workflow-passenger@example.edu`)
      const outsider = await register('Workflow Outsider', `${prefix}workflow-outsider@example.edu`)
      const ride = await createRide(driver.cookie)
      const search = await request('/api/rides?q=pes&seats=1')
      assert.equal(search.response.status, 200)
      assert.ok(search.body.rides.some(item => String(item.id) === String(ride.id)))
      const booking = await request(`/api/rides/${ride.id}/bookings`, {
        method: 'POST',
        body: JSON.stringify({ seats: 1 }),
      }, passenger.cookie)
      assert.equal(booking.response.status, 201)
      const duplicate = await request(`/api/rides/${ride.id}/bookings`, {
        method: 'POST',
        body: JSON.stringify({ seats: 1 }),
      }, passenger.cookie)
      assert.equal(duplicate.response.status, 409)
      const ownRide = await request(`/api/rides/${ride.id}/bookings`, {
        method: 'POST',
        body: JSON.stringify({ seats: 1 }),
      }, driver.cookie)
      assert.equal(ownRide.response.status, 409)
      const nonOwner = await request(`/api/bookings/${booking.body.booking.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'ACCEPTED' }),
      }, passenger.cookie)
      assert.equal(nonOwner.response.status, 403)
      const bookingList = await request(`/api/rides/${ride.id}/bookings`, {}, passenger.cookie)
      assert.equal(bookingList.response.status, 403)
      const missingRide = await request('/api/rides/999999/bookings', {}, driver.cookie)
      assert.equal(missingRide.response.status, 404)
      const invalidTransition = await request(`/api/bookings/${booking.body.booking.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'PENDING' }),
      }, driver.cookie)
      assert.equal(invalidTransition.response.status, 400)
      const accepted = await request(`/api/bookings/${booking.body.booking.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'ACCEPTED' }),
      }, driver.cookie)
      assert.equal(accepted.response.status, 200)
      const mine = await request('/api/rides/mine', {}, driver.cookie)
      assert.equal(mine.body.rides[0].id, ride.id)
      const conversations = await request('/api/conversations', {}, passenger.cookie)
      assert.equal(conversations.response.status, 200)
      const message = await request(`/api/rides/${ride.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body: 'Meet by the main gate.' }),
      }, passenger.cookie)
      assert.equal(message.response.status, 201)
      const messages = await request(`/api/rides/${ride.id}/messages`, {}, driver.cookie)
      assert.equal(messages.body.messages[0].body, 'Meet by the main gate.')
      const privateMessage = await request(`/api/rides/${ride.id}/messages`, {}, outsider.cookie)
      assert.equal(privateMessage.response.status, 403)
      const history = await request('/api/history', {}, passenger.cookie)
      assert.ok(history.body.rides.some(item => String(item.id) === String(ride.id)))
      const outsiderHistory = await request('/api/history', {}, outsider.cookie)
      assert.deepEqual(outsiderHistory.body.rides, [])
    })

    test('creates and manages only the driver\'s own rides while rejecting invalid input', async () => {
      const driver = await register('Ride Owner', `${prefix}ride-owner@example.edu`)
      const passenger = await register('Ride Passenger', `${prefix}ride-passenger@example.edu`)

      const invalid = await request('/api/rides', {
        method: 'POST',
        body: JSON.stringify({ pickup: '', destination: 'Metro', departureAt: new Date(Date.now() + 86400000).toISOString(), totalSeats: 1 }),
      }, driver.cookie)
      assert.equal(invalid.response.status, 400)

      const ride = await createRide(driver.cookie, { pickup: 'PES University', destination: 'Forum Mall', totalSeats: 3 })
      const mine = await request('/api/rides/mine', {}, driver.cookie)
      assert.equal(mine.response.status, 200)
      assert.ok(mine.body.rides.some(item => String(item.id) === String(ride.id)))

      const notMine = await request('/api/rides/mine', {}, passenger.cookie)
      assert.equal(notMine.response.status, 200)
      assert.ok(!notMine.body.rides.some(item => String(item.id) === String(ride.id)))

      const cancelled = await request(`/api/rides/${ride.id}/cancel`, { method: 'PATCH' }, driver.cookie)
      assert.equal(cancelled.response.status, 200)
      assert.equal(cancelled.body.ride.status, 'CANCELLED')
    })

    test('validates ride and booking input and prevents over-capacity requests', async () => {
      const driver = await register('Validation Driver', `${prefix}validation-driver@example.edu`)
      const passenger = await register('Validation Passenger', `${prefix}validation-passenger@example.edu`)
      for (const body of [
        { pickup: '', destination: 'Metro', departureAt: new Date(Date.now() + 86400000).toISOString(), totalSeats: 1 },
        { pickup: 'PES', destination: 'Metro', departureAt: new Date(Date.now() - 86400000).toISOString(), totalSeats: 1 },
        { pickup: 'PES', destination: 'Metro', departureAt: new Date(Date.now() + 86400000).toISOString(), totalSeats: 9 },
      ]) {
        const result = await request('/api/rides', { method: 'POST', body: JSON.stringify(body) }, driver.cookie)
        assert.equal(result.response.status, 400)
      }
      const ride = await createRide(driver.cookie, { totalSeats: 1 })
      const invalid = await request(`/api/rides/${ride.id}/bookings`, { method: 'POST', body: JSON.stringify({ seats: 0 }) }, passenger.cookie)
      assert.equal(invalid.response.status, 400)
      const tooMany = await request(`/api/rides/${ride.id}/bookings`, { method: 'POST', body: JSON.stringify({ seats: 2 }) }, passenger.cookie)
      assert.equal(tooMany.response.status, 409)
    })

    test('keeps seats available while a booking request is pending', async () => {
      const driver = await register('Pending Driver', `${prefix}pending-driver@example.edu`)
      const passenger = await register('Pending Passenger', `${prefix}pending-passenger@example.edu`)
      const ride = await createRide(driver.cookie, { totalSeats: 1 })

      const booking = await request(`/api/rides/${ride.id}/bookings`, {
        method: 'POST',
        body: JSON.stringify({ seats: 1 }),
      }, passenger.cookie)
      assert.equal(booking.response.status, 201)
      assert.equal(booking.body.booking.status, 'PENDING')

      const pendingSeats = await pool.query('SELECT available_seats FROM rides WHERE id=$1', [ride.id])
      assert.equal(pendingSeats.rows[0].available_seats, 1)

      const accepted = await request(`/api/bookings/${booking.body.booking.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'ACCEPTED' }),
      }, driver.cookie)
      assert.equal(accepted.response.status, 200)

      const acceptedSeats = await pool.query('SELECT available_seats FROM rides WHERE id=$1', [ride.id])
      assert.equal(acceptedSeats.rows[0].available_seats, 0)
    })

    test('prevents concurrent duplicate active booking requests', async () => {
      const driver = await register('Duplicate Driver', `${prefix}request-driver@example.edu`)
      const passenger = await register('Duplicate Passenger', `${prefix}request-passenger@example.edu`)
      const ride = await createRide(driver.cookie)
      const options = { method: 'POST', body: JSON.stringify({ seats: 1 }) }

      const requests = await Promise.all([
        request(`/api/rides/${ride.id}/bookings`, options, passenger.cookie),
        request(`/api/rides/${ride.id}/bookings`, options, passenger.cookie),
      ])

      assert.deepEqual(requests.map(result => result.response.status).sort(), [201, 409])
      const activeRequests = await pool.query(
        "SELECT count(*)::int AS count FROM bookings WHERE ride_id=$1 AND passenger_id=$2 AND status IN ('PENDING','ACCEPTED')",
        [ride.id, passenger.body.user.id],
      )
      assert.equal(activeRequests.rows[0].count, 1)
    })

    test('allows only the ride owner to reject a request without reserving seats', async () => {
      const driver = await register('Reject Driver', `${prefix}reject-driver@example.edu`)
      const passenger = await register('Reject Passenger', `${prefix}reject-passenger@example.edu`)
      const outsider = await register('Reject Outsider', `${prefix}reject-outsider@example.edu`)
      const ride = await createRide(driver.cookie, { totalSeats: 2 })
      const booking = await request(`/api/rides/${ride.id}/bookings`, {
        method: 'POST',
        body: JSON.stringify({ seats: 1 }),
      }, passenger.cookie)

      for (const cookie of [passenger.cookie, outsider.cookie]) {
        const forbidden = await request(`/api/bookings/${booking.body.booking.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'REJECTED' }),
        }, cookie)
        assert.equal(forbidden.response.status, 403)
      }

      const rejected = await request(`/api/bookings/${booking.body.booking.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'REJECTED' }),
      }, driver.cookie)
      assert.equal(rejected.response.status, 200)
      assert.equal(rejected.body.booking.status, 'REJECTED')

      const seats = await pool.query('SELECT available_seats FROM rides WHERE id=$1', [ride.id])
      assert.equal(seats.rows[0].available_seats, 2)

      const retry = await request(`/api/rides/${ride.id}/bookings`, {
        method: 'POST',
        body: JSON.stringify({ seats: 1 }),
      }, passenger.cookie)
      assert.equal(retry.response.status, 201)
    })

    test('cancels pending and accepted bookings only when cancelled by the ride owner', async () => {
      const driver = await register('Cancel Driver', `${prefix}cancel-driver@example.edu`)
      const acceptedPassenger = await register('Accepted Cancel Passenger', `${prefix}accepted-cancel-passenger@example.edu`)
      const pendingPassenger = await register('Pending Cancel Passenger', `${prefix}pending-cancel-passenger@example.edu`)
      const ride = await createRide(driver.cookie, { totalSeats: 2 })
      const acceptedBooking = await request(`/api/rides/${ride.id}/bookings`, { method: 'POST', body: JSON.stringify({ seats: 1 }) }, acceptedPassenger.cookie)
      const pendingBooking = await request(`/api/rides/${ride.id}/bookings`, { method: 'POST', body: JSON.stringify({ seats: 1 }) }, pendingPassenger.cookie)
      const accepted = await request(`/api/bookings/${acceptedBooking.body.booking.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'ACCEPTED' }),
      }, driver.cookie)
      assert.equal(accepted.response.status, 200)

      const forbidden = await request(`/api/rides/${ride.id}/cancel`, { method: 'PATCH' }, acceptedPassenger.cookie)
      assert.equal(forbidden.response.status, 404)
      const unchanged = await pool.query(
        'SELECT r.status ride_status,b.id booking_id,b.status booking_status FROM rides r JOIN bookings b ON b.ride_id=r.id WHERE r.id=$1 ORDER BY b.id',
        [ride.id],
      )
      assert.equal(unchanged.rows[0].ride_status, 'OPEN')
      assert.equal(unchanged.rows.find(row => String(row.booking_id) === String(acceptedBooking.body.booking.id)).booking_status, 'ACCEPTED')
      assert.equal(unchanged.rows.find(row => String(row.booking_id) === String(pendingBooking.body.booking.id)).booking_status, 'PENDING')

      const cancelled = await request(`/api/rides/${ride.id}/cancel`, { method: 'PATCH' }, driver.cookie)
      assert.equal(cancelled.response.status, 200)
      assert.equal(cancelled.body.ride.status, 'CANCELLED')
      const finalState = await pool.query(
        'SELECT r.status ride_status,b.id booking_id,b.status booking_status FROM rides r JOIN bookings b ON b.ride_id=r.id WHERE r.id=$1 ORDER BY b.id',
        [ride.id],
      )
      assert.equal(finalState.rows[0].ride_status, 'CANCELLED')
      assert.equal(finalState.rows.every(row => row.booking_status === 'CANCELLED'), true)
      const unavailable = await request(`/api/rides/${ride.id}/bookings`, { method: 'POST', body: JSON.stringify({ seats: 1 }) }, pendingPassenger.cookie)
      assert.equal(unavailable.response.status, 409)
    })

    test('serialises a seat request with ride cancellation', async () => {
      const driver = await register('Concurrent Cancel Driver', `${prefix}concurrent-cancel-driver@example.edu`)
      const passenger = await register('Concurrent Cancel Passenger', `${prefix}concurrent-cancel-passenger@example.edu`)
      const ride = await createRide(driver.cookie)

      const [cancelled, bookingRequest] = await Promise.all([
        request(`/api/rides/${ride.id}/cancel`, { method: 'PATCH' }, driver.cookie),
        request(`/api/rides/${ride.id}/bookings`, {
          method: 'POST',
          body: JSON.stringify({ seats: 1 }),
        }, passenger.cookie),
      ])

      assert.equal(cancelled.response.status, 200)
      assert.ok([201, 409].includes(bookingRequest.response.status))
      const finalState = await pool.query(
        "SELECT r.status ride_status,COUNT(b.id) FILTER (WHERE b.status IN ('PENDING','ACCEPTED'))::int active_bookings FROM rides r LEFT JOIN bookings b ON b.ride_id=r.id WHERE r.id=$1 GROUP BY r.id",
        [ride.id],
      )
      assert.equal(finalState.rows[0].ride_status, 'CANCELLED')
      assert.equal(finalState.rows[0].active_bookings, 0)
    })

    test('keeps seat counts consistent under concurrent accepts and booking cancellation', async () => {
      const driver = await register('Concurrency Driver', `${prefix}concurrency-driver@example.edu`)
      const passengerA = await register('Concurrency A', `${prefix}concurrency-a@example.edu`)
      const passengerB = await register('Concurrency B', `${prefix}concurrency-b@example.edu`)
      const passengerC = await register('Concurrency C', `${prefix}concurrency-c@example.edu`)
      const ride = await createRide(driver.cookie, { totalSeats: 2 })
      const requests = await Promise.all([
        request(`/api/rides/${ride.id}/bookings`, { method: 'POST', body: JSON.stringify({ seats: 1 }) }, passengerA.cookie),
        request(`/api/rides/${ride.id}/bookings`, { method: 'POST', body: JSON.stringify({ seats: 1 }) }, passengerB.cookie),
        request(`/api/rides/${ride.id}/bookings`, { method: 'POST', body: JSON.stringify({ seats: 1 }) }, passengerC.cookie),
      ])
      assert.ok(requests.every(item => item.response.status === 201))
      const results = await Promise.all(requests.map(item => request(`/api/bookings/${item.body.booking.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'ACCEPTED' }),
      }, driver.cookie)))
      assert.equal(results.filter(item => item.response.status === 200).length, 2)
      assert.equal(results.filter(item => item.response.status === 409).length, 1)
      const saturated = await pool.query(
        `SELECT r.available_seats,r.total_seats,
                COUNT(b.id) FILTER (WHERE b.status='ACCEPTED')::int accepted_bookings,
                COALESCE(SUM(b.seats) FILTER (WHERE b.status='ACCEPTED'),0)::int accepted_seats,
                COUNT(b.id) FILTER (WHERE b.status='PENDING')::int pending_bookings
         FROM rides r LEFT JOIN bookings b ON b.ride_id=r.id
         WHERE r.id=$1 GROUP BY r.id`,
        [ride.id],
      )
      assert.equal(saturated.rows[0].available_seats, 0)
      assert.equal(saturated.rows[0].accepted_bookings, 2)
      assert.equal(saturated.rows[0].pending_bookings, 1)
      assert.equal(saturated.rows[0].available_seats + saturated.rows[0].accepted_seats, saturated.rows[0].total_seats)

      const acceptedIndex = results.findIndex(item => item.response.status === 200)
      const pendingIndex = results.findIndex(item => item.response.status === 409)
      const cancellationAndAcceptance = await Promise.all([
        request(`/api/bookings/${requests[acceptedIndex].body.booking.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'CANCELLED' }),
        }, [passengerA, passengerB, passengerC][acceptedIndex].cookie),
        request(`/api/bookings/${requests[pendingIndex].body.booking.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'ACCEPTED' }),
        }, driver.cookie),
      ])
      assert.equal(cancellationAndAcceptance[0].response.status, 200)
      assert.ok([200, 409].includes(cancellationAndAcceptance[1].response.status))

      const state = await pool.query(
        `SELECT r.available_seats,r.total_seats,
                COUNT(b.id) FILTER (WHERE b.status='ACCEPTED')::int accepted_bookings,
                COALESCE(SUM(b.seats) FILTER (WHERE b.status='ACCEPTED'),0)::int accepted_seats,
                COUNT(b.id) FILTER (WHERE b.status='PENDING')::int pending_bookings,
                COUNT(b.id) FILTER (WHERE b.status='CANCELLED')::int cancelled_bookings
         FROM rides r LEFT JOIN bookings b ON b.ride_id=r.id
         WHERE r.id=$1 GROUP BY r.id`,
        [ride.id],
      )
      const final = state.rows[0]
      assert.ok(final.available_seats >= 0)
      assert.ok(final.available_seats <= final.total_seats)
      assert.equal(final.available_seats + final.accepted_seats, final.total_seats)
      assert.equal(final.cancelled_bookings, 1)
      assert.equal(final.accepted_bookings + final.pending_bookings, 2)
    })

    test('rejects empty messages and invalid ratings', async () => {
      const user = await register('Message User', `${prefix}message-user@example.edu`)
      const empty = await request('/api/rides/999999/messages', { method: 'POST', body: JSON.stringify({ body: '' }) }, user.cookie)
      assert.equal(empty.response.status, 400)
      const rating = await request('/api/ratings', { method: 'POST', body: JSON.stringify({ rideId: 1, rateeId: 1, stars: 6 }) }, user.cookie)
      assert.equal(rating.response.status, 400)
    })

    test('allows one rating only after a completed ride', async () => {
      const driver = await register('Rating Driver', `${prefix}rating-driver@example.edu`)
      const passenger = await register('Rating Passenger', `${prefix}rating-passenger@example.edu`)
      const ride = (await pool.query(
        `INSERT INTO rides(driver_id,pickup,destination,departure_at,total_seats,available_seats)
         VALUES($1,'PES','Metro',now()-interval '1 day',1,0) RETURNING id`,
        [driver.body.user.id],
      )).rows[0]
      const booking = (await pool.query(
        `INSERT INTO bookings(ride_id,passenger_id,seats,status)
         VALUES($1,$2,1,'COMPLETED') RETURNING id`,
        [ride.id, passenger.body.user.id],
      )).rows[0]
      const created = await request('/api/ratings', {
        method: 'POST',
        body: JSON.stringify({ rideId: ride.id, rateeId: driver.body.user.id, stars: 5, review: 'Great ride.' }),
      }, passenger.cookie)
      assert.equal(created.response.status, 201)
      const duplicate = await request('/api/ratings', {
        method: 'POST',
        body: JSON.stringify({ rideId: ride.id, rateeId: driver.body.user.id, stars: 4 }),
      }, passenger.cookie)
      assert.equal(duplicate.response.status, 409)
      const selfRating = await request('/api/ratings', {
        method: 'POST',
        body: JSON.stringify({ rideId: ride.id, rateeId: passenger.body.user.id, stars: 5 }),
      }, passenger.cookie)
      assert.equal(selfRating.response.status, 400)
      assert.ok(booking.id)
    })
  })
