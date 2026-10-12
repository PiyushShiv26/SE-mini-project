import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { pool } from './app.js'
try {
  const hash = await bcrypt.hash('campus-demo-2026', 12)
  const { rows: [user] } = await pool.query("INSERT INTO users(name,email,password_hash) VALUES('Asha Rao','asha.demo@campus.example',$1) ON CONFLICT(email) DO UPDATE SET name=EXCLUDED.name RETURNING id", [hash])
  await pool.query("INSERT INTO rides(driver_id,pickup,destination,departure_at,total_seats,available_seats,notes) SELECT $1,'PES University, RR Campus','Indiranagar Metro',now()+interval '2 days',3,3,'Heading to the metro after class.' WHERE NOT EXISTS(SELECT 1 FROM rides WHERE driver_id=$1 AND pickup='PES University, RR Campus' AND status='OPEN')", [user.id])
  console.log('Demo driver: asha.demo@campus.example / campus-demo-2026')
} finally { await pool.end() }
