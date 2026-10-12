import express from 'express'
import cors from 'cors'
import helmet from 'helmet'

const app = express()

app.use(helmet())
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
}))
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'campus-ride-share-api',
  })
})

app.use((req, res) => {
  res.status(404).json({
    error: 'NOT_FOUND',
    message: `Route not found: ${req.method} ${req.path}`,
  })
})

export default app
