import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL);

// 1. Check OF ranges in imported pedidos
const ofStats = await sql`
  SELECT 
    min(ordem_fabricacao::int) filter (where ordem_fabricacao ~ '^\d+$') as min_of,
    max(ordem_fabricacao::int) filter (where ordem_fabricacao ~ '^\d+$') as max_of,
    count(*) filter (where ordem_fabricacao is not null and ordem_fabricacao != '') as com_of,
    count(*) filter (where ordem_fabricacao is null or ordem_fabricacao = '') as sem_of
  FROM pedidos WHERE origem = 'importacao'
`;
console.log('=== ORDEM FABRICAÇÃO (OF) nos pedidos importados ===');
console.log(JSON.stringify(ofStats[0], null, 2));

// 2. Sample OFs from different years
const ofSample = await sql`
  SELECT mes_referencia, ordem_fabricacao, cliente_nome, material
  FROM pedidos 
  WHERE origem = 'importacao' AND ordem_fabricacao IS NOT NULL AND ordem_fabricacao != ''
  ORDER BY mes_referencia DESC
  LIMIT 20
`;
console.log('\nAmostra OFs recentes:');
ofSample.forEach(r => console.log(`  ${r.mes_referencia} | OF=${r.ordem_fabricacao} | ${r.cliente_nome} | ${r.material}`));

// 3. Check for existing uniplus pedidos
const upPedidos = await sql`
  SELECT count(*) as total FROM pedidos WHERE origem = 'uniplus' OR uniplus_id IS NOT NULL
`;
console.log('\nPedidos com origem uniplus ou uniplus_id:', upPedidos[0].total);

// 4. Check what columns the Uniplus venda maps to
// The syncVendas creates pedidos with: numero=UP-{doc/code}, uniplus_id={idVenda}
// Does the Uniplus venda have an "ordem_fabricacao" or "documento" that matches Excel OFs?

// 5. Look at all unique fields in the import to spot any Uniplus-like codes
const ordemCompra = await sql`
  SELECT ordem_compra, count(*) as qty 
  FROM pedidos 
  WHERE origem = 'importacao' AND ordem_compra IS NOT NULL AND ordem_compra != ''
  GROUP BY ordem_compra 
  ORDER BY qty DESC 
  LIMIT 20
`;
console.log('\nOrdens de Compra (OC) nos pedidos importados:');
ordemCompra.forEach(r => console.log(`  OC=${r.ordem_compra} | ${r.qty} pedidos`));

// 6. Check the numero format (HIST-YYYYMM-XXXX) to see if there are any non-HIST pedidos
const numFormats = await sql`
  SELECT 
    left(numero, 4) as prefix, count(*) as qty
  FROM pedidos 
  GROUP BY left(numero, 4) 
  ORDER BY qty DESC
`;
console.log('\nPrefixos de numero:');
numFormats.forEach(r => console.log(`  ${r.prefix} | ${r.qty} pedidos`));

// 7. All columns in pedidos table
const cols = await sql`
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'pedidos' 
  ORDER BY ordinal_position
`;
console.log('\nColunas da tabela pedidos:');
cols.forEach(c => console.log(`  ${c.column_name} (${c.data_type})`));

await sql.end();
