import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL);
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

let token = null, config = null;

async function loadConfig() {
  const [c] = await sql`SELECT server_url, auth_code, user_id, user_password FROM uniplus_config WHERE ativo = true LIMIT 1`;
  config = c;
}

async function authenticate() {
  if (token && (Date.now() - token.obtained_at) < (token.expires_in - 60) * 1000) return token.access_token;
  const baseUrl = config.server_url.replace(/\/$/, '');
  const resp = await fetch(`${baseUrl}/oauth/token`, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${config.auth_code}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const data = await resp.json();
  token = { ...data, obtained_at: Date.now() };
  return token.access_token;
}

async function uniplusGet(path, params = {}) {
  const accessToken = await authenticate();
  const baseUrl = config.server_url.replace(/\/$/, '');
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) qs.set(k, String(v));
  const url = `${baseUrl}${path}${qs.toString() ? '?' + qs : ''}`;
  const resp = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}`, 'userid': config.user_id, 'password': config.user_password },
  });
  if (!resp.ok) return { error: resp.status, text: (await resp.text()).substring(0, 120) };
  const data = await resp.json();
  return Array.isArray(data) ? data : (data?.value || []);
}

async function main() {
  await loadConfig();
  await authenticate();

  // ═══ 1. Test entidades pagination ═══
  console.log('═══ ENTIDADES ═══\n');
  
  // Try different offsets
  for (const offset of [0, 50, 100, 200]) {
    const r = await uniplusGet('/public-api/v1/entidades', { limit: 100, offset });
    console.log(`  offset=${offset}: ${r.error ? `ERROR ${r.error}: ${r.text}` : `${r.length} results`}`);
  }

  // Try filter by codigo range
  console.log('\n  Tentando filtros por código:');
  for (const param of ['codigo.gt', 'codigo.ge', 'codigo.gte', 'id.gt', 'id.ge']) {
    const r = await uniplusGet('/public-api/v1/entidades', { [param]: 0, limit: 100 });
    console.log(`  ${param}=0: ${r.error ? `ERROR ${r.error}` : `${r.length} results`}`);
  }

  // Try inativo filter
  for (const val of [0, 1]) {
    const r = await uniplusGet('/public-api/v1/entidades', { 'inativo.eq': val, limit: 100 });
    console.log(`  inativo.eq=${val}: ${r.error ? `ERROR ${r.error}` : `${r.length} results`}`);
  }

  // Get all 100 and check max/min codigo
  const ents = await uniplusGet('/public-api/v1/entidades', { limit: 100 });
  if (!ents.error) {
    const codigos = ents.map(e => e.codigo).sort((a, b) => a - b);
    console.log(`\n  Códigos: min=${codigos[0]}, max=${codigos[codigos.length - 1]}`);
    console.log(`  Tipos: ${[...new Set(ents.map(e => e.tipo))].join(', ')}`);
    
    // Try fetching with codigo.gt = max
    const maxCod = codigos[codigos.length - 1];
    const next = await uniplusGet('/public-api/v1/entidades', { 'codigo.gt': maxCod, limit: 100 });
    console.log(`  codigo.gt=${maxCod}: ${next.error ? `ERROR ${next.error}: ${next.text}` : `${next.length} results`}`);
    
    // Try page parameter
    for (const page of [1, 2, 3]) {
      const r = await uniplusGet('/public-api/v1/entidades', { limit: 100, page });
      console.log(`  page=${page}: ${r.error ? `ERROR ${r.error}` : `${r.length} results`}`);
    }
  }

  // ═══ 2. Test produtos pagination ═══
  console.log('\n═══ PRODUTOS ═══\n');
  
  for (const offset of [0, 50, 100]) {
    const r = await uniplusGet('/public-api/v1/produtos', { limit: 100, offset });
    console.log(`  offset=${offset}: ${r.error ? `ERROR ${r.error}: ${r.text}` : `${r.length} results`}`);
  }

  const prods = await uniplusGet('/public-api/v1/produtos', { limit: 100 });
  if (!prods.error) {
    const codigos = prods.map(p => p.codigo).sort((a, b) => a - b);
    console.log(`  Códigos: min=${codigos[0]}, max=${codigos[codigos.length - 1]}`);
    
    const maxCod = codigos[codigos.length - 1];
    const next = await uniplusGet('/public-api/v1/produtos', { 'codigo.gt': maxCod, limit: 100 });
    console.log(`  codigo.gt=${maxCod}: ${next.error ? `ERROR ${next.error}: ${next.text}` : `${next.length} results`}`);

    for (const page of [1, 2, 3]) {
      const r = await uniplusGet('/public-api/v1/produtos', { limit: 100, page });
      console.log(`  page=${page}: ${r.error ? `ERROR ${r.error}` : `${r.length} results`}`);
    }
  }

  // ═══ 3. Ordens de Serviço — test month-by-month ═══
  console.log('\n═══ ORDENS DE SERVIÇO ═══\n');
  
  // Try different years
  for (const year of [2019, 2020, 2023, 2024, 2025]) {
    const r = await uniplusGet('/public-api/v1/ordem-servico', { 
      'dataHoraEmissao.ge': `${year}-01-01`, 
      'dataHoraEmissao.le': `${year}-12-31`, 
      limit: 100 
    });
    console.log(`  ${year}: ${r.error ? `ERROR ${r.error}` : `${r.length} results`}`);
  }

  // ═══ 4. Condições — check if more than 100 ═══
  console.log('\n═══ CONDIÇÕES ═══\n');
  for (const offset of [0, 100]) {
    const r = await uniplusGet('/public-api/v1/commons/condicaopagamento', { limit: 100, offset });
    console.log(`  offset=${offset}: ${r.error ? `ERROR ${r.error}: ${r.text}` : `${r.length} results`}`);
  }

  // ═══ 5. Check vendas por cliente - coverage analysis ═══
  console.log('\n═══ COBERTURA CLIENTES NAS VENDAS ═══\n');
  const [vendaClientes] = await sql`
    SELECT COUNT(DISTINCT cliente_nome) as nomes_unicos,
           COUNT(DISTINCT CASE WHEN cliente_id IS NOT NULL THEN cliente_nome END) as com_id,
           COUNT(*) as total_vendas
    FROM pedidos WHERE origem = 'uniplus'`;
  console.log(`  Nomes únicos de clientes nas vendas: ${vendaClientes.nomes_unicos}`);
  console.log(`  Com cliente_id vinculado: ${vendaClientes.com_id}`);
  console.log(`  Total clientes no banco: ${(await sql`SELECT COUNT(*) as c FROM clientes`)[0].c}`);

  // Show top unmatched clients
  const unmatched = await sql`
    SELECT cliente_nome, COUNT(*) as qtd, SUM(valor_total) as total
    FROM pedidos WHERE origem = 'uniplus' AND cliente_id IS NULL AND cliente_nome IS NOT NULL
    GROUP BY cliente_nome ORDER BY total DESC LIMIT 20`;
  console.log(`\n  Top 20 clientes SEM vínculo (por valor):`);
  unmatched.forEach((c, i) => console.log(`    ${i + 1}. ${c.cliente_nome} (${c.qtd} vendas, R$ ${Number(c.total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`));

  await sql.end();
}

main().catch(err => { console.error('ERRO:', err); process.exit(1); });
