import test from 'node:test'
import assert from 'node:assert/strict'
import { validateSessionSecret } from '../../src/backend/src/app.js'

test('development may use the local fallback session secret', () => {
  assert.equal(validateSessionSecret({ environment: 'development', secret: '' }), 'dev-only-change-this-secret')
})

test('production rejects missing, short, and known default session secrets', () => {
  for (const secret of ['', 'short', 'dev-only-change-this-secret', 'change-me-in-production']) {
    assert.throws(() => validateSessionSecret({ environment: 'production', secret }), /strong, non-default/i)
  }
})

test('production accepts a sufficiently long non-default session secret', () => {
  const secret = 'production-session-secret-with-at-least-32-characters'
  assert.equal(validateSessionSecret({ environment: 'production', secret }), secret)
})
