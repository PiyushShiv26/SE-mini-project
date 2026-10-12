import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App.jsx'

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
})
