import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL);

// Aliases: nome na venda → nome no banco (ou null = criar novo)
const aliases = {
  'ELISÂNGELA DUTRA': 'ELISANGELA CAMARGO DUTRA',       // acento + nome parcial
  'CABRAL REPRESENTACOES COMERCIAIS': 'C A CABRAL DE LIZ & CIA LTDA', // mesmo representante
  'LC SOLUÇÕES / LUCAS CATAFESTA': 'LUCAS CATAFESTA MEI', // mesmo vendedor
};

// Vendedores que NÃO existem no banco — precisam ser criados
const newVendedores = [
  'SHEILA',
  'IVAN LUIZ FRIZZO JUNIOR',
  'YONATAN GONZALEZ',
  'DEIVIS ROBSON COUSSEAU',
  'ADRIANO CARNELOS',
  'JOECIR PAVIANI',
];

console.log('=== ANTES ===');
const [before] = await sql`
  SELECT 
    COUNT(*) FILTER (WHERE vendedor_id IS NOT NULL) as com_vendedor,
    COUNT(*) as total
  FROM pedidos WHERE origem = 'uniplus'`;
console.log(`  Vendas com vendedor: ${before.com_vendedor}/${before.total} (${(before.com_vendedor/before.total*100).toFixed(1)}%)\n`);

// 1. Create missing vendedores
console.log('=== CRIANDO VENDEDORES FALTANTES ===');
const createdMap = new Map(); // nome → id
for (const nome of newVendedores) {
  const [existing] = await sql`SELECT id FROM usuarios WHERE UPPER(nome) = ${nome.toUpperCase()} AND tipo = 'vendedor'`;
  if (existing) {
    console.log(`  ${nome} → já existe (id: ${existing.id})`);
    createdMap.set(nome.toUpperCase(), existing.id);
  } else {
    const [created] = await sql`
      INSERT INTO usuarios (nome, email, senha_hash, tipo, ativo)
      VALUES (${nome}, ${nome.toLowerCase().replace(/\s+/g, '.') + '@trends.vendedor'}, 'UNIPLUS_NO_LOGIN', 'vendedor', true)
      RETURNING id`;
    console.log(`  ${nome} → CRIADO (id: ${created.id})`);
    createdMap.set(nome.toUpperCase(), created.id);
  }
}

// 2. Load all vendedores for mapping
const vendedores = await sql`SELECT id, nome FROM usuarios WHERE tipo = 'vendedor'`;
const vendedorMap = new Map();
for (const v of vendedores) vendedorMap.set(v.nome.toUpperCase(), v.id);

// Add aliases
for (const [alias, real] of Object.entries(aliases)) {
  const id = vendedorMap.get(real.toUpperCase());
  if (id) {
    vendedorMap.set(alias.toUpperCase(), id);
    console.log(`  Alias: "${alias}" → "${real}" (id: ${id})`);
  } else {
    console.log(`  AVISO: "${real}" não encontrado no banco!`);
  }
}

// 3. Batch update vendas by cliente_nome (which stores nomeVendedor... wait, no)
// Actually vendas store nomeVendedor in the API but we don't have a column for it
// We need to update via the pedidos that have NULL vendedor_id
// The only way is to match by what we know: the vendas API nomeVendedor

// Actually, we stored cliente_nome in pedidos (that's the CLIENT name, not vendedor)
// We don't have vendedor name stored. So we need to do a SQL approach:
// For pedidos without vendedor_id, if the cliente has a vendedor, inherit it.
// For the rest, we need the API data again.

// Let's first do the client-inheritance approach
console.log('\n=== LINKANDO VIA CLIENTE (herança) ===');
const inheritResult = await sql`
  UPDATE pedidos p SET vendedor_id = c.vendedor_id
  FROM clientes c
  WHERE p.origem = 'uniplus' AND p.vendedor_id IS NULL
  AND p.cliente_id IS NOT NULL AND p.cliente_id = c.id AND c.vendedor_id IS NOT NULL`;
console.log(`  Herdados do cliente: ${inheritResult.count}`);

// Check remaining
const [mid] = await sql`
  SELECT 
    COUNT(*) FILTER (WHERE vendedor_id IS NOT NULL) as com_vendedor,
    COUNT(*) FILTER (WHERE vendedor_id IS NULL) as sem_vendedor,
    COUNT(*) as total
  FROM pedidos WHERE origem = 'uniplus'`;
console.log(`  Agora: ${mid.com_vendedor}/${mid.total} (${(mid.com_vendedor/mid.total*100).toFixed(1)}%)`);
console.log(`  Restam sem vendedor: ${mid.sem_vendedor}\n`);

// For the remaining, we need to add a vendedor_nome column or re-fetch from API
// Faster approach: add a temp column, populate from API, then match
// But even faster: since we know the missing names, let's just use SQL to update
// pedidos that match specific client patterns

// Actually the simplest: fetch just the vendas that are missing vendedor and get their nomeVendedor
console.log('=== BUSCANDO VENDAS SEM VENDEDOR DA API ===');

