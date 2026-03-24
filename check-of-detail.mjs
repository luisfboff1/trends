import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL);

// Check OF formats
const ofFormats = await sql`
  SELECT ordem_fabricacao, count(*) as qty
  FROM pedidos 
  WHERE origem = 'importacao' AND ordem_fabricacao IS NOT NULL AND ordem_fabricacao != ''
  GROUP BY ordem_fabricacao
  ORDER BY qty DESC
  LIMIT 30
`;
console.log('=== TOP 30 OFs mais repetidas ===');
ofFormats.forEach(r => console.log(`  OF="${r.ordem_fabricacao}" | ${r.qty}x`));

// Check OF numeric range
const ofNumeric = await sql`
  SELECT 
    min(regexp_replace(ordem_fabricacao, '[^0-9]', '', 'g')::bigint) as min_of,
    max(regexp_replace(ordem_fabricacao, '[^0-9]', '', 'g')::bigint) as max_of,
    count(distinct ordem_fabricacao) as unique_ofs
  FROM pedidos 
  WHERE origem = 'importacao' 
    AND ordem_fabricacao IS NOT NULL 
    AND ordem_fabricacao != ''
    AND regexp_replace(ordem_fabricacao, '[^0-9]', '', 'g') != ''
`;
console.log('\nRange numérico OF:', JSON.stringify(ofNumeric[0], null, 2));

// OF examples per year
const ofPerYear = await sql`
  SELECT mes_referencia, 
    min(ordem_fabricacao) as min_of, 
    max(ordem_fabricacao) as max_of, 
    count(*) as qty
  FROM pedidos 
  WHERE origem = 'importacao' AND ordem_fabricacao IS NOT NULL AND ordem_fabricacao != ''
  GROUP BY mes_referencia
  ORDER BY mes_referencia
`;
console.log('\nOF por mês:');
ofPerYear.forEach(r => console.log(`  ${r.mes_referencia.padEnd(20)} | min=${r.min_of.padEnd(10)} max=${r.max_of.padEnd(10)} | ${r.qty} pedidos`));

// Check Uniplus venda structure in the code - what field becomes the "numero"?
// syncVendas uses: numero = `UP-${documento || codigo}`, uniplus_id = String(v.idVenda)
// So Uniplus pedidos would have numero like "UP-12345" and uniplus_id = idVenda

// Check if the Excel OF numbers could match Uniplus "documento" numbers
// The OFs go from ~1000 (2019) to ~22000+ (2026) - these are sequential production OFs

// Also check non-numeric OFs
const nonNumericOfs = await sql`
  SELECT ordem_fabricacao, count(*) as qty
  FROM pedidos 
  WHERE origem = 'importacao' 
    AND ordem_fabricacao IS NOT NULL 
    AND ordem_fabricacao != ''
    AND ordem_fabricacao !~ '^\d+$'
  ORDER BY qty DESC
  LIMIT 20
`;
console.log('\nOFs não-numéricos:');
if (nonNumericOfs.length === 0) {
  console.log('  Todos os OFs são numéricos puros');
} else {
  nonNumericOfs.forEach(r => console.log(`  OF="${r.ordem_fabricacao}" | ${r.qty}x`));
}

await sql.end();
