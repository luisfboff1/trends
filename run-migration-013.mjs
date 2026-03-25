import postgres from 'postgres'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' })

async function run() {
  const migrationPath = resolve('migrations/013_rbac_permissoes.sql')
  const migrationSQL = readFileSync(migrationPath, 'utf8')

  console.log('Running migration 013_rbac_permissoes.sql...\n')
  await sql.unsafe(migrationSQL)
  console.log('  ✓ Migration executed')

  // Verify: show users and their permissions
  const users = await sql`SELECT id, nome, email, tipo, ativo FROM usuarios ORDER BY id`
  console.log(`\n── Usuarios (${users.length}) ──`)
  for (const u of users) {
    const perms = await sql`SELECT feature, habilitado FROM usuario_permissoes WHERE usuario_id = ${u.id} ORDER BY feature`
    const enabled = perms.filter(p => p.habilitado).map(p => p.feature).join(', ')
    const disabled = perms.filter(p => !p.habilitado).map(p => p.feature).join(', ')
    console.log(`  [${u.id}] ${u.nome} (${u.tipo}${u.ativo ? '' : ', pendente'})`)
    console.log(`      ✅ ${enabled || '(nenhum)'}`)
    if (disabled) console.log(`      ❌ ${disabled}`)
  }

  await sql.end()
  console.log('\n✓ Migration 013 complete!')
}

run().catch(err => { console.error('ERRO:', err.message); process.exit(1) })
