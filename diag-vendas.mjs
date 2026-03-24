import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL);
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

let token = null;
let config = null;

async function loadConfig() {
  const [c] = await sql`
    SELECT server_url, auth_code, user_id, user_password
    FROM uniplus_config WHERE ativo = true LIMIT 1
  `;
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
  if (!resp.ok) throw new Error(`Auth failed ${resp.status}`);
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
  if (!resp.ok) {
    const text = await resp.text();
    return { error: true, status: resp.status, body: text.substring(0, 200) };
  }
  const data = await resp.json();
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && 'value' in data) return data.value;
  return data;
}

async function uniplusGetAll(path, params = {}) {
  const PAGE_SIZE = 100;
  let offset = 0;
  const all = [];
  while (true) {
    const page = await uniplusGet(path, { ...params, limit: PAGE_SIZE, offset });
    if (page.error) return { error: true, ...page };
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return all;
}

async function main() {
  await loadConfig();
  await authenticate();
  console.log('Conectado\n');

  // ═══ 1. VENDAS: por que param em 2024? ═══
  console.log('═══ ANÁLISE DE VENDAS ═══\n');
  
  // Check v2/venda date range
  const vendas = await uniplusGetAll('/public-api/v2/venda');
  if (!vendas.error) {
    const dates = vendas.map(v => v.emissao).filter(Boolean).sort();
    console.log(`/public-api/v2/venda: ${vendas.length} registros`);
    console.log(`  Data min: ${dates[0]}`);
    console.log(`  Data max: ${dates[dates.length - 1]}`);
    
    // Distribution by year
    const byYear = {};
    vendas.forEach(v => {
      const year = v.emissao?.substring(0, 4) || 'sem_data';
      byYear[year] = (byYear[year] || 0) + 1;
    });
    console.log('  Por ano:', byYear);
    
    // Show status distribution
    const byStatus = {};
    vendas.forEach(v => {
      byStatus[v.status] = (byStatus[v.status] || 0) + 1;
    });
    console.log('  Por status:', byStatus);
  } else {
    console.log('  ERRO v2/venda:', vendas.body);
  }

  // Try v1/venda
  console.log('\n--- Tentando v1/venda ---');
  const v1vendas = await uniplusGet('/public-api/v1/venda', { limit: 10 });
  if (!v1vendas.error) {
    console.log(`  /public-api/v1/venda: ${Array.isArray(v1vendas) ? v1vendas.length : 'não é array'}`);
    if (Array.isArray(v1vendas) && v1vendas.length > 0) {
      console.log('  Campos:', Object.keys(v1vendas[0]).join(', '));
    }
  } else {
    console.log(`  ERRO: ${v1vendas.status} - ${v1vendas.body}`);
  }

  // Try NFe endpoints
  console.log('\n--- Tentando endpoints de NFe ---');
  const nfeEndpoints = [
    '/public-api/v1/nfe',
    '/public-api/v2/nfe',
    '/public-api/v1/nota-fiscal',
    '/public-api/v1/nfce',
    '/public-api/v2/nfce',
    '/public-api/v1/pedido',
    '/public-api/v2/pedido',
    '/public-api/v1/orcamento',
    '/public-api/v2/orcamento',
    '/public-api/v1/ordem-servico',
    '/public-api/v1/venda-item',
    '/public-api/v2/venda-item',
    '/public-api/v1/faturamento',
    '/public-api/v1/financeiro',
    '/public-api/v1/contas-receber',
  ];

  for (const ep of nfeEndpoints) {
    const result = await uniplusGet(ep, { limit: 5 });
    if (!result.error) {
      const arr = Array.isArray(result) ? result : [];
      if (arr.length > 0) {
        const dates = arr.map(r => r.emissao || r.dataEmissao || r.data || r.dataHoraEmissao || '').filter(Boolean);
        console.log(`  ${ep}: ${arr.length} registros, campos: ${Object.keys(arr[0]).slice(0, 8).join(', ')}, datas: ${dates.slice(0, 2).join(', ')}`);
      } else {
        console.log(`  ${ep}: 0 registros (ou objeto não-array)`);
      }
    } else {
      console.log(`  ${ep}: ${result.status} ${result.body.substring(0, 80)}`);
    }
  }

  // Try emissao filter for recent vendas
  console.log('\n--- Vendas com filtro de data ---');
  const recentFilters = [
    { 'emissao.ge': '2025-01-01' },
    { 'emissao.ge': '2024-01-01' },
    { 'dataHoraEmissao.ge': '2025-01-01' },
  ];
  for (const params of recentFilters) {
    const result = await uniplusGet('/public-api/v2/venda', { ...params, limit: 10 });
    const key = Object.keys(params)[0];
    if (!result.error) {
      console.log(`  venda (${key}=${params[key]}): ${Array.isArray(result) ? result.length : 'não-array'} resultados`);
    } else {
      console.log(`  venda (${key}=${params[key]}): ${result.status} - ${result.body.substring(0, 100)}`);
    }
  }

  // ═══ 2. PRODUTOS: o que tem? ═══
  console.log('\n═══ ANÁLISE DE PRODUTOS ═══\n');
  
  const produtos = await uniplusGetAll('/public-api/v1/produtos');
  if (!produtos.error) {
    console.log(`Total produtos: ${produtos.length}`);
    if (produtos.length > 0) {
      console.log('Campos:', Object.keys(produtos[0]).join(', '));
      console.log('\nAmostra de 5 produtos:');
      produtos.slice(0, 5).forEach(p => {
        console.log(`  [${p.codigo}] ${p.nome} | ref: ${p.referencia || '-'} | unid: ${p.unidade || '-'} | preço: ${p.preco || '-'} | grupo: ${p.nomeGrupo || '-'} | subgrupo: ${p.nomeSubgrupo || '-'}`);
      });
      
      // Groups
      const grupos = {};
      produtos.forEach(p => {
        const g = p.nomeGrupo || 'sem_grupo';
        grupos[g] = (grupos[g] || 0) + 1;
      });
      console.log('\nProdutos por grupo:');
      Object.entries(grupos).sort((a, b) => b[1] - a[1]).forEach(([g, c]) => console.log(`  ${g}: ${c}`));
    }
  }

  // ═══ 3. DADOS DO EXCEL: materiais ═══
  console.log('\n═══ MATERIAIS DO EXCEL (pedidos importados) ═══\n');
  
  const materiaisExcel = await sql`
    SELECT material, COUNT(*) as c 
    FROM pedidos 
    WHERE origem = 'importacao' AND material IS NOT NULL AND material != ''
    GROUP BY material 
    ORDER BY c DESC 
    LIMIT 20
  `;
  console.log(`Top 20 materiais do Excel (de ${materiaisExcel.length} únicos):`);
  materiaisExcel.forEach(m => console.log(`  ${m.material}: ${m.c} pedidos`));

  const totalComMaterial = await sql`
    SELECT COUNT(*) as c FROM pedidos WHERE origem = 'importacao' AND material IS NOT NULL AND material != ''
  `;
  const totalSemMaterial = await sql`
    SELECT COUNT(*) as c FROM pedidos WHERE origem = 'importacao' AND (material IS NULL OR material = '')
  `;
  console.log(`\nCom material: ${totalComMaterial[0].c}`);
  console.log(`Sem material: ${totalSemMaterial[0].c}`);

  // Check what's in the materiais page
  console.log('\n═══ TABELAS DE MATERIAIS NO DB ═══\n');
  
  // Check tipos_papel
  const tiposPapel = await sql`SELECT COUNT(*) as c FROM tipos_papel`;
  const tiposPapelUniplus = await sql`SELECT COUNT(*) as c FROM tipos_papel WHERE uniplus_id IS NOT NULL`;
  console.log(`tipos_papel: ${tiposPapel[0].c} total (${tiposPapelUniplus[0].c} do Uniplus)`);
  const sampleTipos = await sql`SELECT id, nome, uniplus_id, fornecedor FROM tipos_papel LIMIT 5`;
  sampleTipos.forEach(t => console.log(`  [${t.id}] ${t.nome} | uniplus: ${t.uniplus_id || '-'} | fornecedor: ${t.fornecedor || '-'}`));

  // Check other material-related tables
  const tables = ['acabamentos', 'cores_pantone', 'facas', 'tubetes'];
  for (const t of tables) {
    try {
      const [count] = await sql.unsafe(`SELECT COUNT(*) as c FROM ${t}`);
      console.log(`${t}: ${count.c} registros`);
    } catch {
      console.log(`${t}: tabela não existe`);
    }
  }

  await sql.end();
}

main().catch(err => { console.error(err); process.exit(1); });
