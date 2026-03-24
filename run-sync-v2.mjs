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

// Recursive subdivision by codigo range
async function fetchCodigoRange(path, lo, hi, depth = 0) {
  const results = await uniplusGet(path, { 'codigo.ge': lo, 'codigo.le': hi, limit: 100 });
  
  if (results.length < 100) return results;
  
  // Hit 100 — subdivide
  if (hi - lo <= 0) return results; // can't go smaller
  
  const mid = Math.floor((lo + hi) / 2);
  if (mid === lo) {
    // Range is just 2 numbers, fetch each
    const a = await uniplusGet(path, { 'codigo.ge': lo, 'codigo.le': lo, limit: 100 });
    const b = await uniplusGet(path, { 'codigo.ge': hi, 'codigo.le': hi, limit: 100 });
    const seen = new Set();
    return [...a, ...b].filter(r => { const k = String(r.codigo); return seen.has(k) ? false : (seen.add(k), true); });
  }
  
  if (depth < 3) console.log(`    Subdividindo ${lo}-${hi} → ${lo}-${mid} + ${mid+1}-${hi}`);
  
  const left = await fetchCodigoRange(path, lo, mid, depth + 1);
  const right = await fetchCodigoRange(path, mid + 1, hi, depth + 1);
  
  const seen = new Set();
  return [...left, ...right].filter(r => { const k = String(r.codigo); return seen.has(k) ? false : (seen.add(k), true); });
}

async function fetchAll(path, label, maxCodigo = 10000) {
  console.log(`  Buscando ${label} (0 a ${maxCodigo})...`);
  // Scan in chunks of 500 codigo range, subdivide if needed
  const all = [];
  const chunkSize = 500;
  for (let lo = 0; lo <= maxCodigo; lo += chunkSize) {
    const hi = Math.min(lo + chunkSize - 1, maxCodigo);
    const chunk = await fetchCodigoRange(path, lo, hi);
    if (chunk.length > 0) {
      all.push(...chunk);
      process.stdout.write(`    ${lo}-${hi}: ${chunk.length} | Total: ${all.length}\r`);
    }
  }
  console.log(`\n  ${label} total: ${all.length}`);
  return all;
}

// Date-based fetcher for vendas
function fmt(d) { return d.toISOString().split('T')[0]; }

async function fetchDateRange(path, dateField, start, end, label) {
  const results = await uniplusGet(path, { [`${dateField}.ge`]: fmt(start), [`${dateField}.le`]: fmt(end), limit: 100 });
  if (results.length < 100) {
    if (results.length > 0) console.log(`    ${label}: ${results.length}`);
    return results;
  }
  const diffDays = Math.round((end - start) / (86400000));
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

async function fetchVendasByMonth(startYear, endYear) {
  const all = [];
  for (let y = startYear; y <= endYear; y++) {
    for (let m = 1; m <= 12; m++) {
      const now = new Date();
      if (y > now.getFullYear() || (y === now.getFullYear() && m > now.getMonth() + 1)) break;
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0);
      const results = await fetchDateRange('/public-api/v2/venda', 'emissao', start, end, `${y}-${String(m).padStart(2, '0')}`);
      all.push(...results);
    }
  }
  return all;
}

