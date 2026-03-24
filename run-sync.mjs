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
    throw new Error(`GET ${path} → ${resp.status}: ${text.substring(0, 150)}`);
  }
  const data = await resp.json();
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && 'value' in data) return data.value;
  return [];
}

// Format date as YYYY-MM-DD
function fmt(d) {
  return d.toISOString().split('T')[0];
}

// ─── Smart fetcher: subdivide intervals if 100 results ─────────────────────

async function fetchRange(path, dateField, start, end, label) {
  const results = await uniplusGet(path, { [`${dateField}.ge`]: fmt(start), [`${dateField}.le`]: fmt(end), limit: 100 });

  if (results.length < 100) {
    if (results.length > 0) {
      console.log(`    ${label}: ${results.length}`);
    }
    return results;
  }

  // Exactly 100 — there are probably more. Subdivide.
  const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24));

  if (diffDays <= 1) {
    // Can't subdivide further — just log warning
    console.log(`    ${label}: 100 (LIMITE! período de ${diffDays} dia, pode ter perdido registros)`);
    return results;
  }

  // Split in half
  const mid = new Date(start.getTime() + Math.floor(diffDays / 2) * 24 * 60 * 60 * 1000);
  const nextDay = new Date(mid.getTime() + 24 * 60 * 60 * 1000);

  console.log(`    ${label}: 100 → subdividindo [${fmt(start)}..${fmt(mid)}] + [${fmt(nextDay)}..${fmt(end)}]`);

  const firstHalf = await fetchRange(path, dateField, start, mid, `${label}a`);
  const secondHalf = await fetchRange(path, dateField, nextDay, end, `${label}b`);

  // Deduplicate by idVenda or id
  const seen = new Set();
  const all = [];
  for (const r of [...firstHalf, ...secondHalf]) {
    const key = String(r.idVenda || r.id || JSON.stringify(r));
    if (!seen.has(key)) {
      seen.add(key);
      all.push(r);
    }
  }
  return all;
}

