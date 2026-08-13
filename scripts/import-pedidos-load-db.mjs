import fs from 'fs'
import postgres from 'postgres'

const BATCH_SIZE = 200
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', max: 5 })

// Clear previous imports
console.log('Limpando importações anteriores...')
const deleted = await sql`DELETE FROM pedidos WHERE origem = 'importacao'`
console.log(`  Removidos: ${deleted.count} registros`)

// Load JSON
const records = JSON.parse(fs.readFileSync('pedidos_import.json', 'utf8'))
console.log(`\nImportando ${records.length} pedidos...`)

let inserted = 0
let errors = 0

for (let i = 0; i < records.length; i += BATCH_SIZE) {
  const batch = records.slice(i, i + BATCH_SIZE)
  const values = batch.map(r => ({
    numero: r.numero,
    cliente_nome: r.cliente_nome || null,
    status: r.status || 'pendente',
    valor_total: r.valor_total ?? null,
    data_entrega: r.data_entrega || null,
    observacoes: null,
    ordem_fabricacao: r.ordem_fabricacao || null,
    material: r.material || null,
    codigo_faca: r.codigo_faca || null,
    etiqueta_dimensao: r.etiqueta_dimensao || null,
    quantidade: r.quantidade ?? null,
    produzido_por: r.produzido_por || null,
    tipo_producao: r.tipo_producao || null,
    ordem_compra: r.ordem_compra || null,
    data_producao: r.data_producao || null,
    mes_referencia: r.mes_referencia || null,
    origem: 'importacao',
  }))

  try {
    await sql`
      INSERT INTO pedidos ${sql(values,
        'numero', 'cliente_nome', 'status', 'valor_total', 'data_entrega',
        'observacoes', 'ordem_fabricacao', 'material', 'codigo_faca',
        'etiqueta_dimensao', 'quantidade', 'produzido_por', 'tipo_producao',
        'ordem_compra', 'data_producao', 'mes_referencia', 'origem'
      )}
      ON CONFLICT (numero) DO NOTHING
    `
    inserted += batch.length
  } catch (err) {
    console.error(`  Erro batch ${i}-${i + batch.length}:`, err.message)
    errors += batch.length
  }

  if ((i + BATCH_SIZE) % 2000 === 0 || i + BATCH_SIZE >= records.length) {
    console.log(`  Progresso: ${Math.min(i + BATCH_SIZE, records.length)}/${records.length}`)
  }
}

console.log(`\n=== Resultado ===`)
console.log(`  Inseridos: ${inserted}`)
console.log(`  Erros:     ${errors}`)

// Quick verification
const [{ count }] = await sql`SELECT COUNT(*) FROM pedidos WHERE origem = 'importacao'`
console.log(`  No banco:  ${count} registros importados`)

// Stats
const stats = await sql`
  SELECT
    COUNT(DISTINCT cliente_nome) as clientes,
    COUNT(DISTINCT material) as materiais,
    COUNT(DISTINCT tipo_producao) as tipos,
    MIN(data_entrega) as primeira_data,
    MAX(data_entrega) as ultima_data
  FROM pedidos WHERE origem = 'importacao'
`
console.log(`  Clientes únicos: ${stats[0].clientes}`)
console.log(`  Materiais:       ${stats[0].materiais}`)
console.log(`  Período:         ${stats[0].primeira_data} → ${stats[0].ultima_data}`)

await sql.end()
