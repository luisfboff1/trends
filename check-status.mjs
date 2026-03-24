import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL);

const [c] = await sql`SELECT COUNT(*) as total, COUNT(CASE WHEN uniplus_id IS NOT NULL THEN 1 END) as uniplus FROM clientes`;
console.log('Clientes:', c.total, 'total,', c.uniplus, 'uniplus');

const [p] = await sql`SELECT COUNT(*) as total, COUNT(CASE WHEN uniplus_id IS NOT NULL THEN 1 END) as uniplus FROM tipos_papel`;
console.log('Produtos:', p.total, 'total,', p.uniplus, 'uniplus');

const [v] = await sql`SELECT COUNT(*) as total FROM pedidos WHERE origem = 'uniplus'`;
console.log('Vendas uniplus:', v.total);

const [vm] = await sql`SELECT COUNT(*) as total FROM pedidos WHERE origem = 'uniplus' AND cliente_id IS NOT NULL`;
console.log('Vendas com cliente_id:', vm.total);

await sql.end();
