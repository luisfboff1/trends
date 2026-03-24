import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', max: 1 })

console.log('=== ANÁLISE DE CLIENTES ===\n')

// 1. Clientes no banco (cadastrados)
const dbClients = await sql`SELECT id, razao_social, cnpj, uniplus_id FROM clientes ORDER BY razao_social`
console.log(`Clientes cadastrados no sistema: ${dbClients.length}`)
if (dbClients.length > 0) {
  console.log('  Exemplos:')
  for (const c of dbClients.slice(0, 10)) {
    console.log(`    [${c.id}] ${c.razao_social} | CNPJ: ${c.cnpj || '-'} | Uniplus: ${c.uniplus_id || '-'}`)
  }
}

// 2. Clientes únicos dos pedidos importados
const excelClients = await sql`
  SELECT cliente_nome, COUNT(*) as pedidos, MIN(data_entrega) as primeiro, MAX(data_entrega) as ultimo
  FROM pedidos 
  WHERE origem = 'importacao' AND cliente_nome IS NOT NULL
  GROUP BY cliente_nome
  ORDER BY pedidos DESC
`
console.log(`\nClientes únicos nos pedidos importados: ${excelClients.length}`)
console.log('  Top 30 por volume:')
for (const c of excelClients.slice(0, 30)) {
  console.log(`    ${c.cliente_nome.padEnd(30)} | ${String(c.pedidos).padStart(4)} pedidos | ${c.primeiro || '?'} → ${c.ultimo || '?'}`)
}

// 3. Tentar matching por nome (ILIKE / similaridade)
console.log('\n=== MATCHING AUTOMÁTICO ===')
let matched = 0
let unmatched = 0
const matchResults = []
const unmatchedList = []

for (const ec of excelClients) {
  // Try exact match (case insensitive)
  const exact = dbClients.find(dc => 
    dc.razao_social.toUpperCase().trim() === ec.cliente_nome.toUpperCase().trim()
  )
  if (exact) {
    matched++
    matchResults.push({ excel: ec.cliente_nome, db: exact.razao_social, db_id: exact.id, pedidos: ec.pedidos, type: 'EXATO' })
    continue
  }

  // Try contains match
  const contains = dbClients.find(dc => 
    dc.razao_social.toUpperCase().includes(ec.cliente_nome.toUpperCase()) ||
    ec.cliente_nome.toUpperCase().includes(dc.razao_social.toUpperCase())
  )
  if (contains) {
    matched++
    matchResults.push({ excel: ec.cliente_nome, db: contains.razao_social, db_id: contains.id, pedidos: ec.pedidos, type: 'PARCIAL' })
    continue
  }

  unmatched++
  unmatchedList.push({ nome: ec.cliente_nome, pedidos: ec.pedidos })
}

console.log(`\nResultado do matching:`)
console.log(`  Encontrados:     ${matched} clientes (${matchResults.reduce((s, m) => s + Number(m.pedidos), 0)} pedidos)`)
console.log(`  Não encontrados: ${unmatched} clientes (${unmatchedList.reduce((s, m) => s + Number(m.pedidos), 0)} pedidos)`)

if (matchResults.length > 0) {
  console.log(`\n  Matches encontrados:`)
  for (const m of matchResults.slice(0, 20)) {
    console.log(`    "${m.excel}" → "${m.db}" [id:${m.db_id}] (${m.type}, ${m.pedidos} pedidos)`)
  }
}

console.log(`\n  Top clientes SEM match no banco (por volume):`)
for (const u of unmatchedList.slice(0, 50)) {
  console.log(`    ${u.nome.padEnd(35)} | ${String(u.pedidos).padStart(4)} pedidos`)
}

// 4. Check Uniplus clients
const uniplusClients = dbClients.filter(c => c.uniplus_id)
console.log(`\n=== UNIPLUS ===`)
console.log(`Clientes com uniplus_id: ${uniplusClients.length}`)
if (uniplusClients.length > 0) {
  for (const c of uniplusClients.slice(0, 10)) {
    console.log(`  [${c.id}] ${c.razao_social} → uniplus_id: ${c.uniplus_id}`)
  }
}

await sql.end()
