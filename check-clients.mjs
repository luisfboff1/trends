import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

const [totals] = await sql`SELECT count(*) as total, count(DISTINCT uniplus_id) as distinct_uniplus FROM clientes WHERE uniplus_id IS NOT NULL`;
console.log('Clientes com uniplus_id:', totals);

const dupes = await sql`SELECT uniplus_id, count(*) as cnt FROM clientes WHERE uniplus_id IS NOT NULL GROUP BY uniplus_id HAVING count(*) > 1 LIMIT 5`;
console.log('Duplicados uniplus_id:', dupes);

const [noUniplus] = await sql`SELECT count(*) as total FROM clientes WHERE uniplus_id IS NULL`;
console.log('Sem uniplus_id:', noUniplus);

const [maxCode] = await sql`SELECT max(uniplus_id::int) as max_code FROM clientes WHERE uniplus_id IS NOT NULL AND uniplus_id ~ '^[0-9]+$'`;
console.log('Max uniplus_id (codigo):', maxCode);

await sql.end();
