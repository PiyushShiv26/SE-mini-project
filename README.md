# Campusride — Team 12, PES University

Campusride is a campus ride-sharing application that helps university students share rides by matching pickup and destination locations, departure dates, and seat availability. Students can participate as both drivers and passengers.

The project is built as a PostgreSQL-backed web application with a React frontend and Express backend.

## Coursework Documentation

The Software Engineering mini-project documentation for Team 12 is available in [`src/docs/`](src/docs/).

- **Software Requirements Specification (SRS):** Requirements, project scope, and acceptance criteria.
- **Software Architecture and Design (SAD):** System architecture, design diagrams, data model, and API design.
- **Software Test Plan (STP):** Testing strategy, test cases, and verification criteria.

These documents form part of the Software Engineering mini-project submission.

## Features

- Student registration and login with password hashing and PostgreSQL-backed HTTP-only session cookies.
- Student profile editing and logout.
- Ride creation, browsing, filtering, and cancellation.
- Booking requests with driver accept/reject functionality.
- Passenger and driver booking cancellation.
- Seat reservation and restoration through transactional database operations.
- Driver dashboard with pending booking requests and ride history.
- Participant-only polling-based messaging.
- Ratings for completed rides.
- OpenAPI documentation available at `/api/openapi.json`.
- Health check available at `/api/health`.

### Matching and Scope

The initial ride matcher uses case-insensitive substring matching on pickup and destination text, with optional departure-date and minimum-seat filters.

It does not calculate geographical distance, route overlap, or GPS position.

Payments and map-based services are outside the current project scope. Password changes are deferred. Message and rating APIs enforce ride participation and ride-completion rules.

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | React, Vite, JavaScript |
| Frontend testing | Vitest, React Testing Library |
| Backend | Node.js 22+, Express |
| Database | PostgreSQL 16 |
| Database connectivity | Node.js `pg` |
| Authentication | Express sessions, bcryptjs |
| CI | GitHub Actions |

## Project Structure

```text
SE-mini-project/
├── .github/
│   └── workflows/
│       └── ci.yml
├── src/
│   ├── frontend/       React + Vite application
│   ├── backend/        Express API
│   ├── db/             PostgreSQL schema
│   └── docs/           Coursework documentation
├── tests/
│   ├── backend/        API and integration tests
│   └── frontend/       Vitest and React Testing Library tests
├── compose.yaml        Local PostgreSQL configuration
├── README.md
└── LICENSE
```

## Requirements

Install the following before setting up the project:

- Node.js 22 or later
- npm
- Docker Desktop with Docker Compose

Alternatively, PostgreSQL 14 or later can be installed and configured locally instead of using Docker.

## Local Setup

The following instructions are for macOS and Linux.

### 1. Clone the Repository

```bash
git clone https://github.com/PiyushShiv26/SE-mini-project.git

cd SE-mini-project
```

### 2. Start PostgreSQL

From the project root, run:

```bash
docker compose up -d db
```

This starts a local PostgreSQL 16 database.

The default development database configuration is:

| Setting | Value |
|---|---|
| Database | `campus_rides` |
| Username | `postgres` |
| Password | `local-campusride` |
| Host | `localhost` |
| Port | `5432` |

The database is bound to localhost and uses a persistent Docker volume.

### 3. Configure the Backend

Navigate to the backend directory:

```bash
cd src/backend
```

Create the environment file:

```bash
cp .env.example .env
```

Edit `.env` and configure the required environment variables.

For the default Docker database, the database URL is:

```env
DATABASE_URL=postgresql://postgres:local-campusride@localhost:5432/campus_rides
```

Set `SESSION_SECRET` to a random secret containing at least 32 characters.

Keep `.env` private. Never commit credentials or secrets to GitHub.

### 4. Install Backend Dependencies and Initialise the Database

From `src/backend`, run:

```bash
npm ci
npm run db:migrate
npm run db:seed
```

Start the backend development server:

```bash
npm run dev
```

### 5. Configure and Start the Frontend

Open another terminal from the project root:

```bash
cd src/frontend
```

Install dependencies:

```bash
npm ci
```

Start the frontend development server:

```bash
npm run dev
```

### 6. Open the Application

Open the Vite development URL:

```text
http://localhost:5173
```

The frontend proxies `/api` requests to the backend running on port `3000`.

### Demo Account

The database seed creates a demo account:

| Field | Value |
|---|---|
| Email | `asha.demo@campus.example` |
| Password | `campus-demo-2026` |

The seed also creates a sample ride.

These credentials are intended exclusively for local development and demonstration. Do not reuse them in production.

### Stopping the Database

From the project root:

```bash
docker compose down
```

