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

// Recursive fetch: subdivide code ranges when hitting 100 limit
async function fetchCodigoRange(path, gtVal, leVal, label) {
  const params = { 'codigo.gt': gtVal, limit: 100 };
  if (leVal !== null) params['codigo.le'] = leVal;
  const batch = await uniplusGet(path, params);
  
  if (batch.length < 100) {
    if (batch.length > 0) console.log(`    ${label} (${gtVal}-${leVal || '∞'}): ${batch.length}`);
    return batch;
  }

  // Hit 100 limit — need to subdivide
  // If no upper bound, find max codigo and set it
  if (leVal === null) {
    const maxCod = Math.max(...batch.map(r => Number(r.codigo)));
    // Try a bigger range to find the real max
    leVal = maxCod + 10000;
  }

  const range = leVal - gtVal;
  if (range <= 1) {
    // Can't subdivide further
    console.log(`    ${label} (${gtVal}-${leVal}): 100 ⚠️ LIMITE MÍNIMO`);
    return batch;
  }

  const mid = Math.floor(gtVal + range / 2);
  console.log(`    ${label} (${gtVal}-${leVal}): 100 → subdividindo em ${mid}`);
  
  const first = await fetchCodigoRange(path, gtVal, mid, `${label}a`);
  const second = await fetchCodigoRange(path, mid, leVal, `${label}b`);
  
  // Dedup by codigo
  const seen = new Set();
  return [...first, ...second].filter(r => {
    const key = String(r.codigo);
    return seen.has(key) ? false : (seen.add(key), true);
  });
}

async function fetchAllByCodigo(path, label) {
  console.log(`  Buscando ${label} com subdivisão recursiva...`);
  // Start with range 0 to 10000 (typical Uniplus range)
  const all = await fetchCodigoRange(path, 0, 10000, label);
  
  // Check if there are records beyond 10000
  const beyond = await uniplusGet(path, { 'codigo.gt': 10000, limit: 100 });
  if (beyond.length > 0) {
    console.log(`  Encontrados ${beyond.length} registros com codigo > 10000, expandindo...`);
    const extra = await fetchCodigoRange(path, 10000, 100000, `${label}-ext`);
    const seen = new Set(all.map(r => String(r.codigo)));
    for (const r of extra) {
      if (!seen.has(String(r.codigo))) { all.push(r); seen.add(String(r.codigo)); }
    }
  }
  
  return all;
}

// Smart date-based fetcher with subdivision
function fmt(d) { return d.toISOString().split('T')[0]; }

async function fetchRange(path, dateField, start, end, label) {
  const results = await uniplusGet(path, { [`${dateField}.ge`]: fmt(start), [`${dateField}.le`]: fmt(end), limit: 100 });
  if (results.length < 100) {
    if (results.length > 0) console.log(`    ${label}: ${results.length}`);
    return results;
  }
  const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
  if (diffDays <= 1) {
    console.log(`    ${label}: 100 (LIMITE! ${diffDays} dia)`);
    return results;
  }
  const mid = new Date(start.getTime() + Math.floor(diffDays / 2) * 24 * 60 * 60 * 1000);
  const nextDay = new Date(mid.getTime() + 24 * 60 * 60 * 1000);
  console.log(`    ${label}: 100 → subdividindo`);
  const first = await fetchRange(path, dateField, start, mid, `${label}a`);
  const second = await fetchRange(path, dateField, nextDay, end, `${label}b`);
  const seen = new Set();
  return [...first, ...second].filter(r => {
    const key = String(r.idVenda || r.id || r.codigo || JSON.stringify(r));
    return seen.has(key) ? false : (seen.add(key), true);
  });
}

async function fetchAllByMonth(path, dateField, startYear, endYear) {
  const all = [];
  for (let year = startYear; year <= endYear; year++) {
    for (let month = 1; month <= 12; month++) {
      const now = new Date();
      if (year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth() + 1)) break;
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0);
      const results = await fetchRange(path, dateField, start, end, `${year}-${String(month).padStart(2, '0')}`);
      all.push(...results);
    }
  }
  return all;
}