async function fetchAllByMonth(path, dateField, startYear, endYear) {
  const all = [];
  for (let year = startYear; year <= endYear; year++) {
    for (let month = 1; month <= 12; month++) {
      // Skip future months
      const now = new Date();
      if (year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth() + 1)) break;

      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0); // last day of month
      const label = `${year}-${String(month).padStart(2, '0')}`;

      const results = await fetchRange(path, dateField, start, end, label);
      all.push(...results);
    }
  }
  return all;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  await loadConfig();
  await authenticate();
  console.log('Conectado ao Uniplus\n');

  // ═══ 1. Limpar vendas uniplus anteriores ═══
  const [countBefore] = await sql`SELECT COUNT(*) as c FROM pedidos WHERE origem = 'uniplus'`;
  if (Number(countBefore.c) > 0) {
    console.log(`Limpando ${countBefore.c} vendas uniplus anteriores...\n`);
    await sql`DELETE FROM pedidos WHERE origem = 'uniplus'`;
  }

  // ═══ 2. Buscar entidades (clientes) ═══
  console.log('═══ ENTIDADES ═══\n');
  const entidades = await uniplusGet('/public-api/v1/entidades', { limit: 100 });
  console.log(`  Recebidas: ${entidades.length}`);
  const clientes = entidades.filter(e => String(e.tipo || '').includes('1'));
  console.log(`  Clientes (tipo inclui 1): ${clientes.length}`);

  // Upsert clientes
  let cliCreated = 0, cliUpdated = 0, cliSkipped = 0;
  for (const e of clientes) {
    const razaoSocial = e.razaoSocial?.trim() || e.nome?.trim() || '';
    const cnpj = (e.cnpjCpf || '').replace(/\D/g, '');
    if (!razaoSocial || !cnpj) { cliSkipped++; continue; }

    const email = e.email?.trim() || null;
    const telefone = e.telefone?.trim() || null;
    const celular = e.celular?.trim() || null;
    const endereco = [e.endereco, e.numeroEndereco].filter(Boolean).join(', ').trim() || null;
    const bairro = e.bairro?.trim() || null;
    const cep = e.cep?.trim() || null;
    const cidade = e.cidade?.trim() || null;
    const estado = e.estado?.trim() || null;
    const ativo = e.inativo === 0;

    const [existing] = await sql`SELECT id FROM clientes WHERE uniplus_id = ${e.codigo}`;
    if (existing) {
      await sql`
        UPDATE clientes SET razao_social = ${razaoSocial}, cnpj = ${cnpj}, email = ${email},
        telefone = ${telefone}, celular = ${celular}, endereco = ${endereco},
        bairro = ${bairro}, cep = ${cep}, cidade = ${cidade}, estado = ${estado},
        ativo = ${ativo}, uniplus_updated_at = NOW(), updated_at = NOW()
        WHERE id = ${existing.id}`;
      cliUpdated++;
    } else {
      const [byCnpj] = await sql`SELECT id FROM clientes WHERE cnpj = ${cnpj}`;
      if (byCnpj) {
        await sql`
          UPDATE clientes SET uniplus_id = ${e.codigo}, razao_social = ${razaoSocial},
          email = ${email}, telefone = ${telefone}, celular = ${celular}, endereco = ${endereco},
          bairro = ${bairro}, cep = ${cep}, cidade = ${cidade}, estado = ${estado},
          ativo = ${ativo}, uniplus_updated_at = NOW(), updated_at = NOW()
          WHERE id = ${byCnpj.id}`;
        cliUpdated++;
      } else {
        await sql`
          INSERT INTO clientes (razao_social, cnpj, email, telefone, celular, endereco, bairro, cep, cidade, estado, ativo, uniplus_id, uniplus_updated_at)
          VALUES (${razaoSocial}, ${cnpj}, ${email}, ${telefone}, ${celular}, ${endereco}, ${bairro}, ${cep}, ${cidade}, ${estado}, ${ativo}, ${e.codigo}, NOW())`;
        cliCreated++;
      }
    }
  }
  console.log(`  Clientes → Criados: ${cliCreated}, Atualizados: ${cliUpdated}, Skipped: ${cliSkipped}\n`);

  // ═══ 3. Produtos ═══
  console.log('═══ PRODUTOS ═══\n');
  const produtos = await uniplusGet('/public-api/v1/produtos', { limit: 100 });
  console.log(`  Recebidos: ${produtos.length}`);
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

  // ═══ 4. Condições de Pagamento ═══
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

  // ═══ 5. VENDAS — mês a mês com subdivisão automática ═══
  console.log('═══ VENDAS (mês a mês) ═══\n');
  const vendas = await fetchAllByMonth('/public-api/v2/venda', 'emissao', 2019, 2026);
  console.log(`\n  Total vendas coletadas: ${vendas.length}`);

  // Deduplicate by idVenda
  const vendaMap = new Map();
  for (const v of vendas) {
    const key = String(v.idVenda);
    if (!vendaMap.has(key)) vendaMap.set(key, v);
  }
  const uniqueVendas = Array.from(vendaMap.values());
  console.log(`  Vendas únicas (dedup): ${uniqueVendas.length}`);

  // Pre-load lookups for fast mapping
  console.log('  Carregando lookups...');
  const clienteRows = await sql`SELECT id, uniplus_id FROM clientes WHERE uniplus_id IS NOT NULL`;
  const clienteMap = new Map(clienteRows.map(c => [c.uniplus_id, c.id]));

  const userRows = await sql`SELECT id, nome FROM usuarios`;
  const userMap = new Map(userRows.map(u => [u.nome.toLowerCase(), u.id]));

  const existingNumeros = await sql`SELECT numero FROM pedidos WHERE origem != 'uniplus'`;
  const usedNumeros = new Set(existingNumeros.map(r => r.numero));

  const statusMap = { 0: 'pendente', 1: 'pendente', 2: 'em_producao', 3: 'concluido', 4: 'cancelado', 6: 'cancelado' };

  // Prepare all rows in memory
  const rows = [];
  for (const v of uniqueVendas) {
    const codigo = String(v.idVenda);
    const valorTotal = parseFloat(v.valorTotal) || 0;
    const documento = v.documento || '';
    const emissao = v.emissao || null;

    const clienteId = v.codigoCliente ? (clienteMap.get(v.codigoCliente) || null) : null;
    let vendedorId = null;
    if (v.nomeVendedor) {
      vendedorId = userMap.get(v.nomeVendedor.toLowerCase()) || null;
    }

    const status = statusMap[v.status] || 'pendente';

    let numero = `UP-${documento || codigo}`;
    if (usedNumeros.has(numero)) numero = `UP-${documento}-${codigo}`;
    if (usedNumeros.has(numero)) numero = `UP-${codigo}`;
    usedNumeros.add(numero);

    rows.push({ numero, cliente_id: clienteId, cliente_nome: v.nomeCliente || null, vendedor_id: vendedorId,
      status, valor_total: valorTotal, data_entrega: emissao, origem: 'uniplus', uniplus_id: codigo, uniplus_updated_at: new Date() });
  }

  // Batch insert (200 at a time using postgres.js helper)
  const BATCH = 200;
  const COLS = ['numero', 'cliente_id', 'cliente_nome', 'vendedor_id', 'status', 'valor_total', 'data_entrega', 'origem', 'uniplus_id', 'uniplus_updated_at'];
  let vndCreated = 0, vndErrors = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    try {
      await sql`INSERT INTO pedidos ${sql(batch, ...COLS)}`;
      vndCreated += batch.length;
    } catch (batchErr) {
      // Fallback: insert one by one
      for (const r of batch) {
        try {
          await sql`
            INSERT INTO pedidos (numero, cliente_id, cliente_nome, vendedor_id, status, valor_total, data_entrega, origem, uniplus_id, uniplus_updated_at)
            VALUES (${r.numero}, ${r.cliente_id}, ${r.cliente_nome}, ${r.vendedor_id}, ${r.status}, ${r.valor_total}, ${r.data_entrega}, 'uniplus', ${r.uniplus_id}, NOW())`;
          vndCreated++;
        } catch (err) {
          vndErrors++;
          if (vndErrors <= 10) console.log(`  ERRO venda ${r.uniplus_id}: ${err.message.substring(0, 100)}`);
        }
      }
    }
    if ((i + BATCH) % 5000 === 0 || i + BATCH >= rows.length) {
      console.log(`  Progresso: ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
    }
  }
  console.log(`  Vendas inseridas: ${vndCreated}, Erros: ${vndErrors}\n`);

  // Update sync metadata
  await sql`UPDATE uniplus_config SET last_sync_at = NOW(), updated_at = NOW() WHERE ativo = true`;

  // ═══ 6. RELATÓRIO FINAL ═══
  console.log('═══════════════════════════════════════════');
  console.log('           RELATÓRIO FINAL');
  console.log('═══════════════════════════════════════════\n');

  const [r] = await sql`
    SELECT
      (SELECT COUNT(*) FROM clientes) as total_clientes,
      (SELECT COUNT(*) FROM clientes WHERE uniplus_id IS NOT NULL) as clientes_uniplus,
      (SELECT COUNT(*) FROM clientes WHERE email IS NOT NULL AND email != '') as clientes_com_email,
      (SELECT COUNT(*) FROM clientes WHERE cidade IS NOT NULL AND cidade != '') as clientes_com_cidade,
      (SELECT COUNT(*) FROM tipos_papel) as total_produtos,
      (SELECT COUNT(*) FROM tipos_papel WHERE uniplus_id IS NOT NULL) as produtos_uniplus,
      (SELECT COUNT(*) FROM condicoes_pagamento) as total_condicoes,
      (SELECT COUNT(*) FROM condicoes_pagamento WHERE uniplus_id IS NOT NULL) as condicoes_uniplus,
      (SELECT COUNT(*) FROM pedidos) as total_pedidos,
      (SELECT COUNT(*) FROM pedidos WHERE origem = 'uniplus') as vendas_uniplus,
      (SELECT COUNT(*) FROM pedidos WHERE origem = 'importacao') as pedidos_importacao,
      (SELECT COUNT(*) FROM pedidos WHERE origem = 'uniplus' AND cliente_id IS NOT NULL) as vendas_com_cliente,
      (SELECT COUNT(*) FROM pedidos WHERE origem = 'uniplus' AND valor_total > 0) as vendas_com_valor,
      (SELECT COUNT(*) FROM pedidos WHERE origem = 'uniplus' AND data_entrega IS NOT NULL) as vendas_com_data,
      (SELECT COALESCE(SUM(valor_total), 0) FROM pedidos WHERE origem = 'uniplus') as valor_total,
      (SELECT MIN(data_entrega)::text FROM pedidos WHERE origem = 'uniplus') as data_min,
      (SELECT MAX(data_entrega)::text FROM pedidos WHERE origem = 'uniplus') as data_max
  `;

  console.log(`CLIENTES: ${r.total_clientes} total (${r.clientes_uniplus} Uniplus)`);
  console.log(`  Com email: ${r.clientes_com_email} | Com cidade: ${r.clientes_com_cidade}`);
  console.log(`PRODUTOS: ${r.total_produtos} total (${r.produtos_uniplus} Uniplus)`);
  console.log(`CONDIÇÕES: ${r.total_condicoes} total (${r.condicoes_uniplus} Uniplus)`);
  console.log(`\nPEDIDOS TOTAL: ${r.total_pedidos}`);
  console.log(`  Excel (importação): ${r.pedidos_importacao}`);
  console.log(`  Uniplus (vendas): ${r.vendas_uniplus}`);

  const uv = Number(r.vendas_uniplus);
  if (uv > 0) {
    const pct = (n) => `${n}/${uv} (${Math.round(Number(n)/uv*100)}%)`;
    console.log(`\nQUALIDADE VENDAS:`);
    console.log(`  Com cliente: ${pct(r.vendas_com_cliente)}`);
    console.log(`  Com valor: ${pct(r.vendas_com_valor)}`);
    console.log(`  Com data: ${pct(r.vendas_com_data)}`);
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

  // Top clientes
  const top = await sql`
    SELECT COALESCE(c.razao_social, p.cliente_nome) as nome, COUNT(*) as qtd, COALESCE(SUM(p.valor_total), 0) as total
    FROM pedidos p LEFT JOIN clientes c ON c.id = p.cliente_id
    WHERE p.origem = 'uniplus'
    GROUP BY nome ORDER BY total DESC LIMIT 10`;
  console.log('\nTOP 10 CLIENTES:');
  top.forEach((c, i) => console.log(`  ${i + 1}. ${c.nome}: ${c.qtd} vendas, R$ ${Number(c.total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`));

  // Status distribution
  const statusDist = await sql`SELECT status, COUNT(*) as c FROM pedidos WHERE origem = 'uniplus' GROUP BY status ORDER BY c DESC`;
  console.log('\nSTATUS:');
  statusDist.forEach(s => console.log(`  ${s.status}: ${s.c}`));

  // Months that hit 100 limit (potential data loss)
  console.log('\n═══ MESES QUE BATERAM NO LIMITE ═══');
  console.log('(se aparecer algum abaixo, há dados faltando)\n');

  await sql.end();
  console.log('\n=== Sincronização completa! ===');
}

main().catch(err => {
  console.error('ERRO FATAL:', err);
  process.exit(1);
});
