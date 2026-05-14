import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

const vendedores = await sql`SELECT COUNT(*) as total FROM usuarios WHERE tipo='vendedor' AND uniplus_id IS NOT NULL`;
const clientesComVendedor = await sql`SELECT COUNT(*) as total FROM clientes WHERE vendedor_id IS NOT NULL`;
const vendasComVendedor = await sql`SELECT COUNT(*) as total FROM pedidos WHERE vendedor_id IS NOT NULL AND uniplus_id IS NOT NULL`;
const vendasComCliente = await sql`SELECT COUNT(*) as total FROM pedidos WHERE cliente_id IS NOT NULL AND uniplus_id IS NOT NULL`;
const pedidosComCodigoCliente = await sql`SELECT COUNT(*) as total FROM pedidos WHERE uniplus_cliente_codigo IS NOT NULL`;

console.log('=== STATUS VENDEDORES ===');
console.log('Vendedores sincronizados (usuarios):', vendedores[0].total);
console.log('Clientes com vendedor_id:', clientesComVendedor[0].total);
console.log('Vendas com vendedor_id:', vendasComVendedor[0].total);
console.log('Vendas com cliente_id:', vendasComCliente[0].total);
console.log('Vendas com uniplus_cliente_codigo:', pedidosComCodigoCliente[0].total);

await sql.end();
