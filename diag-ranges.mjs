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

  // Diagnóstico: a primeira "página" retornou codigos de 1 a 4993 (100 registros)
  // Será que entre 1 e 4993 tem MAIS de 100?

  console.log('═══ TESTE: Subdividindo faixa de código 1-4993 ═══\n');

  // Tentar com codigo.le para limitar a faixa
  const ranges = [
    [0, 1000], [1000, 2000], [2000, 3000], [3000, 4000], [4000, 5000],
  ];

  let total = 0;
  for (const [gt, le] of ranges) {
    const params = { 'codigo.gt': gt, 'codigo.le': le, limit: 100 };
    const r = await uniplusGet('/public-api/v1/entidades', params);
    if (r.error) {
      console.log(`  codigo ${gt}-${le}: ERROR ${r.error}: ${r.text}`);
    } else {
      console.log(`  codigo ${gt}-${le}: ${r.length} registros${r.length === 100 ? ' ⚠️ TRUNCADO!' : ''}`);
      total += r.length;
    }
  }
  console.log(`  Total na faixa 0-5000: ${total}\n`);

  // Agora testar faixas menores onde retornou 100
  console.log('═══ SUBDIVIDINDO faixas com 100 ═══\n');
  
  // Fazer scan completo com faixas de 100 em codigo
  let grandTotal = 0;
  let lastCode = 0;
  const step = 200;
  let pagesOf100 = 0;
  
  for (let start = 0; start <= 10000; start += step) {
    const params = { 'codigo.gt': start, 'codigo.le': start + step, limit: 100 };
    const r = await uniplusGet('/public-api/v1/entidades', params);
    if (r.error) continue;
    if (r.length > 0) {
      grandTotal += r.length;
      if (r.length === 100) {
        pagesOf100++;
        console.log(`  ${start}-${start+step}: ${r.length} ⚠️ TRUNCADO`);
      }
    }
  }
  console.log(`\n  Total com step=${step}: ${grandTotal} (${pagesOf100} faixas truncadas)`);

  // Se ainda truncado, testar step menor
  if (pagesOf100 > 0) {
    console.log('\n═══ Testando step=50 ═══\n');
    let total50 = 0;
    let trunc50 = 0;
    for (let start = 0; start <= 10000; start += 50) {
      const params = { 'codigo.gt': start, 'codigo.le': start + 50, limit: 100 };
      const r = await uniplusGet('/public-api/v1/entidades', params);
      if (r.error) continue;
      if (r.length > 0) {
        total50 += r.length;
        if (r.length === 100) {
          trunc50++;
          console.log(`  ${start}-${start+50}: ${r.length} ⚠️ TRUNCADO`);
        }
      }
    }
    console.log(`\n  Total com step=50: ${total50} (${trunc50} faixas truncadas)`);
  }

  // Mesma coisa para produtos
  console.log('\n═══ PRODUTOS: teste de faixas ═══\n');
  let prodTotal = 0;
  let prodTrunc = 0;
  for (let start = 0; start <= 10000; start += 200) {
    const params = { 'codigo.gt': start, 'codigo.le': start + 200, limit: 100 };
    const r = await uniplusGet('/public-api/v1/produtos', params);
    if (r.error) continue;
    if (r.length > 0) {
      prodTotal += r.length;
      if (r.length === 100) {
        prodTrunc++;
        console.log(`  ${start}-${start+200}: ${r.length} ⚠️ TRUNCADO`);
      }
    }
  }
  console.log(`\n  Total produtos com step=200: ${prodTotal} (${prodTrunc} faixas truncadas)`);

  await sql.end();
}

main().catch(err => { console.error('ERRO:', err); process.exit(1); });
