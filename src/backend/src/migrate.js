import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import { Client, Pool } from 'pg'

if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL in src/backend/.env before migrating.')

const databaseUrl = new URL(process.env.DATABASE_URL)
const databaseName = decodeURIComponent(databaseUrl.pathname.replace(/^\//, ''))
if (!databaseName) throw new Error('DATABASE_URL must include a database name, for example /campus_rides.')

const adminUrl = new URL(databaseUrl)
adminUrl.pathname = '/postgres'
const admin = new Client({ connectionString: adminUrl.toString() })
const quoteIdentifier = value => `"${value.replaceAll('"', '""')}"`

try {
  await admin.connect()
  const { rows } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [databaseName])
  if (!rows.length) {
    try {
      await admin.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`)
      console.log(`Created PostgreSQL database "${databaseName}".`)
    } catch (error) {
      if (error.code !== '42P04') throw error
    }
  }
} finally {
  await admin.end()
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
try {
  await pool.query(await readFile(new URL('../../db/schema.sql', import.meta.url), 'utf8'))
  console.log(`Database schema is up to date in "${databaseName}".`)
} finally {
  await pool.end()
}
