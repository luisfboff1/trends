import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL);

// Map mes_referencia strings to {year, month}
const MONTH_MAP = {
  'JANEIRO': 1, 'FEVEREIRO': 2, 'MARCO': 3, 'MARÇO': 3,
  'ABRIL': 4, 'MAIO': 5, 'JUNHO': 6, 'JULHO': 7,
  'AGOSTO': 8, 'SETEMBRO': 9, 'OUTUBRO': 10, 'NOVEMBRO': 11, 'DEZEMBRO': 12,
};

function parseMesRef(ref) {
  if (!ref) return null;
  const s = ref.trim().toUpperCase();
  for (const [name, month] of Object.entries(MONTH_MAP)) {
    if (s.startsWith(name)) {
      const rest = s.slice(name.length).trim();
      let year = parseInt(rest);
      if (isNaN(year)) continue;
      if (year < 100) year += 2000;
      return { year, month };
    }
  }
  return null;
}

// Get all unique mes_referencia values
const refs = await sql`
  SELECT DISTINCT mes_referencia FROM pedidos 
  WHERE origem = 'importacao' AND mes_referencia IS NOT NULL
  ORDER BY mes_referencia
`;

console.log('=== Normalizando datas dos pedidos importados ===\n');

let totalUpdated = 0;
let totalSkipped = 0;

for (const { mes_referencia } of refs) {
  const parsed = parseMesRef(mes_referencia);
  if (!parsed) {
    console.log(`  SKIP: "${mes_referencia}" — não consegui parsear`);
    totalSkipped++;
    continue;
  }

  const defaultDate = `${parsed.year}-${String(parsed.month).padStart(2, '0')}-10`;

  // Update pedidos without data_producao
  const result = await sql`
    UPDATE pedidos 
    SET data_producao = ${defaultDate}::date
    WHERE origem = 'importacao' 
      AND mes_referencia = ${mes_referencia}
      AND data_producao IS NULL
  `;
  
  // Also fill data_entrega if missing (use day 15)
  const defaultEntrega = `${parsed.year}-${String(parsed.month).padStart(2, '0')}-15`;
  const result2 = await sql`
    UPDATE pedidos 
    SET data_entrega = ${defaultEntrega}::date
    WHERE origem = 'importacao' 
      AND mes_referencia = ${mes_referencia}
      AND data_entrega IS NULL
  `;

  const count1 = result.count;
  const count2 = result2.count;
  if (count1 > 0 || count2 > 0) {
    console.log(`  ${mes_referencia.padEnd(20)} → ${defaultDate} | ${count1} data_producao, ${count2} data_entrega preenchidos`);
  }
  totalUpdated += count1 + count2;
}

// Verify final state
const check = await sql`
  SELECT 
    count(*) as total,
    count(*) filter (where data_producao is not null) as com_data_producao,
    count(*) filter (where data_entrega is not null) as com_data_entrega,
    count(*) filter (where data_producao is null) as sem_data_producao,
    count(*) filter (where data_entrega is null) as sem_data_entrega
  FROM pedidos WHERE origem = 'importacao'
`;

console.log(`\n=== Resultado ===`);
console.log(`  Total atualizados: ${totalUpdated}`);
console.log(`  Skipped: ${totalSkipped}`);
console.log(`\n=== Estado final ===`);
console.log(JSON.stringify(check[0], null, 2));

await sql.end();
