import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

console.log('=== ESTADO DAS VENDAS ===');
const [totalVendas] = await sql`SELECT COUNT(*) as total FROM pedidos`;
const [comCliente] = await sql`SELECT COUNT(*) as total FROM pedidos WHERE cliente_id IS NOT NULL`;
const [comVendedor] = await sql`SELECT COUNT(*) as total FROM pedidos WHERE vendedor_id IS NOT NULL`;
const [comUniplusCodigo] = await sql`SELECT COUNT(*) as total FROM pedidos WHERE uniplus_cliente_codigo IS NOT NULL`;

console.log('Total vendas:', totalVendas.total);
console.log('Com cliente_id:', comCliente.total, `(${(comCliente.total/totalVendas.total*100).toFixed(1)}%)`);
console.log('Com vendedor_id:', comVendedor.total, `(${(comVendedor.total/totalVendas.total*100).toFixed(1)}%)`);
console.log('Com uniplus_cliente_codigo:', comUniplusCodigo.total, `(${(comUniplusCodigo.total/totalVendas.total*100).toFixed(1)}%)`);

console.log('\n=== ESTADO DOS CLIENTES ===');
const [totalCli] = await sql`SELECT COUNT(*) as total FROM clientes`;
const [cliComVendedor] = await sql`SELECT COUNT(*) as total FROM clientes WHERE vendedor_id IS NOT NULL`;
console.log('Total clientes:', totalCli.total);
console.log('Com vendedor_id:', cliComVendedor.total, `(${(cliComVendedor.total/totalCli.total*100).toFixed(1)}%)`);

console.log('\n=== VENDEDORES ===');
const vendedores = await sql`SELECT id, nome, uniplus_id FROM usuarios WHERE tipo = 'vendedor'`;
console.log('Total vendedores:', vendedores.length);
vendedores.forEach(v => console.log(`  [${v.id}] ${v.nome} (uniplus: ${v.uniplus_id})`));

await sql.end();
