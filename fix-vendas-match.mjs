/**
 * fix-vendas-match.mjs
 * 
 * Re-fetches ALL vendas from Uniplus (2019-2026) and updates ALL existing pedidos
 * with uniplus_cliente_codigo + cliente_id + vendedor_id.
 * Then runs RE-MATCH.
 * 
 * This fixes the issue where old vendas never had uniplus_cliente_codigo populated.
 */
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
  if (!resp.ok) throw new Error(`GET ${path} → ${resp.status}: ${(await resp.text()).substring(0, 150)}`);
  const data = await resp.json();
  return Array.isArray(data) ? data : (data?.value || []);
}

function fmt(d) { return d.toISOString().split('T')[0]; }

async function fetchDateRange(path, dateField, start, end, label) {
  const results = await uniplusGet(path, { [`${dateField}.ge`]: fmt(start), [`${dateField}.le`]: fmt(end), limit: 100 });
  if (results.length < 100) {
    if (results.length > 0) console.log(`    ${label}: ${results.length}`);
    return results;
  }
  const diffDays = Math.round((end - start) / 86400000);
  if (diffDays <= 1) {
    console.log(`    ${label}: 100 (LIMITE! ${diffDays}d)`);
    return results;
  }
  const mid = new Date(start.getTime() + Math.floor(diffDays / 2) * 86400000);
  const next = new Date(mid.getTime() + 86400000);
  console.log(`    ${label}: 100 → split`);
  const a = await fetchDateRange(path, dateField, start, mid, `${label}a`);
  const b = await fetchDateRange(path, dateField, next, end, `${label}b`);
  const seen = new Set();
  return [...a, ...b].filter(r => { const k = String(r.idVenda || r.id || JSON.stringify(r)); return seen.has(k) ? false : (seen.add(k), true); });
}

