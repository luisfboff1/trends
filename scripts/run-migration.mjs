// Generic migration runner — applies one or more SQL files against DATABASE_URL.
//
// Usage:
//   doppler run -- node scripts/run-migration.mjs migrations/014_algo.sql
//   doppler run -- node scripts/run-migration.mjs migrations/014_a.sql migrations/015_b.sql
import fs from 'fs'
import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', max: 1 })
const files = process.argv.slice(2)

if (files.length === 0) {
  console.error('Uso: doppler run -- node scripts/run-migration.mjs <arquivo.sql> [...]')
  process.exit(1)
}

for (const file of files) {
  console.log(`Running ${file}...`)
  await sql.unsafe(fs.readFileSync(file, 'utf8'))
  console.log(`✓ ${file}`)
}

await sql.end()