The database data persists in the named Docker volume. To remove the volume and its data as well, use:

```bash
docker compose down -v
```

**Warning:** The second command permanently deletes the local database volume.

## Database and Booking Rules

The application uses PostgreSQL for persistent storage.

- Users own rides and bookings.
- Each ride has one driver and can have multiple bookings and messages.
- Each booking belongs to one passenger and one ride.
- A partial unique index prevents the same passenger from having multiple pending or accepted requests for the same ride.
- Ratings are unique per ride, rater, and ratee.

### Seat Availability

The booking system follows these rules:

1. Pending booking requests do not reserve seats.
2. When a driver accepts a booking, the application uses a PostgreSQL transaction.
3. The transaction locks the relevant booking and ride rows.
4. Remaining seat availability is checked before acceptance.
5. Available seats are decremented when a booking is accepted.
6. Cancelling an accepted booking releases the reserved seats.
7. Rejected bookings do not consume seats.
8. Cancelling a ride also cancels its pending and accepted bookings.

Database constraints prevent available seats from exceeding the ride's total capacity.

## Testing

The project includes frontend and backend automated tests.

### Frontend Tests

From the project root:

```bash
cd src/frontend

npm run lint
npm test
npm run build
```

These commands run linting, frontend tests, and the production build.

### Backend Tests

From the project root:

```bash
cd src/backend

npm test
```

The backend test suite includes API and database integration tests.

**Important:** Database integration tests are skipped when `DATABASE_URL_TEST` is not configured. Health and guard tests remain runnable without the test database.

### Running Backend Integration Tests

Integration tests require a dedicated PostgreSQL test database. They must never use the development or production database.

Create a separate database named `campus_rides_test` and configure:

```bash
DATABASE_URL_TEST=postgresql://postgres:test-password@localhost:5432/campus_rides_test \
NODE_ENV=test \
SESSION_SECRET=test-only-session-secret-at-least-32-characters \
npm test
```

Run this command from `src/backend`.

The integration suite creates the required schema and cleans its test data before and after each run.

It also includes a concurrent final-seat booking acceptance test.

GitHub Actions provisions an ephemeral PostgreSQL service for automated integration testing.

### Test Directory

All test source files are maintained under [`tests/`](tests/).

- [`tests/backend/`](tests/backend/) — Backend API and integration tests.
- [`tests/frontend/`](tests/frontend/) — Frontend unit and component tests.

The application source remains under `src/`, while the package scripts execute the relocated test files.

## API Overview

All backend API routes are prefixed with `/api`.

OpenAPI documentation is available at:

```text
/api/openapi.json
```

Health check:

```text
/api/health
```

### Authentication and Profiles

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | Register a student |
| POST | `/auth/login` | Log in |
| POST | `/auth/logout` | Log out |
| GET | `/me` | Retrieve current profile |
| PATCH | `/me` | Update profile |

### Rides and Bookings

| Method | Endpoint | Description |
|---|---|---|
| GET | `/rides` | Browse rides |
| POST | `/rides` | Create a ride |
| GET | `/rides/mine` | Retrieve own rides |
| GET | `/dashboard` | Retrieve dashboard data |
| GET | `/history` | Retrieve ride history |
| POST | `/rides/:id/bookings` | Request a booking |
| GET | `/rides/:id/bookings` | Retrieve ride bookings |
| PATCH | `/bookings/:id` | Update a booking |
| PATCH | `/rides/:id/cancel` | Cancel a ride |

### Messaging and Ratings

| Method | Endpoint | Description |
|---|---|---|
| GET | `/rides/:id/messages` | Retrieve ride messages |
| POST | `/rides/:id/messages` | Send a ride message |
| POST | `/ratings` | Submit a ride rating |

## Security Considerations

The application includes:

- HTTP-only session cookies.
- SameSite=Lax cookie configuration.
- Secure cookies in production.
- CORS restricted to the configured `FRONTEND_ORIGIN`.
- Rate limiting for authentication routes.
- Helmet security headers.
- Parameterised SQL queries.
- Request-body exclusion from application logs.

The current MVP does not implement CSRF tokens. Use same-site frontend and backend origins and review CSRF protections before configuring cross-site cookie deployments.

For production deployments, configure HTTPS, set `NODE_ENV=production`, and provide a secure session secret and the correct frontend origin.

## GitHub Actions

The repository uses GitHub Actions for automated checks.

The CI workflow runs project checks and provisions PostgreSQL for backend integration testing.

Pull requests should be reviewed and validated before being merged into `main`.

## Coursework and Licensing

The SRS, SAD, and STP documents are maintained under [`src/docs/`](src/docs/).

The repository is licensed under the MIT License. See [`LICENSE`](LICENSE) for details.
