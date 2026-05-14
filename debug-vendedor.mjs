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
  const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}`, 'userid': config.user_id, 'password': config.user_password } });
  if (!resp.ok) throw new Error(`GET ${path} → ${resp.status}`);
  const data = await resp.json();
  return Array.isArray(data) ? data : (data?.value || []);
}

await loadConfig();
await authenticate();

// Sample 5 vendas from API
const vendas = await uniplusGet('/public-api/v2/venda', { 'emissao.ge': '2026-03-01', 'emissao.le': '2026-03-25', limit: 5 });

console.log('=== AMOSTRA DE VENDAS DA API ===');
vendas.forEach(v => {
  console.log(`  idVenda: ${v.idVenda} | codigoCliente: ${v.codigoCliente} | codigoVendedor: ${v.codigoVendedor} | nomeVendedor: ${v.nomeVendedor} | nomeCliente: ${v.nomeCliente}`);
});

// Vendedores no banco
console.log('\n=== VENDEDORES NO BANCO (usuarios) ===');
const vendedores = await sql`SELECT id, nome, uniplus_id, tipo FROM usuarios WHERE tipo = 'vendedor' OR uniplus_id IS NOT NULL ORDER BY uniplus_id`;
vendedores.forEach(v => console.log(`  id: ${v.id} | nome: ${v.nome} | uniplus_id: ${v.uniplus_id} | tipo: ${v.tipo}`));

// Check: do the codigoVendedor from vendas match any uniplus_id in usuarios?
const vendedorUniplus = new Set(vendedores.filter(v => v.uniplus_id).map(v => v.uniplus_id));
console.log('\n=== MATCHING ===');
const sampleCodigos = [...new Set(vendas.map(v => v.codigoVendedor))];
sampleCodigos.forEach(c => {
  console.log(`  codigoVendedor ${c} → match: ${vendedorUniplus.has(String(c))}`);
});

// Now check entidades tagged as vendedor from API
console.log('\n=== VENDEDORES DA API (entidades tipo vendedor) ===');
const ents = await uniplusGet('/public-api/v1/entidades', { 'codigo.ge': 1, 'codigo.le': 10, limit: 5 });
console.log('Sample entidade:', JSON.stringify(ents[0], null, 2));

// Check what codigoVendedor values vendas actually use
const moreVendas = await uniplusGet('/public-api/v2/venda', { 'emissao.ge': '2026-01-01', 'emissao.le': '2026-03-25', limit: 100 });
const vendedorCounts = {};
moreVendas.forEach(v => {
  const key = `${v.codigoVendedor}|${v.nomeVendedor}`;
  vendedorCounts[key] = (vendedorCounts[key] || 0) + 1;
});
console.log('\n=== VENDEDORES USADOS NAS VENDAS ===');
Object.entries(vendedorCounts).sort((a,b) => b[1]-a[1]).forEach(([k, count]) => {
  console.log(`  ${k} → ${count} vendas`);
});

await sql.end();
