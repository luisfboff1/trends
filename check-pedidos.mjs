import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL);

const total = await sql`SELECT count(*) as total FROM pedidos WHERE origem = 'importacao'`;
console.log('Total importados:', total[0].total);

const sample = await sql`SELECT numero, cliente_nome, cliente_id, material, codigo_faca, etiqueta_dimensao, quantidade, tipo_producao, ordem_fabricacao, valor_total, status, data_producao, mes_referencia, origem FROM pedidos WHERE origem = 'importacao' ORDER BY data_producao DESC LIMIT 5`;
console.log('\nAmostra (5 recentes):');
sample.forEach(r => console.log(JSON.stringify(r, null, 2)));

const nullCheck = await sql`SELECT 
  count(*) filter (where cliente_nome is null or cliente_nome = '') as sem_cliente,
  count(*) filter (where material is null or material = '') as sem_material,
  count(*) filter (where quantidade is null) as sem_quantidade,
  count(*) filter (where tipo_producao is null or tipo_producao = '') as sem_tipo,
  count(*) filter (where valor_total is null or valor_total = 0) as sem_valor,
  count(*) filter (where cliente_id is not null) as com_cliente_id
FROM pedidos WHERE origem = 'importacao'`;
console.log('\nCampos nulos/vazios:', JSON.stringify(nullCheck[0], null, 2));

await sql.end();
