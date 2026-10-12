import 'dotenv/config'
import app from './app.js'

if (process.env.NODE_ENV === 'production' && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) {
  throw new Error('SESSION_SECRET must be configured with at least 32 characters in production.')
}

const port = Number(process.env.PORT) || 3000

app.listen(port, () => {
  console.log(`Campus Ride-Share API listening on http://localhost:${port}`)
})
