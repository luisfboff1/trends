import postgres from 'postgres';
import https from 'https';

const sql = postgres(process.env.DATABASE_URL);
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

let token = null;
let config = null;

async function loadConfig() {
  const [c] = await sql`
    SELECT server_url, auth_code, user_id, user_password
    FROM uniplus_config WHERE ativo = true LIMIT 1
  `;
  if (!c) throw new Error('UniPlus não configurado.');
  config = c;
}

async function authenticate() {
  if (token && (Date.now() - token.obtained_at) < (token.expires_in - 60) * 1000) {
    return token.access_token;
  }
  const baseUrl = config.server_url.replace(/\/$/, '');
  const resp = await fetch(`${baseUrl}/oauth/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${config.auth_code}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
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
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) qs.set(k, String(v));
  }
  const url = `${baseUrl}${path}${qs.toString() ? '?' + qs : ''}`;

  const resp = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'userid': config.user_id,
      'password': config.user_password,
    },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`GET ${path} [${qs}] → ${resp.status}: ${text}`);
  }

  const data = await resp.json();
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && 'value' in data) return data.value;
  return [];
}

async function main() {
  await loadConfig();
  await authenticate();
  console.log('Conectado ao Uniplus\n');

  // 1. Check entidades - sem filtro tipo
  console.log('=== ENTIDADES (sem filtro tipo) ===');
  try {
    const page0 = await uniplusGet('/public-api/v1/entidades', { limit: 100, offset: 0 });
    console.log(`  offset=0: ${page0.length} registros`);
    
    if (page0.length === 100) {
      const page1 = await uniplusGet('/public-api/v1/entidades', { limit: 100, offset: 100 });
      console.log(`  offset=100: ${page1.length} registros`);
      
      if (page1.length === 100) {
        const page2 = await uniplusGet('/public-api/v1/entidades', { limit: 100, offset: 200 });
        console.log(`  offset=200: ${page2.length} registros`);
        
        if (page2.length === 100) {
          const page3 = await uniplusGet('/public-api/v1/entidades', { limit: 100, offset: 300 });
          console.log(`  offset=300: ${page3.length} registros`);

          if (page3.length === 100) {
            const page4 = await uniplusGet('/public-api/v1/entidades', { limit: 100, offset: 400 });
            console.log(`  offset=400: ${page4.length} registros`);

            if (page4.length === 100) {
              // Try with bigger limit
              const big = await uniplusGet('/public-api/v1/entidades', { limit: 1000, offset: 0 });
              console.log(`  limit=1000: ${big.length} registros`);
            }
          }
        }
      }
    }

    // Check tipos presentes
    if (page0.length > 0) {
      const tipos = {};
      page0.forEach(e => {
        const t = e.tipo || 'undefined';
        tipos[t] = (tipos[t] || 0) + 1;
      });
      console.log('  Tipos na 1ª página:', tipos);
      console.log('  Amostra (1o registro):', JSON.stringify(Object.keys(page0[0])).substring(0, 200));
    }
  } catch (err) {
    console.log(`  ERRO: ${err.message}`);
  }

  // 2. Check if limit param actually works
  console.log('\n=== TESTE LIMITE ===');
  try {
    const lim10 = await uniplusGet('/public-api/v1/entidades', { limit: 10 });
    console.log(`  limit=10: ${lim10.length} registros`);
    
    const lim50 = await uniplusGet('/public-api/v1/entidades', { limit: 50 });
    console.log(`  limit=50: ${lim50.length} registros`);
    
    const lim200 = await uniplusGet('/public-api/v1/entidades', { limit: 200 });
    console.log(`  limit=200: ${lim200.length} registros`);

    const lim500 = await uniplusGet('/public-api/v1/entidades', { limit: 500 });
    console.log(`  limit=500: ${lim500.length} registros`);
  } catch (err) {
    console.log(`  ERRO: ${err.message}`);
  }

  // 3. Check produtos total
  console.log('\n=== PRODUTOS ===');
  try {
    const p0 = await uniplusGet('/public-api/v1/produtos', { limit: 100, offset: 0 });
    console.log(`  offset=0: ${p0.length}`);
    if (p0.length === 100) {
      const p1 = await uniplusGet('/public-api/v1/produtos', { limit: 100, offset: 100 });
      console.log(`  offset=100: ${p1.length}`);
      if (p1.length >= 100) {
        const p2 = await uniplusGet('/public-api/v1/produtos', { limit: 100, offset: 200 });
        console.log(`  offset=200: ${p2.length}`);
      }
    }
    // Try big
    const big = await uniplusGet('/public-api/v1/produtos', { limit: 500 });
    console.log(`  limit=500: ${big.length}`);
  } catch (err) {
    console.log(`  ERRO: ${err.message}`);
  }

  // 4. Check condições total
  console.log('\n=== CONDIÇÕES PAGAMENTO ===');
  try {
    const c0 = await uniplusGet('/public-api/v1/commons/condicaopagamento', { limit: 100, offset: 0 });
    console.log(`  offset=0: ${c0.length}`);
    if (c0.length === 100) {
      const c1 = await uniplusGet('/public-api/v1/commons/condicaopagamento', { limit: 100, offset: 100 });
      console.log(`  offset=100: ${c1.length}`);
    }
    const big = await uniplusGet('/public-api/v1/commons/condicaopagamento', { limit: 500 });
    console.log(`  limit=500: ${big.length}`);
  } catch (err) {
    console.log(`  ERRO: ${err.message}`);
  }

  // 5. Check vendas total
  console.log('\n=== VENDAS ===');
  try {
    const v0 = await uniplusGet('/public-api/v2/venda', { limit: 100, offset: 0 });
    console.log(`  offset=0: ${v0.length}`);
    if (v0.length === 100) {
      const v1 = await uniplusGet('/public-api/v2/venda', { limit: 100, offset: 100 });
      console.log(`  offset=100: ${v1.length}`);
      if (v1.length === 100) {
        const v2 = await uniplusGet('/public-api/v2/venda', { limit: 100, offset: 200 });
        console.log(`  offset=200: ${v2.length}`);
        if (v2.length === 100) {
          const v3 = await uniplusGet('/public-api/v2/venda', { limit: 100, offset: 300 });
          console.log(`  offset=300: ${v3.length}`);
          if (v3.length === 100) {
            const v4 = await uniplusGet('/public-api/v2/venda', { limit: 100, offset: 400 });
            console.log(`  offset=400: ${v4.length}`);
          }
        }
      }
    }
    const big = await uniplusGet('/public-api/v2/venda', { limit: 500 });
    console.log(`  limit=500: ${big.length}`);
  } catch (err) {
    console.log(`  ERRO: ${err.message}`);
  }

  // 6. Check duplicate numero issue
  console.log('\n=== DUPLICATAS VENDAS (documento) ===');
  try {
    const vendas = await uniplusGet('/public-api/v2/venda', { limit: 500 });
    const docs = {};
    vendas.forEach(v => {
      const doc = v.documento || '';
      docs[doc] = (docs[doc] || 0) + 1;
    });
    const dupes = Object.entries(docs).filter(([, c]) => c > 1);
    console.log(`  Total vendas: ${vendas.length}`);
    console.log(`  Documentos únicos: ${Object.keys(docs).length}`);
    console.log(`  Documentos duplicados: ${dupes.length}`);
    if (dupes.length > 0) {
      console.log('  Exemplos de duplicatas:');
      dupes.slice(0, 10).forEach(([doc, count]) => {
        console.log(`    "${doc}": ${count}x`);
      });
    }

    // Also check existing numero collision
    const existingNumeros = await sql`SELECT numero FROM pedidos WHERE origem = 'importacao' LIMIT 5`;
    console.log('\n  Exemplos de numero (importação):', existingNumeros.map(r => r.numero));

    const uniplusNumeros = await sql`SELECT numero FROM pedidos WHERE origem = 'uniplus' LIMIT 5`;
    console.log('  Exemplos de numero (uniplus):', uniplusNumeros.map(r => r.numero));
  } catch (err) {
    console.log(`  ERRO: ${err.message}`);
  }

  await sql.end();
  console.log('\n=== Diagnóstico completo ===');
}

main().catch(err => {
  console.error('ERRO:', err);
  process.exit(1);
});
