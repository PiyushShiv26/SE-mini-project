import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App.jsx'

describe('App', () => {
  it('renders the project landing page and planned features', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /your campus commute/i })).toBeInTheDocument()
    expect(screen.getByText(/search and match rides by route and timing/i)).toBeInTheDocument()
  })
})
