import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL);
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

let token = null;
let config = null;

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
  if (!resp.ok) return { error: true, status: resp.status, body: (await resp.text()).substring(0, 200) };
  const data = await resp.json();
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && 'value' in data) return data.value;
  return data;
}

async function getAll(path, params = {}) {
  let offset = 0;
  const all = [];
  while (true) {
    const page = await uniplusGet(path, { ...params, limit: 100, offset });
    if (page.error) { console.log(`  ERRO offset=${offset}: ${page.body}`); break; }
    all.push(...page);
    console.log(`  offset=${offset}: ${page.length} registros (total: ${all.length})`);
    if (page.length < 100) break;
    offset += 100;
  }
  return all;
}

async function main() {
  await loadConfig();
  await authenticate();

  // ═══ 1. VENDAS: pegar TODAS com filtro de data por ano ═══
  console.log('═══ VENDAS POR ANO (com filtro emissao) ═══\n');

  const years = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
  let totalVendas = 0;
  for (const year of years) {
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;
    const vendas = await getAll('/public-api/v2/venda', { 'emissao.ge': start, 'emissao.le': end });
    if (vendas.length > 0) {
      const valores = vendas.map(v => parseFloat(v.valorTotal) || 0);
      const total = valores.reduce((a, b) => a + b, 0);
      console.log(`  ${year}: ${vendas.length} vendas, R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`);
      totalVendas += vendas.length;
    } else {
      console.log(`  ${year}: 0 vendas\n`);
    }
  }
  console.log(`TOTAL REAL DE VENDAS: ${totalVendas}\n`);

  // ═══ 2. ORDENS DE SERVIÇO ═══
  console.log('═══ ORDENS DE SERVIÇO ═══\n');
  const os = await getAll('/public-api/v1/ordem-servico');
  if (os.length > 0) {
    console.log(`\nTotal OS: ${os.length}`);
    console.log('Campos:', Object.keys(os[0]).join(', '));
    
    // Date range
    const dates = os.map(o => o.dataEmissao || o.data || o.dataAbertura || '').filter(Boolean).sort();
    if (dates.length) console.log(`Período: ${dates[0]} a ${dates[dates.length - 1]}`);
    
    // Sample
    console.log('\nAmostra:');
    os.slice(0, 5).forEach(o => {
      console.log(`  [${o.id || o.codigo}] ${o.nomeCliente || '-'} | ${o.descricao || o.observacao || '-'} | status: ${o.status || '-'} | valor: ${o.valorTotal || '-'}`);
    });
  }

  // ═══ 3. VENDA-ITEM details for 2025+ ═══
  console.log('\n═══ VENDA-ITEM (2025+) ═══\n');
  const items2025 = await getAll('/public-api/v2/venda-item', { 'emissao.ge': '2025-01-01' });
  if (items2025.length > 0) {
    console.log(`\nTotal itens 2025+: ${items2025.length}`);
    console.log('Campos:', Object.keys(items2025[0]).join(', '));
    console.log('\nAmostra:');
    items2025.slice(0, 5).forEach(i => {
      console.log(`  venda ${i.idVenda} | ${i.descricaoProduto || i.nomeProduto || '-'} | qtd: ${i.quantidade || '-'} | valor: ${i.valorTotal || '-'}`);
    });
  }

  // ═══ 4. Amostra vendas 2025 ═══
  console.log('\n═══ AMOSTRA VENDAS 2025-2026 ═══\n');
  const vendas2025 = await uniplusGet('/public-api/v2/venda', { 'emissao.ge': '2025-01-01', limit: 20 });
  if (!vendas2025.error && vendas2025.length > 0) {
    vendas2025.forEach(v => {
      console.log(`  [${v.idVenda}] doc=${v.documento} | ${v.nomeCliente} | ${v.emissao} | R$ ${v.valorTotal} | status=${v.status}`);
    });
  }

  // ═══ 5. PRODUTOS: total real com paginação ═══
  console.log('\n═══ PRODUTOS TOTAL REAL ═══\n');
  const allProds = await getAll('/public-api/v1/produtos');
  console.log(`\nTotal real de produtos: ${allProds.length}`);

  // Match Excel materials to Uniplus products
  console.log('\n═══ MATCH: Materiais Excel vs Produtos Uniplus ═══\n');
  const excelMaterials = ['COUCHE', 'BOPP', 'TAG', 'TERMICO', 'POLIESTER'];
  for (const mat of excelMaterials) {
    const matches = allProds.filter(p => (p.nome || '').toUpperCase().includes(mat));
    console.log(`  "${mat}" → ${matches.length} produtos Uniplus`);
    matches.slice(0, 3).forEach(p => console.log(`    [${p.codigo}] ${p.nome} | R$ ${p.preco}`));
  }

  await sql.end();
}

main().catch(err => { console.error(err); process.exit(1); });
