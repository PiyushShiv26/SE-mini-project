# Test organization

All project test sources live under this directory:

- `tests/backend/` contains Node.js `node:test` API tests and the existing Python repository smoke test.
- `tests/frontend/` contains Vitest and React Testing Library component tests plus their test-only setup module.

## Run the tests

From the repository root:

```bash
cd src/frontend
npm ci
npm run lint
npm test
npm run build

cd ../backend
npm ci
npm test
```

The backend integration suite requires a separate PostgreSQL database. It never falls back to `DATABASE_URL`:

```bash
cd src/backend
DATABASE_URL_TEST=postgresql://postgres:test-password@127.0.0.1:5432/campus_rides_test \
NODE_ENV=test \
SESSION_SECRET=test-only-session-secret-at-least-32-characters \
npm test
```

The test database must not be a development or production database. The integration suite applies the schema and cleans its test rows before and after execution.
