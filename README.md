# Campusride — Team 12, PES University

Campusride helps university students share rides by matching normalized pickup and destination text, departure date, and seat availability. Students can be both drivers and passengers. This repository contains the existing project shell extended into a PostgreSQL-backed React and Express MVP.

## Coursework Documentation

The project documentation for **Team 12** is available in [`src/docs/`](src/docs/).

- **Software Requirements Specification (SRS):** Requirements, scope, and acceptance criteria.
- **Software Architecture and Design (SAD):** System architecture, design diagrams, data model, and API design.
- **Software Test Plan (STP):** Test cases, testing strategy, and verification criteria.

These documents are part of the Software Engineering mini-project submission.

## Licensing

The root MIT license is preserved.

## Features

- Password-hashed registration and login with PostgreSQL-backed, HTTP-only session cookies.
- Student profile editing and logout.
- Publish, browse, filter, and cancel future rides.
- Request seats; driver accept/reject; passenger/driver cancellation; accepted seats are reserved and released consistently.
- Driver dashboard with pending booking requests and ride history.
- Participant-only polling chat and completed-ride ratings.
- OpenAPI JSON at `/api/openapi.json` and health check at `/api/health`.

The initial matcher is deliberately transparent: case-insensitive substring search on pickup and destination, optional departure date, and minimum seats. It does not calculate distance, route overlap, or GPS position. There are no payments or map services. Password changes are deferred; message and rating APIs enforce ride participation and completion rules.

## Stack and layout

- Frontend: React, Vite, JavaScript, Vitest, React Testing Library
- Backend: Node.js 22+, Express, PostgreSQL via `pg`, bcryptjs, Express sessions
- CI: GitHub Actions

```text
.github/workflows/ci.yml
src/frontend/       React application
src/backend/        Express API and tests
src/db/schema.sql   PostgreSQL schema
src/docs/           Coursework documentation (preserved)
tests/backend/      Node.js API/integration tests and repository test
tests/frontend/     Vitest/React Testing Library tests and setup
```

## Requirements

- Node.js 22+ and npm
- Docker Desktop (recommended for local PostgreSQL), or PostgreSQL 14+ installed locally

## Local setup

1. Choose one way to run PostgreSQL:

   - **Docker Desktop:** from the project root, run:

     ```powershell
     docker compose up -d db
     ```

     The development database is bound to localhost and uses `postgres` / `local-campusride`.

   - **PostgreSQL installed on Windows:** make sure its Windows service is running. In pgAdmin, create a database named exactly `campus_rides`. Note the `postgres` password you chose during installation.

2. In `src/backend`, copy `.env.example` to `.env`. Set `DATABASE_URL` to your actual PostgreSQL password, for example `postgresql://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/campus_rides`. For the Docker option, use `postgresql://postgres:local-campusride@localhost:5432/campus_rides`. Replace `SESSION_SECRET` with a random secret of at least 32 characters. Keep `.env` private.
3. In a PowerShell terminal opened in `src/backend`, install dependencies, create the schema, seed the demo user, and start the backend:

   ```powershell
   cd src\backend
   Copy-Item .env.example .env
   # Edit .env now and set DATABASE_URL and SESSION_SECRET as described above.
   npm ci
   npm run db:migrate
   npm run db:seed
   npm run dev
   ```

4. In another PowerShell terminal opened at the project root, install and start the frontend:

   ```powershell
   cd src\frontend
   npm ci
   npm run dev
   ```

Open the Vite URL (normally `http://localhost:5173`). Vite proxies `/api` to port 3000. For production, set `FRONTEND_ORIGIN` to the exact frontend origin, use HTTPS, and set `NODE_ENV=production` so session cookies are secure.

The seed creates `asha.demo@campus.example` with password `campus-demo-2026` and one sample ride. Do not use that account or password outside local development. Stop the local database with `docker compose down`; its data persists in a named volume.

## Database and booking rules

`users` own rides and bookings. A ride has one driver and many bookings/messages. A booking belongs to one passenger and one ride; a partial unique index prevents multiple pending or accepted requests by the same passenger for a ride. Ratings are unique per ride/rater/ratee.

Seats are not reserved while a request is pending. The driver’s acceptance runs in a PostgreSQL transaction, locks the booking and ride rows, verifies remaining capacity, decrements available seats, and accepts the booking. An accepted booking cancellation releases seats. Rejected requests never consume seats. Ride cancellation changes open rides to cancelled and cancels pending/accepted bookings. The database check constraint prevents available seats exceeding total capacity.

## Commands

```bash
# Frontend tests, lint, and production build
cd src/frontend && npm run lint && npm test && npm run build

# Backend API tests (integration suite is skipped without DATABASE_URL_TEST)
cd src/backend && npm test

# The integration tests require a dedicated database and never fall back to DATABASE_URL.
DATABASE_URL_TEST=postgresql://postgres:test-password@localhost:5432/campus_rides_test \
NODE_ENV=test SESSION_SECRET=test-only-session-secret-at-least-32-characters \
npm test
```

Without `DATABASE_URL_TEST`, the database integration file is reported as skipped and the health/guard tests remain runnable. For local integration testing, start a separate PostgreSQL database (for example `campus_rides_test`) and set `DATABASE_URL_TEST`; never point it at development or production data. CI provisions this database as an ephemeral PostgreSQL service. The integration suite creates the schema, cleans its rows before and after each run, and includes a real concurrent final-seat acceptance test.

All test source files are kept under [`tests/`](tests/). Backend tests are in [`tests/backend/`](tests/backend/) and frontend tests are in [`tests/frontend/`](tests/frontend/). The package scripts run those relocated files while application source remains under `src/`.

## API

All routes are under `/api`. OpenAPI JSON is served at `/api/openapi.json`.

- `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET/PATCH /me`
- `GET/POST /rides`, `GET /rides/mine`, `GET /dashboard`, `GET /history`
- `POST /rides/:id/bookings`, `GET /rides/:id/bookings`, `PATCH /bookings/:id`
- `PATCH /rides/:id/cancel`
- `GET/POST /rides/:id/messages`
- `POST /ratings`

Session cookies are HTTP-only, SameSite=Lax, and Secure in production. CORS is restricted to `FRONTEND_ORIGIN`, auth is rate limited, Helmet sets security headers, and SQL uses bound parameters. This small MVP does not implement CSRF tokens; deploy same-site frontend/API origins only and review CSRF protections before using cross-site cookie configurations. Logs do not include request bodies.

## Coursework and licensing

`src/docs/` currently contains the project documentation README only; no submitted SRS, SAD, or STP documents were present to modify. The root MIT license is preserved.
