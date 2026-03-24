import fs from 'fs'
import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', max: 1 })

console.log('Rodando migration 010_pedidos_producao.sql...')
await sql.unsafe(fs.readFileSync('migrations/010_pedidos_producao.sql', 'utf8'))
console.log('Migration 010 OK!')

await sql.end()
