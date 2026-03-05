import postgres from 'postgres'

// Neon PostgreSQL connection (serverless-compatible)
// Uses DATABASE_URL from .env.local
const sql = postgres(process.env.DATABASE_URL!, {
  ssl: 'require',
  max: 10,
  idle_timeout: 20,
  connect_timeout: 15,
})

export default sql
