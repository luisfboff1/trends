import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL);

const dates = await sql`SELECT 
  count(*) filter (where data_producao is not null) as com_data_producao,
  count(*) filter (where data_entrega is not null) as com_data_entrega,
  count(*) filter (where data_producao is null and data_entrega is null) as sem_data,
  count(*) as total
FROM pedidos WHERE origem = 'importacao'`;
console.log('Datas:', JSON.stringify(dates[0], null, 2));

const sample = await sql`SELECT data_producao, data_entrega, mes_referencia, cliente_nome 
FROM pedidos WHERE origem = 'importacao' AND (data_producao IS NOT NULL OR data_entrega IS NOT NULL)
ORDER BY data_producao DESC NULLS LAST LIMIT 10`;
console.log('\nAmostra com data:');
sample.forEach(r => console.log(r.data_producao, '|', r.data_entrega, '|', r.mes_referencia, '|', r.cliente_nome));

const refs = await sql`SELECT mes_referencia, count(*) as qty 
FROM pedidos WHERE origem = 'importacao' 
GROUP BY mes_referencia ORDER BY mes_referencia`;
console.log('\nMês referência (todos):');
refs.forEach(r => console.log('  ' + r.mes_referencia.padEnd(20) + r.qty));

await sql.end();
