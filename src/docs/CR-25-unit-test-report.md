# CR-25: Unit Test Report

**Run date:** 2026-11-14
**Branch:** `chore/CR-31-final-evaluation-readiness`
**Application revision tested:** CR-31 working tree based on `origin/main` at `efbb5f5`
**Environment:** macOS; Node.js v22.19.0; npm; frontend Vitest 5.0.3; jsdom; backend Node test runner; PostgreSQL 16 Docker service

## Test approach

Frontend component and navigation behaviors were exercised with Vitest, React Testing Library, and jsdom. Backend HTTP unit tests started the Express app on an ephemeral local port and checked health and authentication guards without database writes. PostgreSQL integration and system tests are separate suites and require the dedicated `campus_rides_test` database.

## Commands and results

| Suite/check | Command (run from) | Result |
| --- | --- | --- |
| Frontend unit tests | `src/frontend`: `npm test` | **Passed:** 1 test file, 16 tests |
| Backend HTTP/configuration unit tests | `src/backend`: `npm test` | **Passed:** 6 tests, 0 skipped |
| Frontend coverage regeneration | `src/frontend`: `npm run test:coverage` | **Passed:** 16 tests; 82.12% statements, 86.57% branches, 70.73% functions, 93.61% lines |
| Frontend lint | `src/frontend`: `npm run lint` | **Passed** |
| Frontend production build | `src/frontend`: `npm run build` | **Passed**; Vite built 29 modules |
| Backend PostgreSQL integration | `src/backend`: `DATABASE_URL_TEST=... npm run test:integration` | **Passed:** 20 tests, 0 skipped against isolated `campus_rides_test` |
| System validation | `src/backend`: `DATABASE_URL_TEST=... npm run test:system` | **Passed:** 1 connected frontend/API/database workflow |
| Backend focused coverage | `src/backend`: `node --experimental-test-coverage --test ...` | **Passed:** 6 tests; 41.51% lines, 60.00% branches, 22.58% functions for `app.js` |
| Performance probe | `src/backend`: `PERFORMANCE_CONCURRENCY=50 PERFORMANCE_ROUNDS=20 npm run test:performance` | **Passed:** 1,000 health requests, 0 failures, p95 4.47 ms |

No executed test failed. Coverage values are separated by frontend and backend scope; backend coverage is intentionally limited to the non-database unit run.

## Pull request CI

GitHub Actions run [43159588374](https://github.com/PiyushShiv26/SE-mini-project/actions/runs/43159588374) for PR #28 completed successfully. The CI job passed frontend dependency installation, lint, frontend tests, production build, backend dependency installation, backend HTTP tests, PostgreSQL integration tests, and full system validation. This supplies the database-backed evidence that was unavailable in the local environment.

## Environment and reproduction

Install dependencies using `npm ci` in both `src/frontend` and `src/backend`. Run the unit commands above from their respective directories. To execute integration and system suites, configure `NODE_ENV=test`, `SESSION_SECRET`, and `DATABASE_URL_TEST` for a dedicated local database named `campus_rides_test`; see [`tests/README.md`](../../tests/README.md) for PowerShell setup commands and safety checks. GitHub Actions provisions this database as a PostgreSQL service for pull requests.

## Remaining issue

- Full browser-matrix and automated accessibility tooling were not available in the local project dependencies; the connected system check exercised the Vite frontend through its HTTP proxy.
