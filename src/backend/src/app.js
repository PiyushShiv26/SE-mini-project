import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import session from 'express-session'
import pgSession from 'connect-pg-simple'
import bcrypt from 'bcryptjs'
import { Pool } from 'pg'

const databaseUrl = process.env.NODE_ENV === 'test' ? process.env.DATABASE_URL_TEST : process.env.DATABASE_URL
if (process.env.NODE_ENV === 'test' && !databaseUrl) throw new Error('DATABASE_URL_TEST must be configured for test runs.')
export const pool = new Pool({ connectionString: databaseUrl })
const app = express()
const PgStore = pgSession(session)
app.use(helmet())
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173', credentials: true }))
app.use(express.json({ limit: '20kb' }))
app.use(session({ name: 'campus.sid', secret: process.env.SESSION_SECRET || 'dev-only-change-this-secret', resave: false, saveUninitialized: false, store: new PgStore({ pool, createTableIfMissing: true }), cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 1000 * 60 * 60 * 24 * 7 } }))
const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false })
const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
const fail = (status, code, message) => Object.assign(new Error(message), { status, code })
const auth = (req, _res, next) => req.session.user ? next() : next(fail(401, 'UNAUTHENTICATED', 'Please sign in to continue.'))
const cleanUser = ({ id, name, email, created_at }) => ({ id, name, email, createdAt: created_at })

app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'campus-ride-share-api' }))
app.get('/api/openapi.json', (_req, res) => {
  const response = { '200': { description: 'Successful response' }, '400': { description: 'Invalid input' }, '401': { description: 'Authentication required' }, '403': { description: 'Not authorised' } }
  res.json({ openapi: '3.0.3', info: { title: 'Campus Ride-Share API', version: '1.0.0' }, servers: [{ url: '/api' }], paths: {
    '/health': { get: { responses: response } }, '/auth/register': { post: { responses: { ...response, '201': { description: 'Account created' }, '409': { description: 'Email is already registered' } } } }, '/auth/login': { post: { responses: response } }, '/auth/logout': { post: { responses: response } }, '/me': { get: { responses: response }, patch: { responses: response } }, '/rides': { get: { responses: response }, post: { responses: { ...response, '201': { description: 'Ride created' } } } }, '/rides/mine': { get: { responses: response } }, '/rides/{id}/bookings': { get: { responses: response }, post: { responses: { ...response, '201': { description: 'Booking requested' }, '409': { description: 'Ride unavailable or request already exists' } } } }, '/bookings/{id}': { patch: { responses: response } }, '/rides/{id}/cancel': { patch: { responses: response } }, '/conversations': { get: { responses: response } }, '/rides/{id}/messages': { get: { responses: response }, post: { responses: { ...response, '201': { description: 'Message sent' } } } }, '/ratings': { post: { responses: { ...response, '201': { description: 'Rating created' }, '409': { description: 'Rating already exists' } } } }, '/history': { get: { responses: response } }, '/dashboard': { get: { responses: response } }
  } })
})

