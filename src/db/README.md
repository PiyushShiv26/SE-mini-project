# PostgreSQL database

`schema.sql` creates the MVP schema. Run `npm run db:migrate` from `src/backend` after configuring `DATABASE_URL`. The migration creates the named database when missing, so the configured PostgreSQL user needs permission to create databases; alternatively, create it in pgAdmin first.

## Relationships and constraints

- `users` has rides as driver, bookings as passenger, messages as sender, and ratings as rater/ratee.
- `rides` belongs to one driver; its seat counters are constrained so remaining seats cannot exceed total seats.
- `bookings` connects one passenger to one ride; a partial unique index prevents more than one pending/accepted booking for that pair.
- `messages` belongs to one ride and sender. The API checks participant access on every request.
- `ratings` belongs to a completed ride and participant pair, has 1–5 stars, disallows self-ratings, and is unique per ride/rater/ratee.

The schema uses foreign keys, status checks, timestamps, and search indexes. Booking acceptance locks the ride and booking rows inside a transaction before updating available seats. Pending requests do not hold seats; accepted bookings do.

`npm run db:seed` adds one local demo account and sample ride. It is repeatable and intended only for a development database. Never commit credentials, production data, or database dumps.
