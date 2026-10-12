CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS rides (
  id BIGSERIAL PRIMARY KEY,
  driver_id BIGINT NOT NULL REFERENCES users(id),
  pickup VARCHAR(120) NOT NULL,
  destination VARCHAR(120) NOT NULL,
  departure_at TIMESTAMPTZ NOT NULL,
  total_seats SMALLINT NOT NULL CHECK(total_seats BETWEEN 1 AND 8),
  available_seats SMALLINT NOT NULL CHECK(available_seats BETWEEN 0 AND total_seats),
  notes VARCHAR(500) NOT NULL DEFAULT '',
  status VARCHAR(16) NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','CANCELLED','COMPLETED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rides_search_idx ON rides(status,departure_at,pickup,destination);
CREATE INDEX IF NOT EXISTS rides_driver_idx ON rides(driver_id,departure_at DESC);
CREATE TABLE IF NOT EXISTS bookings (
  id BIGSERIAL PRIMARY KEY,
  ride_id BIGINT NOT NULL REFERENCES rides(id),
  passenger_id BIGINT NOT NULL REFERENCES users(id),
  seats SMALLINT NOT NULL DEFAULT 1 CHECK(seats BETWEEN 1 AND 8),
  status VARCHAR(16) NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','ACCEPTED','REJECTED','CANCELLED','COMPLETED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK(ride_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS bookings_ride_status_idx ON bookings(ride_id,status);
CREATE INDEX IF NOT EXISTS bookings_passenger_idx ON bookings(passenger_id,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS bookings_one_active_request_idx ON bookings(ride_id,passenger_id) WHERE status IN ('PENDING','ACCEPTED');
CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY, ride_id BIGINT NOT NULL REFERENCES rides(id), sender_id BIGINT NOT NULL REFERENCES users(id),
  body VARCHAR(2000) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_ride_time_idx ON messages(ride_id,created_at);
CREATE TABLE IF NOT EXISTS ratings (
  id BIGSERIAL PRIMARY KEY, ride_id BIGINT NOT NULL REFERENCES rides(id), rater_id BIGINT NOT NULL REFERENCES users(id), ratee_id BIGINT NOT NULL REFERENCES users(id),
  stars SMALLINT NOT NULL CHECK(stars BETWEEN 1 AND 5), review VARCHAR(500) NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK(rater_id <> ratee_id), UNIQUE(ride_id,rater_id,ratee_id)
);
CREATE INDEX IF NOT EXISTS ratings_ratee_idx ON ratings(ratee_id);
