import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL);
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Check duplicate documento in vendas from the API
async function main() {
  // First check what vendas we already have
  const dupeNumeros = await sql`
    SELECT numero, COUNT(*) as c FROM pedidos WHERE origem = 'uniplus' GROUP BY numero HAVING COUNT(*) > 1
  `;
  console.log('Números duplicados em pedidos uniplus:', dupeNumeros.length);
  dupeNumeros.forEach(r => console.log(`  ${r.numero}: ${r.c}x`));

  // Check the numero constraint
  const [constraint] = await sql`
    SELECT constraint_name, constraint_type
    FROM information_schema.table_constraints
    WHERE table_name = 'pedidos' AND constraint_name = 'pedidos_numero_key'
  `;
  console.log('\nConstraint:', constraint);

  // Check if any uniplus numero collides with importacao
  const collisions = await sql`
    SELECT a.numero, a.origem as origem_a, b.origem as origem_b
    FROM pedidos a
    JOIN pedidos b ON a.numero = b.numero AND a.id != b.id
    LIMIT 10
  `;
  console.log('\nColisões de numero entre origens:', collisions.length);
  collisions.forEach(r => console.log(`  ${r.numero}: ${r.origem_a} vs ${r.origem_b}`));

  // Check vendas numeros
  const sample = await sql`
    SELECT numero, uniplus_id, cliente_nome FROM pedidos WHERE origem = 'uniplus' ORDER BY id LIMIT 10
  `;
  console.log('\nAmostra vendas uniplus:');
  sample.forEach(r => console.log(`  ${r.numero} | uniplus_id=${r.uniplus_id} | ${r.cliente_nome}`));

  // Check importacao numeros  
  const sampleImp = await sql`
    SELECT numero FROM pedidos WHERE origem = 'importacao' ORDER BY id LIMIT 10
  `;
  console.log('\nAmostra pedidos importação:');
  sampleImp.forEach(r => console.log(`  ${r.numero}`));

  // Check if numero is nullable
  const [col] = await sql`
    SELECT is_nullable, column_default FROM information_schema.columns
    WHERE table_name = 'pedidos' AND column_name = 'numero'
  `;
  console.log('\nColuna numero:', col);

  await sql.end();
}

main().catch(err => { console.error(err); process.exit(1); });