// Setup API access
let token = null, config = null;
const [c] = await sql`SELECT server_url, auth_code, user_id, user_password FROM uniplus_config WHERE ativo = true LIMIT 1`;
config = c;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

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

function fmt(d) { return d.toISOString().split('T')[0]; }
async function fetchDateRange(path, dateField, start, end, label) {
  const results = await uniplusGet(path, { [`${dateField}.ge`]: fmt(start), [`${dateField}.le`]: fmt(end), limit: 100 });
  if (results.length < 100) return results;
  const diffDays = Math.round((end - start) / 86400000);
  if (diffDays <= 1) return results;
  const mid2 = new Date(start.getTime() + Math.floor(diffDays / 2) * 86400000);
  const next = new Date(mid2.getTime() + 86400000);
  const a = await fetchDateRange(path, dateField, start, mid2, `${label}a`);
  const b = await fetchDateRange(path, dateField, next, end, `${label}b`);
  const seen = new Set();
  return [...a, ...b].filter(r => { const k = String(r.idVenda); return seen.has(k) ? false : (seen.add(k), true); });
}

await authenticate();

// Get missing vendas uniplus_ids
const missingVendas = await sql`SELECT uniplus_id FROM pedidos WHERE origem = 'uniplus' AND vendedor_id IS NULL`;
const missingSet = new Set(missingVendas.map(r => r.uniplus_id));
console.log(`  Vendas sem vendedor: ${missingSet.size}`);

// Fetch all vendas from API (we need nomeVendedor)
const allVendas = [];
for (let y = 2019; y <= 2026; y++) {
  for (let m = 1; m <= 12; m++) {
    const now = new Date();
    if (y > now.getFullYear() || (y === now.getFullYear() && m > now.getMonth() + 1)) break;
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0);
    const results = await fetchDateRange('/public-api/v2/venda', 'emissao', start, end, `${y}-${String(m).padStart(2, '0')}`);
    allVendas.push(...results);
    process.stdout.write(`  ${y}-${String(m).padStart(2, '0')}: ${results.length} (total: ${allVendas.length})\r`);
  }
}
const vendaMap2 = new Map();
for (const v of allVendas) vendaMap2.set(String(v.idVenda), v);
console.log(`\n  Vendas da API: ${vendaMap2.size}`);

// Now match missing vendas by nomeVendedor
function findVendedor(nomeVendedor) {
  if (!nomeVendedor) return null;
  const upper = nomeVendedor.toUpperCase().trim();
  if (vendedorMap.has(upper)) return vendedorMap.get(upper);
  // Normalize: remove accents
  const normalized = upper.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const [dbName, id] of vendedorMap.entries()) {
    const dbNorm = dbName.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (dbNorm === normalized) return id;
    if (dbNorm.includes(normalized) || normalized.includes(dbNorm)) return id;
  }
  return null;
}

let fixed = 0, stillMissing = {};
for (const uniId of missingSet) {
  const venda = vendaMap2.get(uniId);
  if (!venda) continue;
  
  const vendedorId = findVendedor(venda.nomeVendedor);
  if (vendedorId) {
    await sql`UPDATE pedidos SET vendedor_id = ${vendedorId}, updated_at = NOW() WHERE uniplus_id = ${uniId} AND origem = 'uniplus'`;
    fixed++;
  } else if (venda.nomeVendedor) {
    stillMissing[venda.nomeVendedor] = (stillMissing[venda.nomeVendedor] || 0) + 1;
  }
  if (fixed % 500 === 0 && fixed > 0) process.stdout.write(`  Fixed: ${fixed}\r`);
}
console.log(`\n  Vendas corrigidas: ${fixed}`);

if (Object.keys(stillMissing).length > 0) {
  console.log('  Ainda sem match:');
  Object.entries(stillMissing).sort((a,b) => b[1]-a[1]).forEach(([n, c]) => console.log(`    "${n}" → ${c} vendas`));
}

// Final stats
console.log('\n=== RESULTADO FINAL ===');
const [after] = await sql`
  SELECT 
    COUNT(*) FILTER (WHERE cliente_id IS NOT NULL) as com_cliente,
    COUNT(*) FILTER (WHERE vendedor_id IS NOT NULL) as com_vendedor,
    COUNT(*) as total
  FROM pedidos WHERE origem = 'uniplus'`;
console.log(`  Vendas com cliente: ${after.com_cliente}/${after.total} (${(after.com_cliente/after.total*100).toFixed(1)}%)`);
console.log(`  Vendas com vendedor: ${after.com_vendedor}/${after.total} (${(after.com_vendedor/after.total*100).toFixed(1)}%)`);

const [all] = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE cliente_id IS NOT NULL) as com FROM pedidos`;
console.log(`  TOTAL pedidos com cliente: ${all.com}/${all.total} (${(all.com/all.total*100).toFixed(1)}%)`);

await sql.end();
console.log('\n=== DONE ===');
