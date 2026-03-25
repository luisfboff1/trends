import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

const [c] = await sql`SELECT COUNT(*) as total FROM clientes`;
const [cu] = await sql`SELECT COUNT(*) as total FROM clientes WHERE uniplus_id IS NOT NULL`;
console.log('Clientes total:', c.total, '| Uniplus:', cu.total);

const [match] = await sql`SELECT COUNT(*) as total FROM pedidos WHERE cliente_id IS NOT NULL AND origem='uniplus'`;
const [nomatch] = await sql`SELECT COUNT(*) as total FROM pedidos WHERE cliente_id IS NULL AND origem='uniplus'`;
console.log('Vendas com cliente:', match.total, '| Sem cliente:', nomatch.total);

// Sample unmatched vendas
const samples = await sql`SELECT DISTINCT cliente_nome FROM pedidos WHERE cliente_id IS NULL AND origem='uniplus' LIMIT 15`;
console.log('Exemplos vendas sem match:');
for (const s of samples) console.log(' -', s.cliente_nome);

// Check CNPJ duplicates in DB
const dupes = await sql`SELECT cnpj, COUNT(*) as cnt FROM clientes WHERE cnpj IS NOT NULL AND cnpj != '' GROUP BY cnpj HAVING COUNT(*) > 1 LIMIT 10`;
console.log('\nCNPJ duplicados no DB:', dupes.length);
for (const d of dupes) console.log('  ', d.cnpj, '→', d.cnt, 'registros');

// Check CNPJ unique constraint/index
const idx = await sql`SELECT indexname, indexdef FROM pg_indexes WHERE tablename='clientes' AND indexdef LIKE '%cnpj%'`;
console.log('\nIndices CNPJ:');
for (const i of idx) console.log(' ', i.indexname, '→', i.indexdef);

// How many entities from API would have duplicate CNPJ?
// Check how many clientes have uniplus_id
const [uid] = await sql`SELECT COUNT(*) as total FROM clientes WHERE uniplus_id IS NOT NULL`;
console.log('\nClientes com uniplus_id:', uid.total);

await sql.end();
