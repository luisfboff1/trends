import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

const [total] = await sql`SELECT COUNT(*) as total FROM clientes`;
const [comVendedor] = await sql`SELECT COUNT(*) as total FROM clientes WHERE vendedor_id IS NOT NULL`;
const [comUniplus] = await sql`SELECT COUNT(*) as total FROM clientes WHERE uniplus_id IS NOT NULL`;
const [comCnpj] = await sql`SELECT COUNT(*) as total FROM clientes WHERE cnpj IS NOT NULL AND cnpj != ''`;
const [semNome] = await sql`SELECT COUNT(*) as total FROM clientes WHERE razao_social IS NULL OR razao_social = ''`;

console.log('=== ESTADO DOS CLIENTES ===');
console.log('Total clientes:', total.total);
console.log('Com vendedor_id:', comVendedor.total);
console.log('Com uniplus_id:', comUniplus.total);
console.log('Com CNPJ:', comCnpj.total);
console.log('Sem nome (razao_social):', semNome.total);

console.log('\n--- Últimos 10 atualizados ---');
const sample = await sql`SELECT id, razao_social, cnpj, uniplus_id, vendedor_id FROM clientes ORDER BY updated_at DESC LIMIT 10`;
sample.forEach(c => console.log(`  [${c.id}] ${(c.razao_social||'').substring(0,40)} | CNPJ: ${c.cnpj || 'NULL'} | uniplus: ${c.uniplus_id} | vendedor: ${c.vendedor_id}`));

console.log('\n--- Duplicatas por CNPJ ---');
const dupes = await sql`SELECT cnpj, COUNT(*) as qtd FROM clientes WHERE cnpj IS NOT NULL AND cnpj != '' GROUP BY cnpj HAVING COUNT(*) > 1 ORDER BY qtd DESC LIMIT 10`;
console.log('Duplicatas CNPJ (top 10):', dupes.length > 0 ? '' : 'Nenhuma');
dupes.forEach(d => console.log(`  CNPJ: ${d.cnpj} → ${d.qtd}x`));

console.log('\n--- Clientes sem uniplus_id ---');
const semUniplus = await sql`SELECT id, razao_social, cnpj FROM clientes WHERE uniplus_id IS NULL LIMIT 5`;
console.log('Sem uniplus_id:', semUniplus.length, 'exemplos');
semUniplus.forEach(c => console.log(`  [${c.id}] ${(c.razao_social||'').substring(0,40)} | CNPJ: ${c.cnpj || 'NULL'}`));

await sql.end();
