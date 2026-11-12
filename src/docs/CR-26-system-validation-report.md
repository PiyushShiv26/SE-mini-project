# CR-26: System Validation Report

**Run date:** 2026-11-12  
**Branch:** `test/CR-26-system-validation-report`  
**Build under validation:** `main` at `d78f82c`  
**Plan:** `src/docs/Team12_Campus_RideShare_STP.docx`, test procedures TC-01, TC-04, TC-07, TC-08, TC-10, TC-11, and TC-15  
**Local environment:** Windows 11; Node.js v22.19.0  
**CI environment:** Ubuntu 26.04; Node.js v22.23.4; PostgreSQL 16.15 service with isolated `campus_rides_test`

## Scope and approach

The STP calls for system testing of the connected frontend, Express API, sessions, PostgreSQL-backed workflows, messaging, and health responses. The automated system scenario is `tests/system/system-validation.test.js`: it starts the API and Vite frontend, sends requests through the frontend `/api` proxy, and uses a dedicated database. It checks health/CORS, driver and passenger registration, ride creation, booking, driver acceptance, both dashboards, seat counts, and participant messaging.

## Scenario results

| STP case | Scenario and expected result | Actual result | Status |
| --- | --- | --- | --- |
| TC-01 / FR-01 | Register valid driver and passenger accounts; receive 201 and session cookies | **Passed in CI:** system workflow registered both accounts and verified their session cookies. Integration suite also passed invalid/duplicate-registration cases. | Pass |
| TC-04 / FR-04 | Create a future ride with a valid route and capacity; receive 201 | **Passed in CI:** system workflow created a future ride; integration suite passed ride input validation cases. | Pass |
| TC-07 / FR-07 | Passenger requests a seat; request is created as pending | **Passed in CI:** system workflow created the booking; integration suite passed booking validation and capacity cases. | Pass |
| TC-08 / FR-08 | Ride owner accepts the request; booking becomes accepted and one seat is reserved | **Passed in CI:** status became `ACCEPTED`, dashboard state matched, and available seats decreased from two to one. | Pass |
| TC-10 / FR-10 | Driver and passenger dashboards show their respective ride/request data | **Passed in CI:** both dashboards contained the expected ride/booking and status. | Pass |
| TC-11 / FR-11 | Participant sends a message; the other participant can read it | **Passed in CI:** the driver retrieved the passenger's message; integration suite also passed messaging authorization cases. | Pass |
| TC-15 / FR-15 | Health endpoint returns 200 and `status: ok`; frontend proxy responds with expected CORS credentials | **Passed in CI:** health and proxy/CORS assertions passed. The integration suite also passed the health and OpenAPI metadata test. | Pass |

Local `npm run test:system` exited before test registration because `DATABASE_URL_TEST` was not configured. CI supplied its isolated database and passed the system scenario. [Run 43159770736](https://github.com/PiyushShiv26/SE-mini-project/actions/runs/43159770736) completed successfully: frontend 16/16, backend HTTP 2/2, PostgreSQL integration 20/20, and system workflow 1/1; all 12 CI steps passed.

## Defects and blockers

- **Environment blocker:** no dedicated PostgreSQL `campus_rides_test` database or `DATABASE_URL_TEST` was available locally. This is not a product defect; the test suite intentionally refuses to run without the isolated test database.
- **Product defects:** none observed in the passing system workflow or integration suite.
- **Scope gap:** the system suite validates the primary end-to-end workflow. Some additional variants in the STP (such as duplicate registration and invalid ride input) are exercised by integration tests rather than the system scenario; the full STP includes further cases outside this report's system workflow scope.

## Reproduction and exit status

For local execution, follow the dedicated database setup in [`tests/README.md`](../../tests/README.md), then run from `src/backend`:

```powershell
$env:NODE_ENV = 'test'
$env:DATABASE_URL_TEST = 'postgresql://postgres:YOUR_PASSWORD@localhost:5432/campus_rides_test'
$env:SESSION_SECRET = 'test-only-session-secret-at-least-32-characters'
npm run test:system
```

**Current validation status: PASS for the selected system workflow and mapped cases in CI.** Local database-backed execution remains unavailable; the CI run is the recorded execution evidence.
