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
})