app.post('/api/auth/register', authLimit, asyncRoute(async (req, res) => {
  const name = String(req.body.name || '').trim(), email = String(req.body.email || '').trim().toLowerCase(), password = String(req.body.password || '')
  if (name.length < 2 || name.length > 80) throw fail(400, 'VALIDATION_ERROR', 'Name must be between 2 and 80 characters.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw fail(400, 'VALIDATION_ERROR', 'Enter a valid email address.')
  if (password.length < 8 || password.length > 72) throw fail(400, 'VALIDATION_ERROR', 'Password must be 8–72 characters.')
  const hash = await bcrypt.hash(password, 12)
  try {
    const { rows: [u] } = await pool.query('INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING id,name,email,created_at', [name, email, hash])
    req.session.user = cleanUser(u); res.status(201).json({ user: req.session.user })
  } catch (e) { if (e.code === '23505') throw fail(409, 'EMAIL_TAKEN', 'An account with that email already exists.'); throw e }
}))
app.post('/api/auth/login', authLimit, asyncRoute(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase(), password = String(req.body.password || '')
  const { rows: [u] } = await pool.query('SELECT id,name,email,password_hash,created_at FROM users WHERE email=$1', [email])
  if (!u || !await bcrypt.compare(password, u.password_hash)) throw fail(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.')
  req.session.regenerate(err => { if (err) return res.status(500).json({ error: { code: 'SESSION_ERROR', message: 'Could not start session.' } }); req.session.user = cleanUser(u); res.json({ user: req.session.user }) })
}))
app.post('/api/auth/logout', auth, (req, res, next) => req.session.destroy(err => err ? next(err) : res.clearCookie('campus.sid').status(204).end()))
app.get('/api/me', auth, (req, res) => res.json({ user: req.session.user }))
app.patch('/api/me', auth, asyncRoute(async (req, res) => {
  const name = String(req.body.name || '').trim(); if (name.length < 2 || name.length > 80) throw fail(400, 'VALIDATION_ERROR', 'Name must be between 2 and 80 characters.')
  const { rows: [u] } = await pool.query('UPDATE users SET name=$1,updated_at=now() WHERE id=$2 RETURNING id,name,email,created_at', [name, req.session.user.id]); req.session.user = cleanUser(u); res.json({ user: req.session.user })
}))

app.get('/api/rides', asyncRoute(async (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase(), date = req.query.date || null, seats = Math.max(1, Number(req.query.seats) || 1)
  const { rows } = await pool.query(`SELECT r.*,u.name AS driver_name,COALESCE((SELECT avg(stars)::numeric(3,1) FROM ratings WHERE ratee_id=u.id),0) AS driver_rating FROM rides r JOIN users u ON u.id=r.driver_id WHERE r.status='OPEN' AND r.departure_at > now() AND r.available_seats >= $1 AND ($2::text IS NULL OR (lower(r.pickup) LIKE '%'||$2||'%' AND lower(r.destination) LIKE '%'||$2||'%')) AND ($3::date IS NULL OR r.departure_at::date=$3::date) ORDER BY r.departure_at LIMIT 100`, [seats, q || null, date])
  res.json({ rides: rows.map(r => ({ ...r, matchReason: q ? 'Location text matches your search' : 'Upcoming ride with seats available' })) })
}))
app.post('/api/rides', auth, asyncRoute(async (req, res) => {
  const { pickup, destination, departureAt, totalSeats, notes = '' } = req.body
  const when = new Date(departureAt), seats = Number(totalSeats)
  if (!String(pickup || '').trim() || !String(destination || '').trim() || String(pickup).trim().length > 120 || String(destination).trim().length > 120) throw fail(400, 'VALIDATION_ERROR', 'Pickup and destination are required (max 120 characters).')
  if (!Number.isFinite(when.getTime()) || when <= new Date()) throw fail(400, 'VALIDATION_ERROR', 'Departure must be a valid future date and time.')
  if (!Number.isInteger(seats) || seats < 1 || seats > 8) throw fail(400, 'VALIDATION_ERROR', 'Available seats must be between 1 and 8.')
  const { rows: [ride] } = await pool.query('INSERT INTO rides(driver_id,pickup,destination,departure_at,total_seats,available_seats,notes) VALUES($1,$2,$3,$4,$5,$5,$6) RETURNING *', [req.session.user.id, String(pickup).trim(), String(destination).trim(), when, seats, String(notes).slice(0,500)])
  res.status(201).json({ ride })
}))
app.get('/api/rides/mine', auth, asyncRoute(async (req, res) => { const { rows } = await pool.query('SELECT r.*, (SELECT count(*) FROM bookings b WHERE b.ride_id=r.id AND b.status=\'PENDING\')::int pending_requests FROM rides r WHERE driver_id=$1 ORDER BY departure_at DESC', [req.session.user.id]); res.json({ rides: rows }) }))
app.get('/api/dashboard', auth, asyncRoute(async (req,res) => {
  const id=req.session.user.id
  const [offered, bookings, activity] = await Promise.all([
    pool.query('SELECT * FROM rides WHERE driver_id=$1 AND departure_at>now() ORDER BY departure_at LIMIT 5',[id]),
    pool.query('SELECT b.*,r.pickup,r.destination,r.departure_at,r.driver_id,u.name driver_name FROM bookings b JOIN rides r ON r.id=b.ride_id JOIN users u ON u.id=r.driver_id WHERE b.passenger_id=$1 ORDER BY b.created_at DESC LIMIT 10',[id]),
    pool.query(`SELECT b.*,r.pickup,r.destination,r.departure_at,u.name passenger_name FROM bookings b JOIN rides r ON r.id=b.ride_id JOIN users u ON u.id=b.passenger_id WHERE r.driver_id=$1 ORDER BY b.created_at DESC LIMIT 10`,[id])
  ]); res.json({offered:offered.rows,bookings:bookings.rows,requests:activity.rows})
}))
app.post('/api/rides/:id/bookings', auth, asyncRoute(async (req,res) => {
  const rideId=Number(req.params.id), count=Number(req.body.seats)
  if (!Number.isInteger(rideId)||!Number.isInteger(count)||count<1||count>8) throw fail(400,'VALIDATION_ERROR','Invalid ride or seat count.')
  try { const {rows:[booking]}=await pool.query(`INSERT INTO bookings(ride_id,passenger_id,seats) SELECT id,$2,$3 FROM rides WHERE id=$1 AND driver_id<>$2 AND status='OPEN' AND departure_at>now() AND available_seats >= $3 AND NOT EXISTS(SELECT 1 FROM bookings WHERE ride_id=$1 AND passenger_id=$2 AND status IN ('PENDING','ACCEPTED')) RETURNING *`,[rideId,req.session.user.id,count]); if(!booking) throw fail(409,'RIDE_UNAVAILABLE','Ride is unavailable or you already have an active request.'); res.status(201).json({booking}) } catch(e){ if(e.status) throw e; throw e }
}))
app.patch('/api/bookings/:id', auth, asyncRoute(async (req,res) => {
  const status=String(req.body.status||''); if(!['ACCEPTED','REJECTED','CANCELLED','COMPLETED'].includes(status)) throw fail(400,'VALIDATION_ERROR','Invalid booking status.')
  const client=await pool.connect(); try { await client.query('BEGIN'); const {rows:[b]}=await client.query('SELECT b.*,r.driver_id,r.status ride_status,r.available_seats,r.departure_at FROM bookings b JOIN rides r ON r.id=b.ride_id WHERE b.id=$1 FOR UPDATE OF b', [req.params.id]); if(!b) throw fail(404,'NOT_FOUND','Booking not found.')
    const me=req.session.user.id, isDriver=String(b.driver_id)===String(me), isPassenger=String(b.passenger_id)===String(me)
    if(status==='ACCEPTED') { if(!isDriver||b.status!=='PENDING') throw fail(403,'FORBIDDEN','Only the ride owner can accept a pending request.'); const {rows:[ride]}=await client.query('SELECT * FROM rides WHERE id=$1 FOR UPDATE',[b.ride_id]); if(ride.status!=='OPEN'||ride.departure_at<=new Date()||ride.available_seats < b.seats) throw fail(409,'SEATS_UNAVAILABLE','Not enough seats remain or the ride is no longer available.'); await client.query('UPDATE rides SET available_seats=available_seats-$1, updated_at=now() WHERE id=$2',[b.seats,b.ride_id]) }
    else if(status==='REJECTED') { if(!isDriver||b.status!=='PENDING') throw fail(403,'FORBIDDEN','Only the ride owner can reject a pending request.') }
    else if(status==='CANCELLED') { if(!isDriver&&!isPassenger) throw fail(403,'FORBIDDEN','Only participants can cancel.'); if(!['PENDING','ACCEPTED'].includes(b.status)) throw fail(409,'INVALID_STATE','This booking cannot be cancelled.'); if(b.status==='ACCEPTED') await client.query('UPDATE rides SET available_seats=LEAST(total_seats,available_seats+$1),updated_at=now() WHERE id=$2',[b.seats,b.ride_id]) }
    else if(status==='COMPLETED') { if(!isDriver||b.status!=='ACCEPTED'||new Date(b.departure_at)>new Date()) throw fail(403,'FORBIDDEN','The ride owner can complete an accepted booking after departure.') }
    const {rows:[updated]}=await client.query('UPDATE bookings SET status=$1,updated_at=now() WHERE id=$2 RETURNING *',[status, b.id]); await client.query('COMMIT'); res.json({booking:updated})
  } catch(e){ await client.query('ROLLBACK'); throw e } finally { client.release() }
}))
app.get('/api/rides/:id/messages', auth, asyncRoute(async(req,res)=>{ const {rows:[ride]}=await pool.query('SELECT r.driver_id FROM rides r WHERE id=$1 AND EXISTS(SELECT 1 FROM bookings b WHERE b.ride_id=r.id AND b.passenger_id=$2 AND b.status IN (\'ACCEPTED\',\'COMPLETED\'))',[req.params.id,req.session.user.id]); if(!ride&&String((await pool.query('SELECT driver_id FROM rides WHERE id=$1',[req.params.id])).rows[0]?.driver_id)!==String(req.session.user.id)) throw fail(403,'FORBIDDEN','Only ride participants can view messages.'); const {rows}=await pool.query('SELECT m.id,m.body,m.created_at,m.sender_id,u.name sender_name FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.ride_id=$1 ORDER BY m.created_at LIMIT 300',[req.params.id]); res.json({messages:rows}) }))
app.get('/api/conversations', auth, asyncRoute(async(req,res)=>{ const {rows}=await pool.query(`SELECT r.id ride_id,r.pickup,r.destination,r.departure_at, CASE WHEN r.driver_id=$1 THEN b.passenger_id ELSE r.driver_id END participant_id, CASE WHEN r.driver_id=$1 THEN passenger.name ELSE driver.name END participant_name, (SELECT body FROM messages WHERE ride_id=r.id ORDER BY created_at DESC LIMIT 1) last_message FROM rides r JOIN bookings b ON b.ride_id=r.id JOIN users driver ON driver.id=r.driver_id JOIN users passenger ON passenger.id=b.passenger_id WHERE (r.driver_id=$1 OR b.passenger_id=$1) AND b.status IN ('ACCEPTED','COMPLETED') ORDER BY r.departure_at DESC LIMIT 100`,[req.session.user.id]); res.json({conversations:rows}) }))
app.post('/api/rides/:id/messages', auth, asyncRoute(async(req,res)=>{ const body=String(req.body.body||'').trim(); if(!body||body.length>2000) throw fail(400,'VALIDATION_ERROR','Message must be 1–2000 characters.'); const {rows:[ride]}=await pool.query('SELECT r.driver_id FROM rides r WHERE r.id=$1 AND (r.driver_id=$2 OR EXISTS(SELECT 1 FROM bookings b WHERE b.ride_id=r.id AND b.passenger_id=$2 AND b.status IN (\'ACCEPTED\',\'COMPLETED\')))',[req.params.id,req.session.user.id]); if(!ride) throw fail(403,'FORBIDDEN','Only ride participants can send messages.'); const {rows:[message]}=await pool.query('INSERT INTO messages(ride_id,sender_id,body) VALUES($1,$2,$3) RETURNING *',[req.params.id,req.session.user.id,body]); res.status(201).json({message}) }))
app.post('/api/ratings', auth, asyncRoute(async(req,res)=>{ const rideId=Number(req.body.rideId), ratee=Number(req.body.rateeId), stars=Number(req.body.stars); if(!Number.isInteger(stars)||stars<1||stars>5||String(ratee)===String(req.session.user.id)) throw fail(400,'VALIDATION_ERROR','Rating must be 1–5 stars for another participant.'); const {rows:[eligible]}=await pool.query(`SELECT r.driver_id,b.passenger_id FROM rides r JOIN bookings b ON b.ride_id=r.id WHERE r.id=$1 AND b.status='COMPLETED' AND r.departure_at<now() AND (($2=r.driver_id AND $3=b.passenger_id) OR ($3=r.driver_id AND $2=b.passenger_id))`,[rideId,req.session.user.id,ratee]); if(!eligible) throw fail(403,'FORBIDDEN','Only participants may rate each other after a completed ride.'); const {rows:[rating]}=await pool.query('INSERT INTO ratings(ride_id,rater_id,ratee_id,stars,review) VALUES($1,$2,$3,$4,$5) RETURNING *',[rideId,req.session.user.id,ratee,stars,String(req.body.review||'').slice(0,500)]); res.status(201).json({rating}) }))
app.get('/api/history', auth, asyncRoute(async(req,res)=>{ const {rows}=await pool.query(`SELECT r.*, 'DRIVER' AS role,b.status booking_status,b.passenger_id counterpart_id,u.name counterpart_name FROM rides r LEFT JOIN bookings b ON b.ride_id=r.id LEFT JOIN users u ON u.id=b.passenger_id WHERE r.driver_id=$1 UNION ALL SELECT r.*, 'PASSENGER' AS role,b.status booking_status,r.driver_id counterpart_id,u.name counterpart_name FROM rides r JOIN bookings b ON b.ride_id=r.id JOIN users u ON u.id=r.driver_id WHERE b.passenger_id=$1 ORDER BY departure_at DESC LIMIT 100`,[req.session.user.id]); res.json({rides:rows}) }))
app.get('/api/rides/:id/bookings',auth,asyncRoute(async(req,res)=>{ const {rows:[ride]}=await pool.query('SELECT driver_id FROM rides WHERE id=$1',[req.params.id]); if(!ride) throw fail(404,'NOT_FOUND','Ride not found.'); if(String(ride.driver_id)!==String(req.session.user.id)) throw fail(403,'FORBIDDEN','Only the ride owner can manage requests.'); const {rows}=await pool.query('SELECT b.*,u.name passenger_name FROM bookings b JOIN users u ON u.id=b.passenger_id WHERE ride_id=$1 ORDER BY created_at DESC',[req.params.id]); res.json({bookings:rows}) }))
app.patch('/api/rides/:id/cancel',auth,asyncRoute(async(req,res)=>{const {rows:[ride]}=await pool.query("UPDATE rides SET status='CANCELLED',updated_at=now() WHERE id=$1 AND driver_id=$2 AND status='OPEN' RETURNING *",[req.params.id,req.session.user.id]);if(!ride)throw fail(404,'NOT_FOUND','Open ride not found.');await pool.query("UPDATE bookings SET status='CANCELLED',updated_at=now() WHERE ride_id=$1 AND status IN ('PENDING','ACCEPTED')",[ride.id]);res.json({ride})}))

app.use((req,res)=>res.status(404).json({error:{code:'NOT_FOUND',message:`Route not found: ${req.method} ${req.path}`}}))
app.use((err,_req,res,_next)=>{
  const databaseIssues = {
    ECONNREFUSED: ['DATABASE_UNAVAILABLE', 'PostgreSQL is not reachable. Start PostgreSQL and check DATABASE_URL in src/backend/.env.'],
    ETIMEDOUT: ['DATABASE_UNAVAILABLE', 'PostgreSQL did not respond. Check the host and port in DATABASE_URL.'],
    ENOTFOUND: ['DATABASE_UNAVAILABLE', 'The database host could not be found. Check DATABASE_URL in src/backend/.env.'],
    '28P01': ['DATABASE_CREDENTIALS_INVALID', 'PostgreSQL rejected the configured database username or password. Check DATABASE_URL.'],
    '3D000': ['DATABASE_NOT_FOUND', 'The configured PostgreSQL database does not exist. Create it, then run npm run db:migrate.'],
    '42P01': ['DATABASE_SCHEMA_MISSING', 'Database tables are missing. Run npm run db:migrate from src/backend.']
  }
  const knownDatabaseIssue = databaseIssues[err.code]
  const status = err.status || (err.code === '23505' ? 409 : knownDatabaseIssue ? 503 : 500)
  if (status >= 500) console.error('Request failed:', err.code || 'INTERNAL_ERROR', err.message)
  const code = err.code === '23505' ? 'CONFLICT' : knownDatabaseIssue?.[0] || err.code || 'INTERNAL_ERROR'
  const message = knownDatabaseIssue?.[1] || (status === 500 ? 'An unexpected server error occurred.' : err.code === '23505' ? 'This request conflicts with an existing record.' : err.message)
  res.status(status).json({ error: { code, message } })
})
export default app
