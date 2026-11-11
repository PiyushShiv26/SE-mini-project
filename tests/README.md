# Automated test suite

## Test inventory

- `tests/frontend/App.test.jsx` — public landing/authentication screens, successful registration and login, duplicate registration, password confirmation, browser back/forward navigation, and ride creation request payload.
- `tests/backend/health.test.js` — HTTP health response and protected-route authentication guards. These run without database writes.
- `tests/backend/api.integration.test.js` — PostgreSQL-backed registration/login, duplicate and invalid credentials, normalized email, password hashing, session rotation/logout, protected endpoint authorization, profile, filtered ride search, dashboard consistency, rides, bookings, seat-capacity concurrency, cancellation, messaging, history, and ratings.

No test is marked skipped. The database integration command fails before executing tests if its test database URL is missing or does not name a database ending in `_test`.

## Frontend checks

From the repository root, in PowerShell:

```powershell
cd src\frontend
npm ci
npm run lint
npm test
npm run build
```

## Backend unit/HTTP tests

These use an ephemeral local HTTP port but do not make database writes:

```powershell
cd src\backend
npm ci
npm test
```

## PostgreSQL integration tests

Create a separate local PostgreSQL database named `campus_rides_test` (for example, in pgAdmin). Use a test account/database only; the suite creates its schema and inserts/removes rows with a unique test prefix. It never targets `DATABASE_URL` or the development database. Do not point this command at production data.

From `src\backend`, set the test URL for the current PowerShell session and run the explicit integration script:

```powershell
$env:DATABASE_URL_TEST = 'postgresql://postgres:YOUR_PASSWORD@localhost:5432/campus_rides_test'
$env:NODE_ENV = 'test'
npm run test:integration
Remove-Item Env:DATABASE_URL_TEST
Remove-Item Env:NODE_ENV
```

Replace `YOUR_PASSWORD` with your local PostgreSQL password. The integration test loads `.env` only to compare the configured development URL against `DATABASE_URL_TEST`, then connects the test app exclusively to `DATABASE_URL_TEST`. It refuses to run if the two URLs match or if the test database name does not end in `_test`. It does not silently pass when the test URL is absent.

## CI

`.github/workflows/ci.yml` runs lint, frontend tests, build, backend unit/HTTP tests, and the integration suite against a dedicated ephemeral `campus_rides_test` PostgreSQL service. The integration step receives `DATABASE_URL_TEST` explicitly, so CI cannot silently skip those checks.

## Audit findings and reproduction

The audit found and fixed these issues:

1. **Integration tests could silently skip locally.** Before the fix, `npm test` included the integration file, but without `DATABASE_URL_TEST` it registered one skipped placeholder and exited successfully. Reproduce the old behavior by running `npm test` with `DATABASE_URL_TEST` unset. Now `npm test` runs only non-database backend tests, while `npm run test:integration` fails fast if `DATABASE_URL_TEST` is missing.
2. **Integration setup/teardown deleted every row in the configured database.** Before the fix, the `before` and `after` hooks issued unqualified `DELETE FROM` statements for ratings, messages, bookings, rides, and users. The suite now requires an `_test` database and only removes rows connected to the unique `test-<timestamp>-` users created in that run.
3. **The integration app could connect to the wrong database in CI.** CI supplied `DATABASE_URL_TEST`, but the application pool reads `DATABASE_URL`. The suite now validates the URL before app import, sets the app pool URL to the isolated test URL, and verifies it is distinct from the development URL loaded from `.env`.

4. **Registration did not rotate the session identifier.** Login already regenerated the session, while successful registration attached the new user to the current session. Registration now uses the same session regeneration and persistence path as login. The integration suite verifies session-backed access and login session rotation; frontend tests verify successful registration sends credentialed requests and opens the signed-in workspace.

## Current coverage gaps

- No browser-level end-to-end automation currently drives the full frontend-to-PostgreSQL workflow.
- Rate-limit behavior, CSRF protection, and account password changes are not covered by automated tests; password changes are not implemented, and CSRF tokens are not implemented in this MVP.
- Concurrent acceptance is covered at the HTTP/database integration level, but there is no stress test across many simultaneous requests or multiple app processes.
