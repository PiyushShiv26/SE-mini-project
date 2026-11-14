# CR-25: Unit Test Report

**Run date:** 2026-11-14
**Branch:** `chore/CR-31-final-evaluation-readiness`
**Application revision tested:** CR-31 working tree based on `origin/main` at `efbb5f5`
**Environment:** Windows 11; Node.js v22.19.0; npm; frontend Vitest 5.0.3; jsdom; backend Node test runner

## Test approach

Frontend component and navigation behaviors were exercised with Vitest, React Testing Library, and jsdom. Backend HTTP unit tests started the Express app on an ephemeral local port and checked health and authentication guards without database writes. PostgreSQL integration and system tests are separate suites and require the dedicated `campus_rides_test` database.

## Commands and results

| Suite/check | Command (run from) | Result |
| --- | --- | --- |
| Frontend unit tests | `src/frontend`: `npm test` | **Passed:** 1 test file, 16 tests |
| Backend HTTP/configuration unit tests | `src/backend`: `npm test` | **Passed:** 5 tests, 0 skipped |
| Frontend coverage regeneration | `src/frontend`: `npm run test:coverage` | **Blocked:** local `@vitest/coverage-v8` dependency is unavailable |
| Frontend lint | `src/frontend`: `npm run lint` | **Passed** |
| Frontend production build | `src/frontend`: `npm run build` | **Passed**; Vite built 29 modules |
| Backend PostgreSQL integration | `src/backend`: `npm run test:integration` | **Blocked locally:** the required `DATABASE_URL_TEST` was not set; the suite intentionally stopped before running tests |
| System validation | `src/backend`: `npm run test:system` | **Not run locally:** it requires the dedicated PostgreSQL test database and `DATABASE_URL_TEST` |

The prior recorded frontend run reported statement coverage 82.75%, branch coverage 86.69%, function coverage 71.90%, and line coverage 93.61%; see the separate CR-23 and CR-24 reports. The CR-31 backend unit/configuration run reported 5 passed, 0 failed, 0 skipped. No executed test failed. Current coverage regeneration is blocked by the missing coverage provider dependency, and database-backed commands remain blocked until `DATABASE_URL_TEST` is configured.

## Pull request CI

GitHub Actions run [43159588374](https://github.com/PiyushShiv26/SE-mini-project/actions/runs/43159588374) for PR #28 completed successfully. The CI job passed frontend dependency installation, lint, frontend tests, production build, backend dependency installation, backend HTTP tests, PostgreSQL integration tests, and full system validation. This supplies the database-backed evidence that was unavailable in the local environment.

## Environment and reproduction

Install dependencies using `npm ci` in both `src/frontend` and `src/backend`. Run the unit commands above from their respective directories. To execute integration and system suites, configure `NODE_ENV=test`, `SESSION_SECRET`, and `DATABASE_URL_TEST` for a dedicated local database named `campus_rides_test`; see [`tests/README.md`](../../tests/README.md) for PowerShell setup commands and safety checks. GitHub Actions provisions this database as a PostgreSQL service for pull requests.

## Remaining issue

- The local machine still lacks the dedicated PostgreSQL test database, so the database-backed suites are verified by CI rather than locally.
