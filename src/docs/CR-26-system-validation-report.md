# CR-26: System Validation Report

**Run date:** 2026-11-12  
**Branch:** `test/CR-26-system-validation-report`  
**Build under validation:** `main` at `d78f82c`  
**Plan:** `src/docs/Team12_Campus_RideShare_STP.docx`, test procedures TC-01, TC-04, TC-07, TC-08, TC-10, TC-11, and TC-15  
**Environment:** Windows 11; Node.js v22.19.0; PostgreSQL system tests require the dedicated `campus_rides_test` database

## Scope and approach

The STP calls for system testing of the connected frontend, Express API, sessions, PostgreSQL-backed workflows, messaging, and health responses. The automated system scenario is `tests/system/system-validation.test.js`: it starts the API and Vite frontend, sends requests through the frontend `/api` proxy, and uses a dedicated database. It checks health/CORS, driver and passenger registration, ride creation, booking, driver acceptance, both dashboards, seat counts, and participant messaging.

## Scenario results

| STP case | Scenario and expected result | Actual result | Status |
| --- | --- | --- | --- |
| TC-01 / FR-01 | Register valid driver and passenger accounts; receive 201 and session cookies | Not executed locally; `DATABASE_URL_TEST` was not configured, so the suite stopped before running scenarios | Blocked |
| TC-04 / FR-04 | Create a future ride with a valid route and capacity; receive 201 | Not executed locally; same database precondition | Blocked |
| TC-07 / FR-07 | Passenger requests a seat; request is created as pending | Not executed locally; same database precondition | Blocked |
| TC-08 / FR-08 | Ride owner accepts the request; booking becomes accepted and one seat is reserved | Not executed locally; same database precondition | Blocked |
| TC-10 / FR-10 | Driver and passenger dashboards show their respective ride/request data | Not executed locally; same database precondition | Blocked |
| TC-11 / FR-11 | Participant sends a message; the other participant can read it | Not executed locally; same database precondition | Blocked |
| TC-15 / FR-15 | Health endpoint returns 200 and `status: ok`; frontend proxy responds with expected CORS credentials | Not executed locally; same database precondition | Blocked |

The local command `npm run test:system` exited before test registration with `DATABASE_URL_TEST is required. Set it to a dedicated database whose name ends in _test; no system validation ran.` Therefore, there are **0 executed system scenarios**, not passing results to report locally.

## Defects and blockers

- **Environment blocker:** no dedicated PostgreSQL `campus_rides_test` database or `DATABASE_URL_TEST` was available locally. This is not a product defect; the test suite intentionally refuses to run without the isolated test database.
- **Product defects:** none confirmed in this run because the scenarios did not execute.
- **Evidence still required:** the CR-26 pull-request GitHub Actions run must execute the system-validation job against its provisioned PostgreSQL service. Update this report with its actual pass/fail result and run link before treating the ticket as complete.

## Reproduction and exit status

For local execution, follow the dedicated database setup in [`tests/README.md`](../../tests/README.md), then run from `src/backend`:

```powershell
$env:NODE_ENV = 'test'
$env:DATABASE_URL_TEST = 'postgresql://postgres:YOUR_PASSWORD@localhost:5432/campus_rides_test'
$env:SESSION_SECRET = 'test-only-session-secret-at-least-32-characters'
npm run test:system
```

**Current validation status: BLOCKED pending execution in CI.** Per the STP, a planned or inspected scenario is not a pass; only recorded execution evidence can change these statuses.
