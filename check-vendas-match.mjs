import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

// 1. Vendas sem cliente_id
const [sem] = await sql`SELECT count(*) as total FROM pedidos WHERE origem = 'uniplus' AND cliente_id IS NULL`;
console.log('Vendas SEM cliente_id:', sem.total);

// 2. Vendas com cliente_id  
const [com] = await sql`SELECT count(*) as total FROM pedidos WHERE origem = 'uniplus' AND cliente_id IS NOT NULL`;
console.log('Vendas COM cliente_id:', com.total);

// 3. Como a venda referencia o cliente? Checar campos disponíveis
const sample = await sql`SELECT id, numero, cliente_nome, cliente_id, uniplus_id FROM pedidos WHERE origem = 'uniplus' AND cliente_id IS NULL LIMIT 5`;
console.log('\nExemplos vendas sem cliente:');
sample.forEach(v => console.log(`  #${v.numero} | cliente_nome="${v.cliente_nome}" | uniplus_id=${v.uniplus_id}`));

// 4. Vendas com cliente - como linkaram?
const sample2 = await sql`SELECT p.id, p.numero, p.cliente_nome, p.cliente_id, c.razao_social, c.uniplus_id as cli_uniplus 
  FROM pedidos p JOIN clientes c ON c.id = p.cliente_id 
  WHERE p.origem = 'uniplus' LIMIT 5`;
console.log('\nExemplos vendas COM cliente:');
sample2.forEach(v => console.log(`  #${v.numero} | venda_nome="${v.cliente_nome}" | cliente="${v.razao_social}" | cli_uniplus=${v.cli_uniplus}`));

// 5. Vendas: existe campo que guarda o codigoCliente do Uniplus?
const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'pedidos' ORDER BY ordinal_position`;
console.log('\nColunas pedidos:', cols.map(c => c.column_name).join(', '));

// 6. Quantas vendas teriam match por nome exato (case-insensitive)?
const [matchNome] = await sql`
  SELECT count(*) as total FROM pedidos p 
  WHERE p.origem = 'uniplus' AND p.cliente_id IS NULL 
  AND EXISTS (SELECT 1 FROM clientes c WHERE lower(trim(c.razao_social)) = lower(trim(p.cliente_nome)))`;
console.log('\nVendas sem cliente que TÊM match por nome:', matchNome.total);

// 7. Exemplos de vendas sem match  
const noMatch = await sql`
  SELECT p.cliente_nome, count(*) as cnt FROM pedidos p 
  WHERE p.origem = 'uniplus' AND p.cliente_id IS NULL 
  AND NOT EXISTS (SELECT 1 FROM clientes c WHERE lower(trim(c.razao_social)) = lower(trim(p.cliente_nome)))
  GROUP BY p.cliente_nome ORDER BY cnt DESC LIMIT 10`;
console.log('\nTop 10 nomes de cliente sem match no banco:');
noMatch.forEach(r => console.log(`  "${r.cliente_nome}" (${r.cnt} vendas)`));

await sql.end();