async function main() {
  await loadConfig();
  await authenticate();
  console.log('Conectado ao Uniplus\n');

  // Load lookups
  const clienteRows = await sql`SELECT id, uniplus_id FROM clientes WHERE uniplus_id IS NOT NULL`;
  const clienteMap = new Map(clienteRows.map(c => [c.uniplus_id, c.id]));
  console.log(`Clientes carregados: ${clienteMap.size}`);

  const userRows = await sql`SELECT id, nome, uniplus_id FROM usuarios`;
  const userMap = new Map(userRows.map(u => [u.nome.toLowerCase(), u.id]));
  for (const u of userRows) {
    if (u.uniplus_id) userMap.set(`UP_${u.uniplus_id}`, u.id);
  }
  console.log(`Usuarios carregados: ${userMap.size}\n`);

  // ═══ FETCH ALL VENDAS from 2019 ═══
  console.log('═══ BUSCANDO TODAS AS VENDAS (2019-2026) ═══\n');
  
  const allVendas = [];
  for (let y = 2019; y <= 2026; y++) {
    for (let m = 1; m <= 12; m++) {
      const now = new Date();
      if (y > now.getFullYear() || (y === now.getFullYear() && m > now.getMonth() + 1)) break;
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0);
      const results = await fetchDateRange('/public-api/v2/venda', 'emissao', start, end, `${y}-${String(m).padStart(2, '0')}`);
      allVendas.push(...results);
    }
  }
  
  // Deduplicate
  const vendaMap = new Map();
  for (const v of allVendas) vendaMap.set(String(v.idVenda), v);
  const uniqueVendas = Array.from(vendaMap.values());
  console.log(`\nVendas únicas: ${uniqueVendas.length}\n`);

  // Check existing
  const existingVendas = await sql`SELECT uniplus_id FROM pedidos WHERE origem = 'uniplus'`;
  const existingSet = new Set(existingVendas.map(r => r.uniplus_id));

  // Stats before
  const [before] = await sql`
    SELECT 
      COUNT(*) FILTER (WHERE cliente_id IS NOT NULL) as com_cliente,
      COUNT(*) FILTER (WHERE vendedor_id IS NOT NULL) as com_vendedor,
      COUNT(*) FILTER (WHERE uniplus_cliente_codigo IS NOT NULL) as com_codigo,
      COUNT(*) as total
    FROM pedidos WHERE origem = 'uniplus'`;
  console.log('=== ANTES ===');
  console.log(`  Total: ${before.total}`);
  console.log(`  Com cliente_id: ${before.com_cliente} (${(before.com_cliente/before.total*100).toFixed(1)}%)`);
  console.log(`  Com vendedor_id: ${before.com_vendedor} (${(before.com_vendedor/before.total*100).toFixed(1)}%)`);
  console.log(`  Com uniplus_cliente_codigo: ${before.com_codigo} (${(before.com_codigo/before.total*100).toFixed(1)}%)\n`);

  // ═══ UPDATE ALL EXISTING VENDAS ═══
  console.log('═══ ATUALIZANDO TODAS AS VENDAS ═══\n');

  // Build vendedor name map (exact + partial)
  const vendedorByName = new Map();
  for (const u of userRows) {
    vendedorByName.set(u.nome.toUpperCase(), u.id);
  }
  // Manual aliases for known mismatches
  const aliases = {
    'ROSE MENEGAZZO': 'ROSELI FATIMA MENEGAZZO',
  };
  for (const [alias, real] of Object.entries(aliases)) {
    const id = vendedorByName.get(real.toUpperCase());
    if (id) vendedorByName.set(alias.toUpperCase(), id);
  }
  // Partial match: if vendedor name from venda is contained in any usuario name
  function findVendedor(nomeVendedor) {
    if (!nomeVendedor) return null;
    const upper = nomeVendedor.toUpperCase().trim();
    // Exact match first
    if (vendedorByName.has(upper)) return vendedorByName.get(upper);
    // Partial: venda name contained in DB name or vice-versa
    for (const [dbName, id] of vendedorByName.entries()) {
      if (dbName.includes(upper) || upper.includes(dbName)) return id;
    }
    return null;
  }

  let updated = 0, linked = 0, vendedorLinked = 0, notFound = 0;
  const vendedorMissing = {};
  const statusMap = { 0: 'pendente', 1: 'pendente', 2: 'em_producao', 3: 'concluido', 4: 'cancelado', 6: 'cancelado' };

  for (const v of uniqueVendas) {
    const codigo = String(v.idVenda);
    if (!existingSet.has(codigo)) continue; // skip vendas not in DB

    const cliCodigo = v.codigoCliente ? String(v.codigoCliente) : null;
    const clienteId = cliCodigo ? (clienteMap.get(cliCodigo) || null) : null;
    // codigoVendedor is undefined in vendas API — use nomeVendedor
    const vendedorId = findVendedor(v.nomeVendedor);

    if (clienteId) linked++;
    if (vendedorId) vendedorLinked++;
    else if (v.nomeVendedor) vendedorMissing[v.nomeVendedor] = (vendedorMissing[v.nomeVendedor] || 0) + 1;
    if (cliCodigo && !clienteId) notFound++;

    await sql`
      UPDATE pedidos SET 
        cliente_id = COALESCE(${clienteId}, cliente_id),
        cliente_nome = COALESCE(${v.nomeCliente || null}, cliente_nome),
        uniplus_cliente_codigo = COALESCE(${cliCodigo}, uniplus_cliente_codigo),
        vendedor_id = COALESCE(${vendedorId}, vendedor_id),
        status = ${statusMap[v.status] || 'pendente'},
        valor_total = ${parseFloat(v.valorTotal) || 0},
        uniplus_updated_at = NOW(), updated_at = NOW()
      WHERE uniplus_id = ${codigo} AND origem = 'uniplus'`;

    updated++;
    if (updated % 1000 === 0) {
      process.stdout.write(`  Progresso: ${updated}/${uniqueVendas.length} (linked: ${linked}, vendedor: ${vendedorLinked})\n`);
    }
  }
  console.log(`\n  Atualizadas: ${updated}`);
  console.log(`  Com cliente_id direto: ${linked}`);
  console.log(`  Com vendedor_id direto: ${vendedorLinked}`);
  console.log(`  codigoCliente sem match: ${notFound}\n`);

  if (Object.keys(vendedorMissing).length > 0) {
    console.log('  Vendedores SEM match:');
    Object.entries(vendedorMissing).sort((a,b) => b[1]-a[1]).forEach(([nome, count]) => {
      console.log(`    "${nome}" → ${count} vendas`);
    });
    console.log();
  }

  // ═══ RE-MATCH ═══
  console.log('═══ RE-MATCH CLIENTES ═══\n');

  const matched0 = await sql`
    UPDATE pedidos p SET cliente_id = c.id
    FROM clientes c
    WHERE p.origem = 'uniplus' AND p.cliente_id IS NULL
    AND p.uniplus_cliente_codigo IS NOT NULL AND c.uniplus_id = p.uniplus_cliente_codigo`;
  console.log(`  Vinculados por codigo Uniplus: ${matched0.count}`);

  const matched1 = await sql`
    UPDATE pedidos p SET cliente_id = c.id
    FROM clientes c
    WHERE p.origem = 'uniplus' AND p.cliente_id IS NULL
    AND p.cliente_nome IS NOT NULL AND c.razao_social = p.cliente_nome`;
  console.log(`  Vinculados por nome exato: ${matched1.count}`);

  const matched2 = await sql`
    UPDATE pedidos p SET cliente_id = c.id
    FROM clientes c
    WHERE p.origem = 'uniplus' AND p.cliente_id IS NULL
    AND p.cliente_nome IS NOT NULL AND UPPER(c.razao_social) = UPPER(p.cliente_nome)`;
  console.log(`  Vinculados por nome (case-insensitive): ${matched2.count}`);

  // ═══ RE-MATCH VENDEDORES ═══
  console.log('\n═══ RE-MATCH VENDEDORES ═══\n');

  const matchedVnd = await sql`
    UPDATE pedidos p SET vendedor_id = c.vendedor_id
    FROM clientes c
    WHERE p.origem = 'uniplus' AND p.vendedor_id IS NULL
    AND p.cliente_id IS NOT NULL AND p.cliente_id = c.id AND c.vendedor_id IS NOT NULL`;
  console.log(`  Vendas vinculadas ao vendedor do cliente: ${matchedVnd.count}`);

  // ═══ RESULTADO FINAL ═══
  console.log('\n═══ RESULTADO FINAL ═══\n');

  const [after] = await sql`
    SELECT 
      COUNT(*) FILTER (WHERE cliente_id IS NOT NULL) as com_cliente,
      COUNT(*) FILTER (WHERE vendedor_id IS NOT NULL) as com_vendedor,
      COUNT(*) FILTER (WHERE uniplus_cliente_codigo IS NOT NULL) as com_codigo,
      COUNT(*) as total
    FROM pedidos WHERE origem = 'uniplus'`;
  
  console.log(`  Total vendas Uniplus: ${after.total}`);
  console.log(`  Com cliente_id: ${after.com_cliente} (${(after.com_cliente/after.total*100).toFixed(1)}%) [antes: ${before.com_cliente}]`);
  console.log(`  Com vendedor_id: ${after.com_vendedor} (${(after.com_vendedor/after.total*100).toFixed(1)}%) [antes: ${before.com_vendedor}]`);
  console.log(`  Com uniplus_cliente_codigo: ${after.com_codigo} (${(after.com_codigo/after.total*100).toFixed(1)}%) [antes: ${before.com_codigo}]`);

  const [totalAll] = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE cliente_id IS NOT NULL) as com FROM pedidos`;
  console.log(`\n  TODOS os pedidos: ${totalAll.com}/${totalAll.total} com cliente (${(totalAll.com/totalAll.total*100).toFixed(1)}%)`);

  await sql.end();
  console.log('\n=== FIX COMPLETO ===');
}

main().catch(err => { console.error(err); process.exit(1); });