async function main() {
  await loadConfig();
  await authenticate();
  console.log('Conectado ao Uniplus\n');

  // ═══ 1. ENTIDADES (ALL — via codigo.gt pagination) ═══
  console.log('═══ ENTIDADES (código.gt pagination) ═══\n');
  const entidades = await fetchAllByCodigo('/public-api/v1/entidades', 'Entidades');
  console.log(`\n  Total entidades: ${entidades.length}`);

  // Filter by type
  const clientes = entidades.filter(e => String(e.tipo || '').includes('1'));
  const fornecedores = entidades.filter(e => String(e.tipo || '').includes('2'));
  const vendedores = entidades.filter(e => String(e.tipo || '').includes('4'));
  console.log(`  Clientes (tipo inclui 1): ${clientes.length}`);
  console.log(`  Fornecedores (tipo inclui 2): ${fornecedores.length}`);
  console.log(`  Vendedores (tipo inclui 4): ${vendedores.length}`);

  // Upsert clientes
  let cliCreated = 0, cliUpdated = 0, cliSkipped = 0;
  for (const e of clientes) {
    const razaoSocial = e.razaoSocial?.trim() || e.nome?.trim() || '';
    const cnpj = (e.cnpjCpf || '').replace(/\D/g, '') || null;
    if (!razaoSocial) { cliSkipped++; continue; }

    const fields = {
      razao_social: razaoSocial,
      cnpj: cnpj || null,
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

    const [existing] = await sql`SELECT id FROM clientes WHERE uniplus_id = ${e.codigo}`;
    if (existing) {
      await sql`
        UPDATE clientes SET ${sql(fields)}, uniplus_updated_at = NOW(), updated_at = NOW()
        WHERE id = ${existing.id}`;
      cliUpdated++;
    } else if (cnpj) {
      const [byCnpj] = await sql`SELECT id FROM clientes WHERE cnpj = ${cnpj}`;
      if (byCnpj) {
        await sql`
          UPDATE clientes SET ${sql(fields)}, uniplus_id = ${e.codigo}, uniplus_updated_at = NOW(), updated_at = NOW()
          WHERE id = ${byCnpj.id}`;
        cliUpdated++;
      } else {
        await sql`
          INSERT INTO clientes ${sql({ ...fields, uniplus_id: e.codigo, uniplus_updated_at: new Date() })}`;
        cliCreated++;
      }
    } else {
      // No CNPJ — try match by name, otherwise insert with null cnpj
      const [byName] = await sql`SELECT id FROM clientes WHERE razao_social ILIKE ${razaoSocial} AND uniplus_id IS NULL LIMIT 1`;
      if (byName) {
        await sql`UPDATE clientes SET ${sql(fields)}, uniplus_id = ${e.codigo}, uniplus_updated_at = NOW(), updated_at = NOW() WHERE id = ${byName.id}`;
        cliUpdated++;
      } else {
        await sql`INSERT INTO clientes ${sql({ ...fields, uniplus_id: e.codigo, uniplus_updated_at: new Date() })}`;
        cliCreated++;
      }
    }
  }
  console.log(`  Clientes → Criados: ${cliCreated}, Atualizados: ${cliUpdated}, Skipped: ${cliSkipped}\n`);

  // ═══ 2. PRODUTOS (ALL — via codigo.gt pagination) ═══
  console.log('═══ PRODUTOS (código.gt pagination) ═══\n');
  const produtos = await fetchAllByCodigo('/public-api/v1/produtos', 'Produtos');
  console.log(`\n  Total produtos: ${produtos.length}`);

  let prodCreated = 0, prodUpdated = 0;
  for (const p of produtos) {
    const nome = p.nome?.trim() || '';
    if (!nome) continue;
    const preco = parseFloat(p.preco) || 0;
    const descricao = p.observacao?.trim() || null;
    const fornecedor = p.nomeFornecedor?.trim() || null;
    const [existing] = await sql`SELECT id FROM tipos_papel WHERE uniplus_id = ${p.codigo}`;
    if (existing) {
      await sql`UPDATE tipos_papel SET nome = ${nome}, descricao = ${descricao}, fornecedor = ${fornecedor},
        preco_m2 = ${preco}, ativo = ${p.inativo === 0}, uniplus_updated_at = NOW(), updated_at = NOW()
        WHERE id = ${existing.id}`;
      prodUpdated++;
    } else {
      await sql`INSERT INTO tipos_papel (nome, descricao, fornecedor, preco_m2, ativo, uniplus_id, uniplus_updated_at)
        VALUES (${nome}, ${descricao}, ${fornecedor}, ${preco}, ${p.inativo === 0}, ${p.codigo}, NOW())`;
      prodCreated++;
    }
  }
  console.log(`  Produtos → Criados: ${prodCreated}, Atualizados: ${prodUpdated}\n`);

  // ═══ 3. CONDIÇÕES DE PAGAMENTO ═══
  console.log('═══ CONDIÇÕES DE PAGAMENTO ═══\n');
  const condicoes = await uniplusGet('/public-api/v1/commons/condicaopagamento', { limit: 100 });
  console.log(`  Recebidas: ${condicoes.length}`);
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
  console.log(`  Condições → Criados: ${condCreated}, Atualizados: ${condUpdated}\n`);

  // ═══ 4. VENDAS (month-by-month) — INCREMENTAL ═══
  console.log('═══ VENDAS (mês a mês — incremental) ═══\n');

  // Find last synced venda date
  const [lastSync] = await sql`SELECT MAX(data_entrega)::text as last_date FROM pedidos WHERE origem = 'uniplus'`;
  let startYear = 2019;
  let startMonth = 1;
  if (lastSync?.last_date) {
    const d = new Date(lastSync.last_date);
    // Re-sync last 2 months to catch updates
    d.setMonth(d.getMonth() - 2);
    startYear = d.getFullYear();
    startMonth = d.getMonth() + 1;
    console.log(`  Último sync: ${lastSync.last_date} → buscando desde ${startYear}-${String(startMonth).padStart(2, '0')}\n`);
  }

  const vendas = [];
  for (let year = startYear; year <= 2026; year++) {
    const mStart = (year === startYear) ? startMonth : 1;
    for (let month = mStart; month <= 12; month++) {
      const now = new Date();
      if (year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth() + 1)) break;
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0);
      const results = await fetchRange('/public-api/v2/venda', 'emissao', start, end, `${year}-${String(month).padStart(2, '0')}`);
      vendas.push(...results);
    }
  }

  // Deduplicate
  const vendaMap = new Map();
  for (const v of vendas) vendaMap.set(String(v.idVenda), v);
  const uniqueVendas = Array.from(vendaMap.values());
  console.log(`\n  Vendas coletadas: ${uniqueVendas.length}`);

  // Pre-load lookups
  const clienteRows = await sql`SELECT id, uniplus_id FROM clientes WHERE uniplus_id IS NOT NULL`;
  const clienteMap = new Map(clienteRows.map(c => [String(c.uniplus_id), c.id]));

  const userRows = await sql`SELECT id, nome FROM usuarios`;
  const userMap = new Map(userRows.map(u => [u.nome.toLowerCase(), u.id]));

  // Load existing uniplus vendas for incremental update
  const existingVendas = await sql`SELECT uniplus_id FROM pedidos WHERE origem = 'uniplus'`;
  const existingUniplusIds = new Set(existingVendas.map(r => r.uniplus_id));

  const existingNumeros = await sql`SELECT numero FROM pedidos`;
  const usedNumeros = new Set(existingNumeros.map(r => r.numero));

  const statusMap = { 0: 'pendente', 1: 'pendente', 2: 'em_producao', 3: 'concluido', 4: 'cancelado', 6: 'cancelado' };

  // Filter only new vendas
  const newVendas = uniqueVendas.filter(v => !existingUniplusIds.has(String(v.idVenda)));
  console.log(`  Novas (não existem no banco): ${newVendas.length}`);

  // Also update existing ones (status, valor may change)
  const updateVendas = uniqueVendas.filter(v => existingUniplusIds.has(String(v.idVenda)));
  console.log(`  Para atualizar: ${updateVendas.length}`);

  // Insert new vendas in batches
  const rows = [];
  for (const v of newVendas) {
    const codigo = String(v.idVenda);
    const valorTotal = parseFloat(v.valorTotal) || 0;
    const documento = v.documento || '';
    const emissao = v.emissao || null;
    const clienteId = v.codigoCliente ? (clienteMap.get(String(v.codigoCliente)) || null) : null;
    const vendedorId = v.nomeVendedor ? (userMap.get(v.nomeVendedor.toLowerCase()) || null) : null;
    const status = statusMap[v.status] || 'pendente';

    let numero = `UP-${documento || codigo}`;
    if (usedNumeros.has(numero)) numero = `UP-${documento}-${codigo}`;
    if (usedNumeros.has(numero)) numero = `UP-${codigo}`;
    usedNumeros.add(numero);

    rows.push({ numero, cliente_id: clienteId, cliente_nome: v.nomeCliente || null, vendedor_id: vendedorId,
      status, valor_total: valorTotal, data_entrega: emissao, origem: 'uniplus', uniplus_id: codigo, uniplus_updated_at: new Date() });
  }

  const BATCH = 200;
  const COLS = ['numero', 'cliente_id', 'cliente_nome', 'vendedor_id', 'status', 'valor_total', 'data_entrega', 'origem', 'uniplus_id', 'uniplus_updated_at'];
  let vndCreated = 0, vndErrors = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    try {
      await sql`INSERT INTO pedidos ${sql(batch, ...COLS)}`;
      vndCreated += batch.length;
    } catch (batchErr) {
      for (const r of batch) {
        try {
          await sql`INSERT INTO pedidos (numero, cliente_id, cliente_nome, vendedor_id, status, valor_total, data_entrega, origem, uniplus_id, uniplus_updated_at)
            VALUES (${r.numero}, ${r.cliente_id}, ${r.cliente_nome}, ${r.vendedor_id}, ${r.status}, ${r.valor_total}, ${r.data_entrega}, 'uniplus', ${r.uniplus_id}, NOW())`;
          vndCreated++;
        } catch (err) {
          vndErrors++;
          if (vndErrors <= 5) console.log(`  ERRO: ${err.message.substring(0, 100)}`);
        }
      }
    }
    if ((i + BATCH) % 2000 === 0 || i + BATCH >= rows.length) {
      console.log(`  Inserindo: ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
    }
  }
  console.log(`  Vendas inseridas: ${vndCreated}, Erros: ${vndErrors}`);

  // Update existing vendas (status, valor, cliente_id)
  let vndUpdated = 0;
  for (const v of updateVendas) {
    const codigo = String(v.idVenda);
    const clienteId = v.codigoCliente ? (clienteMap.get(String(v.codigoCliente)) || null) : null;
    const status = statusMap[v.status] || 'pendente';
    const valorTotal = parseFloat(v.valorTotal) || 0;
    await sql`
      UPDATE pedidos SET
        status = ${status},
        valor_total = ${valorTotal},
        cliente_id = COALESCE(${clienteId}, cliente_id),
        cliente_nome = COALESCE(${v.nomeCliente || null}, cliente_nome),
        uniplus_updated_at = NOW(),
        updated_at = NOW()
      WHERE uniplus_id = ${codigo} AND origem = 'uniplus'`;
    vndUpdated++;
  }
  console.log(`  Vendas atualizadas: ${vndUpdated}\n`);

  // ═══ 5. RE-MATCH: vincular vendas a clientes por nome ═══
  console.log('═══ RE-MATCH CLIENTES ═══\n');
  const unmatched = await sql`
    SELECT DISTINCT cliente_nome FROM pedidos
    WHERE origem = 'uniplus' AND cliente_id IS NULL AND cliente_nome IS NOT NULL`;
  
  let matched = 0;
  for (const { cliente_nome } of unmatched) {
    const [cli] = await sql`SELECT id FROM clientes WHERE razao_social ILIKE ${cliente_nome} LIMIT 1`;
    if (cli) {
      await sql`UPDATE pedidos SET cliente_id = ${cli.id} WHERE origem = 'uniplus' AND cliente_nome = ${cliente_nome} AND cliente_id IS NULL`;
      matched++;
    }
  }
  console.log(`  Nomes sem vínculo: ${unmatched.length}`);
  console.log(`  Vinculados por nome: ${matched}\n`);

  // Update sync metadata
  await sql`UPDATE uniplus_config SET last_sync_at = NOW(), updated_at = NOW() WHERE ativo = true`;

  // ═══ RELATÓRIO FINAL ═══
  console.log('═══════════════════════════════════════════');
  console.log('           RELATÓRIO FINAL');
  console.log('═══════════════════════════════════════════\n');

  const [r] = await sql`
    SELECT
      (SELECT COUNT(*) FROM clientes) as total_clientes,
      (SELECT COUNT(*) FROM clientes WHERE uniplus_id IS NOT NULL) as clientes_uniplus,
      (SELECT COUNT(*) FROM clientes WHERE email IS NOT NULL AND email != '') as clientes_com_email,
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
  console.log(`  Excel (importação): ${r.pedidos_importacao}`);
  console.log(`  Uniplus (vendas): ${r.vendas_uniplus}`);
  console.log(`\nQUALIDADE VENDAS:`);
  const uv = Number(r.vendas_uniplus);
  if (uv > 0) {
    console.log(`  Com cliente vinculado: ${r.vendas_com_cliente}/${uv} (${Math.round(Number(r.vendas_com_cliente)/uv*100)}%)`);
    console.log(`  Valor total: R$ ${Number(r.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`  Período: ${r.data_min} a ${r.data_max}`);
  }

  // Vendas por ano
  const byYear = await sql`
    SELECT EXTRACT(YEAR FROM data_entrega)::int as ano, COUNT(*) as qtd,
    COALESCE(SUM(valor_total), 0) as total
    FROM pedidos WHERE origem = 'uniplus' AND data_entrega IS NOT NULL
    GROUP BY ano ORDER BY ano`;
  console.log('\nVENDAS POR ANO:');
  byYear.forEach(y => console.log(`  ${y.ano}: ${y.qtd} vendas, R$ ${Number(y.total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`));

  await sql.end();
  console.log('\n=== Sincronização completa! ===');
}

main().catch(err => { console.error('ERRO FATAL:', err); process.exit(1); });
