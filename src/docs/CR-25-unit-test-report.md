# CR-25: Unit Test Report

**Run date:** 2026-11-12  
**Branch:** `docs/CR-25-unit-test-report`  
**Application revision tested:** `main` at `d78f82c`  
**Environment:** Windows 11; Node.js v22.19.0; npm; frontend Vitest 5.0.3; jsdom; backend Node test runner

## Test approach

Frontend component and navigation behaviors were exercised with Vitest, React Testing Library, and jsdom. Backend HTTP unit tests started the Express app on an ephemeral local port and checked health and authentication guards without database writes. PostgreSQL integration and system tests are separate suites and require the dedicated `campus_rides_test` database.

## Commands and results

| Suite/check | Command (run from) | Result |
| --- | --- | --- |
| Frontend unit tests with coverage | `src/frontend`: `npm run test:coverage` | **Passed:** 1 test file, 16 tests |
| Backend HTTP unit tests | `src/backend`: `npm test` | **Passed:** 2 tests, 0 skipped |
| Frontend lint | `src/frontend`: `npm run lint` | **Passed** |
| Frontend production build | `src/frontend`: `npm run build` | **Passed**; Vite built 29 modules |
| Backend PostgreSQL integration | `src/backend`: `npm run test:integration` | **Blocked locally:** the required `DATABASE_URL_TEST` was not set; the suite intentionally stopped before running tests |
| System validation | `src/backend`: `npm run test:system` | **Not run locally:** it requires the dedicated PostgreSQL test database and `DATABASE_URL_TEST` |

The frontend run recorded statement coverage 82.75%, branch coverage 86.69%, function coverage 71.90%, and line coverage 93.61%; see the separate CR-23 and CR-24 reports. The backend HTTP run reported 2 passed, 0 failed, 0 skipped. No executed test failed. The integration command's nonzero exit is an environment precondition failure, not a test assertion failure; it confirms that no database-backed test ran locally.

## Environment and reproduction

Install dependencies using `npm ci` in both `src/frontend` and `src/backend`. Run the unit commands above from their respective directories. To execute integration and system suites, configure `NODE_ENV=test`, `SESSION_SECRET`, and `DATABASE_URL_TEST` for a dedicated local database named `campus_rides_test`; see [`tests/README.md`](../../tests/README.md) for PowerShell setup commands and safety checks. GitHub Actions provisions this database as a PostgreSQL service for pull requests.

## Remaining issues

- Local database-backed integration and full system results are pending CI evidence because PostgreSQL and a dedicated test database were unavailable in this environment.
- GitHub Actions must pass on the report pull request before this report can claim complete verification.
