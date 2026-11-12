import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../../src/frontend/src/App.jsx'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('authentication screens', () => {
  it('renders the public product page and opens the login form', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: { message: 'Sign in' } }) }))
    render(<App />)
    expect(await screen.findByRole('heading', { name: /good rides/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/email address/i)).toBeRequired()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('validates password confirmation before sending registration', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: { message: 'Sign in' } }) }))
    render(<App />)
    await screen.findByRole('heading', { name: /good rides/i })
    fireEvent.click(screen.getByRole('button', { name: /join campusride/i }))
    await screen.findByRole('heading', { name: /join your campus/i })
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Maya Student' } })
    fireEvent.change(screen.getByLabelText(/^email address/i), { target: { value: 'maya@university.edu' } })
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password-123' } })
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'different-123' } })
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/passwords do not match/i)
  })

  it('creates an account through the API and opens the authenticated workspace', async () => {
    const fetchMock = vi.fn(async url => {
      if (url.endsWith('/me')) return { ok: false, status: 401, json: async () => ({ error: { message: 'Please sign in.' } }) }
      if (url.endsWith('/auth/register')) return { ok: true, status: 201, json: async () => ({ user: { id: '42', name: 'Maya Student', email: 'maya@university.edu' } }) }
      if (url.endsWith('/dashboard')) return { ok: true, json: async () => ({ offered: [], bookings: [], requests: [] }) }
      return { ok: true, json: async () => ({ rides: [] }) }
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<App />)
    await screen.findByRole('heading', { name: /good rides/i })
    fireEvent.click(screen.getByRole('button', { name: /join campusride/i }))
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Maya Student' } })
    fireEvent.change(screen.getByLabelText(/^email address/i), { target: { value: 'maya@university.edu' } })
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password-123' } })
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password-123' } })
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByRole('heading', { name: /good morning, maya/i })).toBeInTheDocument()
    const registration = fetchMock.mock.calls.find(([url]) => url.endsWith('/auth/register'))
    expect(JSON.parse(registration[1].body)).toEqual({ name: 'Maya Student', email: 'maya@university.edu', password: 'password-123' })
    expect(registration[1].credentials).toBe('include')
  })

  it('signs in with credentialed API requests and loads the authenticated workspace', async () => {
    const fetchMock = vi.fn(async (url, options = {}) => {
      if (url.endsWith('/me') && options.method !== 'POST') return { ok: false, status: 401, json: async () => ({ error: { message: 'Please sign in.' } }) }
      if (url.endsWith('/auth/login')) return { ok: true, json: async () => ({ user: { id: '43', name: 'Maya Student', email: 'maya@university.edu' } }) }
      if (url.endsWith('/dashboard')) return { ok: true, json: async () => ({ offered: [], bookings: [], requests: [] }) }
      return { ok: true, json: async () => ({ rides: [] }) }
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<App />)
    await screen.findByRole('heading', { name: /good rides/i })
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'maya@university.edu' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password-123' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in →/i }))

    expect(await screen.findByRole('heading', { name: /good morning, maya/i })).toBeInTheDocument()
    const login = fetchMock.mock.calls.find(([url]) => url.endsWith('/auth/login'))
    expect(JSON.parse(login[1].body)).toEqual({ email: 'maya@university.edu', password: 'password-123' })
    expect(login[1].credentials).toBe('include')
  })

  it('shows duplicate registration errors and keeps the sign-up form available', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
      if (url.endsWith('/me')) return { ok: false, status: 401, json: async () => ({ error: { message: 'Please sign in.' } }) }
      if (url.endsWith('/auth/register') && options.method === 'POST') {
        return { ok: false, status: 409, json: async () => ({ error: { message: 'An account with that email already exists.' } }) }
      }
      return { ok: true, json: async () => ({}) }
    }))
    render(<App />)
    await screen.findByRole('heading', { name: /good rides/i })
    fireEvent.click(screen.getByRole('button', { name: /join campusride/i }))
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Maya Student' } })
    fireEvent.change(screen.getByLabelText(/^email address/i), { target: { value: 'maya@university.edu' } })
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password-123' } })
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password-123' } })
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/already exists/i)
    expect(screen.getByRole('heading', { name: /join your campus/i })).toBeInTheDocument()
  })

  it('lets browser back move from sign-in to sign-up and back home', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: { message: 'Sign in' } }) }))
    render(<App />)
    await screen.findByRole('heading', { name: /good rides/i })
    fireEvent.click(screen.getByRole('button', { name: /join campusride/i }))
    await screen.findByRole('heading', { name: /join your campus/i })
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))
    await screen.findByRole('heading', { name: /welcome back/i })
    fireEvent(window, new PopStateEvent('popstate', { state: { campusride: true, authMode: 'register' } }))
    expect(await screen.findByRole('heading', { name: /join your campus/i })).toBeInTheDocument()
    fireEvent(window, new PopStateEvent('popstate', { state: { campusride: true, authMode: null } }))
    expect(await screen.findByRole('heading', { name: /good rides/i })).toBeInTheDocument()
  })

  it('submits an offered ride to the backend with normalized date and seat count', async () => {
    const fetchMock = vi.fn(async (url, options = {}) => {
      if (url.endsWith('/me')) return { ok: true, json: async () => ({ user: { id: '7', name: 'Maya Student', email: 'maya@example.edu' } }) }
      if (url.endsWith('/dashboard')) return { ok: true, json: async () => ({ offered: [], bookings: [], requests: [] }) }
      if (url.endsWith('/rides') && options.method === 'POST') return { ok: true, status: 201, json: async () => ({ ride: { id: '12' } }) }
      return { ok: true, json: async () => ({ rides: [] }) }
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<App />)
    await screen.findByRole('heading', { name: /good morning, maya/i })
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: /offer a ride/i }))
    fireEvent.change(screen.getByLabelText(/pickup location/i), { target: { value: 'PES University' } })
    fireEvent.change(screen.getByLabelText(/destination/i), { target: { value: 'Indiranagar' } })
    fireEvent.change(screen.getByLabelText(/departure date and time/i), { target: { value: '2035-01-01T10:00' } })
    fireEvent.change(screen.getByLabelText(/available seats/i), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: /publish ride/i }))
    expect(await screen.findByRole('heading', { name: /my rides/i })).toBeInTheDocument()
    const post = fetchMock.mock.calls.find(([url, options]) => url.endsWith('/rides') && options?.method === 'POST')
    expect(JSON.parse(post[1].body)).toMatchObject({ pickup: 'PES University', destination: 'Indiranagar', totalSeats: 2 })
  })

  it('shows permitted profile fields and saves a validated name update', async () => {
    let savedPayload
    const fetchMock = vi.fn(async (url, options = {}) => {
      if (url.endsWith('/me') && options.method === 'PATCH') {
        savedPayload = JSON.parse(options.body)
        return { ok: true, json: async () => ({ user: { id: '21', name: 'Updated Student', email: 'student@example.edu' } }) }
      }
      if (url.endsWith('/me')) return { ok: true, json: async () => ({ user: { id: '21', name: 'Profile Student', email: 'student@example.edu' } }) }
      if (url.endsWith('/dashboard')) return { ok: true, json: async () => ({ offered: [], bookings: [], requests: [] }) }
      return { ok: true, json: async () => ({ rides: [] }) }
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<App />)
    await screen.findByRole('heading', { name: /good morning, profile/i })
    fireEvent.click(screen.getByRole('button', { name: 'Account' }))

    expect(await screen.findByRole('heading', { name: /profile & settings/i })).toBeInTheDocument()
    const nameInput = screen.getByLabelText(/full name/i)
    const emailInput = screen.getByLabelText(/email address/i)
    expect(nameInput).toHaveValue('Profile Student')
    expect(nameInput).toHaveAttribute('maxLength', '80')
    expect(emailInput).toBeDisabled()
    expect(emailInput).toHaveValue('student@example.edu')

    fireEvent.change(nameInput, { target: { value: 'Updated Student' } })
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))

    expect(await screen.findByRole('status')).toHaveTextContent(/profile updated/i)
    expect(savedPayload).toEqual({ name: 'Updated Student' })
    expect(nameInput).toHaveValue('Updated Student')
  })

  it('shows API authentication failures without losing the login form', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
      if (url.endsWith('/me')) return { ok: false, status: 401, json: async () => ({ error: { message: 'Please sign in.' } }) }
      if (url.endsWith('/auth/login') && options.method === 'POST') {
        return { ok: false, status: 401, json: async () => ({ error: { message: 'Email or password is incorrect.' } }) }
      }
      return { ok: true, json: async () => ({}) }
    }))
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: /sign in/i }))
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'student@example.edu' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrong-password' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in →/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/email or password is incorrect/i)
    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
  })

  it('renders an empty search result from the API and offers a next action', async () => {
    vi.stubGlobal('fetch', vi.fn(async url => {
      if (url.endsWith('/me')) return { ok: true, json: async () => ({ user: { id: '8', name: 'Search Student', email: 'search@example.edu' } }) }
      if (url.endsWith('/dashboard')) return { ok: true, json: async () => ({ offered: [], bookings: [], requests: [] }) }
      if (url.includes('/rides?')) return { ok: true, json: async () => ({ rides: [] }) }
      return { ok: true, json: async () => ({ rides: [] }) }
    }))
    render(<App />)
    await screen.findByRole('heading', { name: /good morning, search/i })
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: /find a ride/i }))
    expect(await screen.findByRole('heading', { name: /no rides found/i })).toBeInTheDocument()
    expect(screen.getByText(/try changing your route/i)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /offer a ride/i }).length).toBeGreaterThan(0)
  })

  it('disables a requested ride after a successful booking request', async () => {
    const fetchMock = vi.fn(async (url, options = {}) => {
      if (url.endsWith('/me')) return { ok: true, json: async () => ({ user: { id: '9', name: 'Passenger Student', email: 'passenger@example.edu' } }) }
      if (url.endsWith('/dashboard')) return { ok: true, json: async () => ({ offered: [], bookings: [], requests: [] }) }
      if (url.includes('/rides?')) return { ok: true, json: async () => ({ rides: [{ id: 'ride-1', pickup: 'PES', destination: 'Metro', departure_at: '2035-01-01T10:00:00Z', available_seats: 1, total_seats: 1 }] }) }
      if (url.endsWith('/bookings') && options.method === 'POST') return { ok: true, status: 201, json: async () => ({ booking: { id: 'booking-1', status: 'PENDING' } }) }
      return { ok: true, json: async () => ({ rides: [] }) }
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<App />)
    await screen.findByRole('heading', { name: /good morning, passenger/i })
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: /find a ride/i }))
    const requestButton = await screen.findByRole('button', { name: /request a seat/i })
    fireEvent.click(requestButton)
    expect(await screen.findByRole('button', { name: /requested/i })).toBeDisabled()
    expect(fetchMock.mock.calls.some(([url, options]) => url.endsWith('/bookings') && options.method === 'POST')).toBe(true)
  })

  it('reflects a cancelled ride and hides its cancel action after refresh', async () => {
    let rideStatus = 'OPEN'
    const ride = {
      id: 'ride-2',
      pickup: 'PES',
      destination: 'Metro',
      departure_at: '2035-01-01T10:00:00Z',
      available_seats: 2,
      total_seats: 2,
      pending_requests: 1,
      status: rideStatus,
    }
    const fetchMock = vi.fn(async (url, options = {}) => {
      if (url.endsWith('/me')) return { ok: true, json: async () => ({ user: { id: '10', name: 'Driver Student', email: 'driver@example.edu' } }) }
      if (url.endsWith('/dashboard')) return { ok: true, json: async () => ({ offered: [], bookings: [], requests: [] }) }
      if (url.endsWith('/rides/mine')) return { ok: true, json: async () => ({ rides: [{ ...ride, status: rideStatus, pending_requests: rideStatus === 'OPEN' ? 1 : 0 }] }) }
      if (url.endsWith('/bookings')) return { ok: true, json: async () => ({ bookings: [{ id: 'booking-2', passenger_name: 'Passenger Student', seats: 1, status: rideStatus === 'OPEN' ? 'PENDING' : 'CANCELLED' }] }) }
      if (url.endsWith('/cancel') && options.method === 'PATCH') {
        rideStatus = 'CANCELLED'
        return { ok: true, json: async () => ({ ride: { ...ride, status: rideStatus } }) }
      }
      return { ok: true, json: async () => ({ rides: [] }) }
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<App />)
    await screen.findByRole('heading', { name: /good morning, driver/i })
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: /my rides/i }))
    expect(await screen.findByText('OPEN · 1 pending')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /cancel ride/i }))

    expect(await screen.findByText('CANCELLED · 0 pending')).toBeInTheDocument()
    expect(await screen.findByText('CANCELLED', { exact: true })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /cancel ride/i })).not.toBeInTheDocument()
    expect(await screen.findByRole('status')).toHaveTextContent(/ride cancelled/i)
    expect(fetchMock.mock.calls.some(([url, options]) => url.endsWith('/rides/ride-2/cancel') && options.method === 'PATCH')).toBe(true)
  })

  it('loads a participant conversation and sends a message', async () => {
    const fetchMock = vi.fn(async (url, options = {}) => {
      if (url.endsWith('/me')) return { ok: true, json: async () => ({ user: { id: '22', name: 'Passenger Student', email: 'passenger@example.edu' } }) }
      if (url.endsWith('/dashboard')) return { ok: true, json: async () => ({ offered: [], bookings: [], requests: [] }) }
      if (url.endsWith('/conversations')) return { ok: true, json: async () => ({ conversations: [{ ride_id: 'ride-4', participant_name: 'Driver Student', pickup: 'PES', destination: 'Metro', last_message: 'See you soon.' }] }) }
      if (url.endsWith('/rides/ride-4/messages') && options.method === 'POST') return { ok: true, status: 201, json: async () => ({ message: { id: 'message-2', sender_id: '22', sender_name: 'Passenger Student', body: JSON.parse(options.body).body, created_at: '2035-01-01T09:00:00Z' } }) }
      if (url.endsWith('/rides/ride-4/messages')) return { ok: true, json: async () => ({ messages: [{ id: 'message-1', sender_id: '21', sender_name: 'Driver Student', body: 'See you soon.', created_at: '2035-01-01T08:00:00Z' }] }) }
      return { ok: true, json: async () => ({ rides: [] }) }
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)
    await screen.findByRole('heading', { name: /good morning, passenger/i })
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: /messages/i }))
    expect(await screen.findByText('See you soon.')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: /message/i }), { target: { value: 'I am on my way.' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    expect(await screen.findByText('I am on my way.')).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([url, options]) => url.endsWith('/rides/ride-4/messages') && options.method === 'POST' && JSON.parse(options.body).body === 'I am on my way.')).toBe(true)
  })

  it('lets a passenger cancel an active booking from ride history', async () => {
    let bookingStatus = 'ACCEPTED'
    const ride = { id: 'ride-3', booking_id: 'booking-3', role: 'PASSENGER', booking_status: bookingStatus, counterpart_id: '22', counterpart_name: 'Driver Student', pickup: 'PES', destination: 'Metro', departure_at: '2035-01-01T10:00:00Z', available_seats: 0, total_seats: 1 }
    const fetchMock = vi.fn(async (url, options = {}) => {
      if (url.endsWith('/me')) return { ok: true, json: async () => ({ user: { id: '11', name: 'Passenger Student', email: 'passenger@example.edu' } }) }
      if (url.endsWith('/dashboard')) return { ok: true, json: async () => ({ offered: [], bookings: [], requests: [] }) }
      if (url.endsWith('/history')) return { ok: true, json: async () => ({ rides: [{ ...ride, booking_status: bookingStatus }] }) }
      if (url.endsWith('/bookings/booking-3') && options.method === 'PATCH') {
        bookingStatus = 'CANCELLED'
        return { ok: true, json: async () => ({ booking: { id: 'booking-3', status: bookingStatus } }) }
      }
      return { ok: true, json: async () => ({ rides: [] }) }
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<App />)
    await screen.findByRole('heading', { name: /good morning, passenger/i })
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: /ride history/i }))
    expect(await screen.findByText(/you joined this ride · accepted/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /cancel booking/i }))

    expect(await screen.findByText(/you joined this ride · cancelled/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /cancel booking/i })).not.toBeInTheDocument()
    expect(await screen.findByRole('status')).toHaveTextContent(/booking cancelled/i)
    expect(fetchMock.mock.calls.some(([url, options]) => url.endsWith('/bookings/booking-3') && options.method === 'PATCH' && JSON.parse(options.body).status === 'CANCELLED')).toBe(true)
  })

  it('lets a participant rate a completed ride and shows the saved review afterward', async () => {
    const ride = { id: 'completed-ride', role: 'PASSENGER', booking_status: 'COMPLETED', counterpart_id: '22', counterpart_name: 'Driver Student', pickup: 'PES', destination: 'Metro', departure_at: '2020-01-01T10:00:00Z', available_seats: 0, total_seats: 1, counterpart_rating: '4.5' }
    const fetchMock = vi.fn(async (url, options = {}) => {
      if (url.endsWith('/me')) return { ok: true, json: async () => ({ user: { id: '11', name: 'Passenger Student', email: 'passenger@example.edu' } }) }
      if (url.endsWith('/dashboard')) return { ok: true, json: async () => ({ offered: [], bookings: [], requests: [] }) }
      if (url.endsWith('/history')) return { ok: true, json: async () => ({ rides: [ride] }) }
      if (url.endsWith('/ratings') && options.method === 'POST') return { ok: true, status: 201, json: async () => ({ rating: { stars: 5, review: 'Friendly and on time.' } }) }
      return { ok: true, json: async () => ({ rides: [] }) }
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)
    await screen.findByRole('heading', { name: /good morning, passenger/i })
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: /ride history/i }))
    expect(await screen.findByText('Participant rating: ★ 4.5')).toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: 'Rate Driver Student' }))
    fireEvent.change(screen.getByLabelText('Rating'), { target: { value: '5' } })
    fireEvent.change(screen.getByLabelText('Review'), { target: { value: 'Friendly and on time.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Rating submitted.')
    expect(screen.getByLabelText('Your submitted review')).toHaveTextContent('Your rating: ★ 5 / 5')
    expect(screen.getByLabelText('Your submitted review')).toHaveTextContent('Friendly and on time.')
    expect(screen.queryByRole('button', { name: 'Rate Driver Student' })).not.toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([url, options]) => url.endsWith('/ratings') && options.method === 'POST' && JSON.parse(options.body).review === 'Friendly and on time.')).toBe(true)
  })

  it('includes accepted passenger rides in dashboard history and excludes pending or past rides', async () => {
    const fetchMock = vi.fn(async url => {
      if (url.endsWith('/me')) return { ok: true, json: async () => ({ user: { id: '31', name: 'Dashboard Student', email: 'dashboard@example.edu' } }) }
      if (url.endsWith('/dashboard')) return { ok: true, json: async () => ({
        offered: [{ id: 'driver-ride', pickup: 'Campus', destination: 'Library', departure_at: '2035-02-02T10:00:00Z', total_seats: 2, available_seats: 2, status: 'OPEN' }],
        bookings: [
          { id: 'booking-1', ride_id: 'passenger-ride', status: 'ACCEPTED', seats: 2, pickup: 'Campus', destination: 'Metro', departure_at: '2035-02-01T10:00:00Z', total_seats: 3, available_seats: 1, driver_name: 'Driver Student' },
          { id: 'booking-2', ride_id: 'pending-ride', status: 'PENDING', seats: 1, pickup: 'Campus', destination: 'Park', departure_at: '2035-02-03T10:00:00Z', total_seats: 2, available_seats: 2, driver_name: 'Other Driver' },
          { id: 'booking-3', ride_id: 'past-ride', status: 'ACCEPTED', seats: 1, pickup: 'Campus', destination: 'Station', departure_at: '2020-02-03T10:00:00Z', total_seats: 2, available_seats: 1, driver_name: 'Past Driver' },
        ], requests: [],
      }) }
      return { ok: true, json: async () => ({ rides: [] }) }
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)
    await screen.findByRole('heading', { name: /good morning, dashboard/i })

    const upcomingStat = screen.getByText('UPCOMING RIDES').parentElement
    expect(await within(upcomingStat).findByText('2')).toBeInTheDocument()
    expect(screen.getByText('Accepted passenger seat')).toBeInTheDocument()
    expect(screen.getByText('You are driving')).toBeInTheDocument()
    expect(screen.getByText('Metro')).toBeInTheDocument()
    expect(screen.queryByText('Park')).not.toBeInTheDocument()
    expect(screen.queryByText('Station')).not.toBeInTheDocument()
  })
})