async function main() {
  await loadConfig();
  await authenticate();
  console.log('Conectado ao Uniplus\n');

  // ═══ 1. ENTIDADES ═══
  console.log('═══ ENTIDADES ═══\n');
  const entidades = await fetchAll('/public-api/v1/entidades', 'Entidades', 10000);
  
  const clienteEnts = entidades.filter(e => String(e.tipo || '').includes('1'));
  const fornecedorEnts = entidades.filter(e => String(e.tipo || '').includes('2'));
  const vendedorEnts = entidades.filter(e => String(e.tipo || '').includes('4'));
  console.log(`  Clientes: ${clienteEnts.length}, Fornecedores: ${fornecedorEnts.length}, Vendedores: ${vendedorEnts.length}\n`);

  // Upsert clientes
  let cliCreated = 0, cliUpdated = 0, cliSkipped = 0;
  for (const e of clienteEnts) {
    const razaoSocial = e.razaoSocial?.trim() || e.nome?.trim() || '';
    if (!razaoSocial) { cliSkipped++; continue; }
    const cnpj = (e.cnpjCpf || '').replace(/\D/g, '') || null;

    const fields = {
      razao_social: razaoSocial, cnpj,
      email: e.email?.trim() || null,
      telefone: e.telefone?.trim() || null,
      celular: e.celular?.trim() || null,
      endereco: [e.endereco, e.numeroEndereco].filter(Boolean).join(', ').trim() || null,
      bairro: e.bairro?.trim() || null,
      cep: e.cep?.trim() || null,
      cidade: e.cidade?.trim() || null,
      estado: e.estado?.trim() || null,
      ativo: e.inativo === 0,
    };

    try {
      const [existing] = await sql`SELECT id FROM clientes WHERE uniplus_id = ${String(e.codigo)}`;
      if (existing) {
        await sql`UPDATE clientes SET ${sql(fields)}, uniplus_updated_at = NOW(), updated_at = NOW() WHERE id = ${existing.id}`;
        cliUpdated++;
      } else if (cnpj) {
        const [byCnpj] = await sql`SELECT id FROM clientes WHERE cnpj = ${cnpj} AND uniplus_id IS NULL`;
        if (byCnpj) {
          await sql`UPDATE clientes SET ${sql(fields)}, uniplus_id = ${String(e.codigo)}, uniplus_updated_at = NOW(), updated_at = NOW() WHERE id = ${byCnpj.id}`;
          cliUpdated++;
        } else {
          await sql`INSERT INTO clientes ${sql({ ...fields, uniplus_id: String(e.codigo), uniplus_updated_at: new Date() })}`;
          cliCreated++;
        }
      } else {
        await sql`INSERT INTO clientes ${sql({ ...fields, uniplus_id: String(e.codigo), uniplus_updated_at: new Date() })}`;
        cliCreated++;
      }
    } catch (err) {
      cliSkipped++;
      if (cliSkipped <= 5) console.log(`  ERRO cliente ${e.codigo}: ${err.message.substring(0, 80)}`);
    }
    
    if ((cliCreated + cliUpdated + cliSkipped) % 500 === 0) {
      process.stdout.write(`  Clientes progresso: ${cliCreated + cliUpdated + cliSkipped}/${clienteEnts.length}\r`);
    }
  }
  console.log(`\n  Clientes → Criados: ${cliCreated}, Atualizados: ${cliUpdated}, Skipped: ${cliSkipped}\n`);

  // ═══ 2. PRODUTOS ═══
  console.log('═══ PRODUTOS ═══\n');
  const produtos = await fetchAll('/public-api/v1/produtos', 'Produtos', 10000);

  let prodCreated = 0, prodUpdated = 0;
  for (const p of produtos) {
    const nome = p.nome?.trim() || '';
    if (!nome) continue;
    try {
      const [existing] = await sql`SELECT id FROM tipos_papel WHERE uniplus_id = ${String(p.codigo)}`;
      if (existing) {
        await sql`UPDATE tipos_papel SET nome = ${nome}, descricao = ${p.observacao?.trim() || null},
          fornecedor = ${p.nomeFornecedor?.trim() || null}, preco_m2 = ${parseFloat(p.preco) || 0},
          ativo = ${p.inativo === 0}, uniplus_updated_at = NOW(), updated_at = NOW() WHERE id = ${existing.id}`;
        prodUpdated++;
      } else {
        await sql`INSERT INTO tipos_papel (nome, descricao, fornecedor, preco_m2, ativo, uniplus_id, uniplus_updated_at)
          VALUES (${nome}, ${p.observacao?.trim() || null}, ${p.nomeFornecedor?.trim() || null},
          ${parseFloat(p.preco) || 0}, ${p.inativo === 0}, ${String(p.codigo)}, NOW())`;
        prodCreated++;
      }
    } catch (err) {
      if (prodCreated + prodUpdated < 5) console.log(`  ERRO produto ${p.codigo}: ${err.message.substring(0, 80)}`);
    }
  }
  console.log(`  Produtos → Criados: ${prodCreated}, Atualizados: ${prodUpdated}\n`);

  // ═══ 3. CONDIÇÕES ═══
  console.log('═══ CONDIÇÕES DE PAGAMENTO ═══\n');
  const condicoes = await uniplusGet('/public-api/v1/commons/condicaopagamento', { limit: 100 });
  let condCreated = 0, condUpdated = 0;
  for (const c of condicoes) {
    const codigo = String(c.id || c.codigo || '');
    const nome = String(c.nome || c.descricao || '').trim();
    if (!codigo || !nome) continue;
    const [existing] = await sql`SELECT id FROM condicoes_pagamento WHERE uniplus_id = ${codigo}`;
    if (existing) {
      await sql`UPDATE condicoes_pagamento SET nome = ${nome}, uniplus_updated_at = NOW(), updated_at = NOW() WHERE id = ${existing.id}`;
      condUpdated++;
    } else {
      await sql`INSERT INTO condicoes_pagamento (nome, ativo, uniplus_id, uniplus_updated_at) VALUES (${nome}, true, ${codigo}, NOW())`;
      condCreated++;
    }
  }
  console.log(`  Condições: ${condicoes.length} (Criados: ${condCreated}, Atualizados: ${condUpdated})\n`);

  // ═══ 4. VENDAS — incremental ═══
  console.log('═══ VENDAS (incremental) ═══\n');

  // Load existing uniplus vendas
  const existingVendas = await sql`SELECT uniplus_id FROM pedidos WHERE origem = 'uniplus'`;
  const existingUniplusIds = new Set(existingVendas.map(r => r.uniplus_id));
  console.log(`  Vendas existentes no banco: ${existingUniplusIds.size}`);

  // Find last date for incremental
  const [lastSync] = await sql`SELECT MAX(data_entrega)::text as d FROM pedidos WHERE origem = 'uniplus'`;
  let startYear = 2019;
  if (lastSync?.d) {
    const d = new Date(lastSync.d);
    d.setMonth(d.getMonth() - 2); // Re-fetch last 2 months for updates
    startYear = d.getFullYear();
    console.log(`  Buscando desde: ${startYear} (último: ${lastSync.d})`);
  }

  const vendas = await fetchVendasByMonth(startYear, 2026);
  const vendaMap = new Map();
  for (const v of vendas) vendaMap.set(String(v.idVenda), v);
  const uniqueVendas = Array.from(vendaMap.values());
  console.log(`\n  Vendas coletadas: ${uniqueVendas.length}`);

  // Pre-load lookups
  const clienteRows = await sql`SELECT id, uniplus_id FROM clientes WHERE uniplus_id IS NOT NULL`;
  const clienteMap = new Map(clienteRows.map(c => [c.uniplus_id, c.id]));
  const userRows = await sql`SELECT id, nome FROM usuarios`;
  const userMap = new Map(userRows.map(u => [u.nome.toLowerCase(), u.id]));
  const existingNumeros = await sql`SELECT numero FROM pedidos`;
  const usedNumeros = new Set(existingNumeros.map(r => r.numero));

  const statusMap = { 0: 'pendente', 1: 'pendente', 2: 'em_producao', 3: 'concluido', 4: 'cancelado', 6: 'cancelado' };

  // Split: new inserts vs updates
  const toInsert = uniqueVendas.filter(v => !existingUniplusIds.has(String(v.idVenda)));
  const toUpdate = uniqueVendas.filter(v => existingUniplusIds.has(String(v.idVenda)));
  console.log(`  Novas: ${toInsert.length}, Para atualizar: ${toUpdate.length}`);

  // Batch insert new
  const rows = [];
  for (const v of toInsert) {
    const codigo = String(v.idVenda);
    const documento = v.documento || '';
    let numero = `UP-${documento || codigo}`;
    if (usedNumeros.has(numero)) numero = `UP-${documento}-${codigo}`;
    if (usedNumeros.has(numero)) numero = `UP-${codigo}`;
    usedNumeros.add(numero);

    rows.push({
      numero, cliente_id: v.codigoCliente ? (clienteMap.get(String(v.codigoCliente)) || null) : null,
      cliente_nome: v.nomeCliente || null,
      vendedor_id: v.nomeVendedor ? (userMap.get(v.nomeVendedor.toLowerCase()) || null) : null,
      status: statusMap[v.status] || 'pendente',
      valor_total: parseFloat(v.valorTotal) || 0,
      data_entrega: v.emissao || null,
      origem: 'uniplus', uniplus_id: codigo, uniplus_updated_at: new Date()
    });
  }

  const BATCH = 200;
  const COLS = ['numero', 'cliente_id', 'cliente_nome', 'vendedor_id', 'status', 'valor_total', 'data_entrega', 'origem', 'uniplus_id', 'uniplus_updated_at'];
  let vndCreated = 0, vndErrors = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    try {
      await sql`INSERT INTO pedidos ${sql(batch, ...COLS)}`;
      vndCreated += batch.length;
    } catch {
      for (const r of batch) {
        try {
          await sql`INSERT INTO pedidos ${sql([r], ...COLS)}`;
          vndCreated++;
        } catch (err) { vndErrors++; }
      }
    }
    if ((i + BATCH) % 2000 === 0 || i + BATCH >= rows.length)
      console.log(`  Insert: ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
  }
  console.log(`  Inseridas: ${vndCreated}, Erros: ${vndErrors}`);

  // Update existing (status, valor, re-link cliente)
  let vndUpdated = 0;
  for (const v of toUpdate) {
    const codigo = String(v.idVenda);
    const clienteId = v.codigoCliente ? (clienteMap.get(String(v.codigoCliente)) || null) : null;
    await sql`UPDATE pedidos SET status = ${statusMap[v.status] || 'pendente'}, valor_total = ${parseFloat(v.valorTotal) || 0},
      cliente_id = COALESCE(${clienteId}, cliente_id), cliente_nome = COALESCE(${v.nomeCliente || null}, cliente_nome),
      uniplus_updated_at = NOW(), updated_at = NOW() WHERE uniplus_id = ${codigo} AND origem = 'uniplus'`;
    vndUpdated++;
    if (vndUpdated % 2000 === 0) console.log(`  Update: ${vndUpdated}/${toUpdate.length}`);
  }
  console.log(`  Atualizadas: ${vndUpdated}\n`);

  // ═══ 5. RE-MATCH vendas to clientes by name (batch SQL) ═══
  console.log('═══ RE-MATCH CLIENTES ═══\n');
  const matched = await sql`
    UPDATE pedidos p SET cliente_id = c.id
    FROM clientes c
    WHERE p.origem = 'uniplus' AND p.cliente_id IS NULL
    AND p.cliente_nome IS NOT NULL AND c.razao_social = p.cliente_nome`;
  console.log(`  Vinculados por nome exato: ${matched.count}`);

  // Also try ILIKE for case differences
  const matched2 = await sql`
    UPDATE pedidos p SET cliente_id = c.id
    FROM clientes c
    WHERE p.origem = 'uniplus' AND p.cliente_id IS NULL
    AND p.cliente_nome IS NOT NULL AND UPPER(c.razao_social) = UPPER(p.cliente_nome)`;
  console.log(`  Vinculados por nome (case-insensitive): ${matched2.count}`);

  // Update sync time
  await sql`UPDATE uniplus_config SET last_sync_at = NOW(), updated_at = NOW() WHERE ativo = true`;

  // ═══ RELATÓRIO ═══
  console.log('\n═══════════════════════════════════════════');
  console.log('           RELATÓRIO FINAL');
  console.log('═══════════════════════════════════════════\n');

  const [r] = await sql`
    SELECT
      (SELECT COUNT(*) FROM clientes) as total_clientes,
      (SELECT COUNT(*) FROM clientes WHERE uniplus_id IS NOT NULL) as clientes_uniplus,
      (SELECT COUNT(*) FROM tipos_papel) as total_produtos,
      (SELECT COUNT(*) FROM tipos_papel WHERE uniplus_id IS NOT NULL) as produtos_uniplus,
      (SELECT COUNT(*) FROM condicoes_pagamento) as total_condicoes,
      (SELECT COUNT(*) FROM pedidos) as total_pedidos,
      (SELECT COUNT(*) FROM pedidos WHERE origem = 'uniplus') as vendas_uniplus,
      (SELECT COUNT(*) FROM pedidos WHERE origem = 'importacao') as pedidos_importacao,
      (SELECT COUNT(*) FROM pedidos WHERE origem = 'uniplus' AND cliente_id IS NOT NULL) as vendas_com_cliente,
      (SELECT COALESCE(SUM(valor_total), 0) FROM pedidos WHERE origem = 'uniplus') as valor_total,
      (SELECT MIN(data_entrega)::text FROM pedidos WHERE origem = 'uniplus') as data_min,
      (SELECT MAX(data_entrega)::text FROM pedidos WHERE origem = 'uniplus') as data_max
  `;
  console.log(`CLIENTES: ${r.total_clientes} total (${r.clientes_uniplus} Uniplus)`);
  console.log(`PRODUTOS: ${r.total_produtos} total (${r.produtos_uniplus} Uniplus)`);
  console.log(`CONDIÇÕES: ${r.total_condicoes} total`);
  console.log(`\nPEDIDOS TOTAL: ${r.total_pedidos}`);
  console.log(`  Excel: ${r.pedidos_importacao}`);
  console.log(`  Uniplus: ${r.vendas_uniplus}`);
  const uv = Number(r.vendas_uniplus);
  if (uv > 0) {
    console.log(`\nQUALIDADE VENDAS:`);
    console.log(`  Com cliente vinculado: ${r.vendas_com_cliente}/${uv} (${Math.round(Number(r.vendas_com_cliente)/uv*100)}%)`);
    console.log(`  Valor total: R$ ${Number(r.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`  Período: ${r.data_min} a ${r.data_max}`);
  }

  const byYear = await sql`
    SELECT EXTRACT(YEAR FROM data_entrega)::int as ano, COUNT(*) as qtd, COALESCE(SUM(valor_total), 0) as total
    FROM pedidos WHERE origem = 'uniplus' AND data_entrega IS NOT NULL GROUP BY ano ORDER BY ano`;
  console.log('\nVENDAS POR ANO:');
  byYear.forEach(y => console.log(`  ${y.ano}: ${y.qtd} vendas, R$ ${Number(y.total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`));

  await sql.end();
  console.log('\n=== Sincronização completa! ===');
}

main().catch(err => { console.error('ERRO FATAL:', err); process.exit(1); });
