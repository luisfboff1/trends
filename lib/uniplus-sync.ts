import type { Sql } from 'postgres'
import { UniplusClient } from './uniplus-client'
import type {
  UniplusEntidade,
  UniplusProduto,
  UniplusVenda,
  SyncResult,
  SyncError,
  SyncTipo,
  SyncDirection,
} from '@/types/uniplus'

// ─── Helper: create client from DB config ───────────────────────────────────

export async function createClientFromConfig(sql: Sql): Promise<UniplusClient> {
  const [config] = await sql`
    SELECT server_url, auth_code, user_id, user_password
    FROM uniplus_config WHERE ativo = true LIMIT 1
  `
  if (!config) throw new Error('UniPlus não configurado. Configure em Configurações > UniPlus.')

  return new UniplusClient({
    serverUrl: config.server_url,
    authCode: config.auth_code,
    userId: config.user_id,
    userPassword: config.user_password,
  })
}

// ─── Sync Log Management ────────────────────────────────────────────────────

async function createSyncLog(
  sql: Sql,
  tipo: SyncTipo,
  direcao: SyncDirection,
  userId: number
): Promise<number> {
  const [log] = await sql`
    INSERT INTO uniplus_sync_log (tipo, direcao, status, iniciado_por)
    VALUES (${tipo}, ${direcao}, 'running', ${userId})
    RETURNING id
  `
  return log.id
}

async function finishSyncLog(sql: Sql, logId: number, result: SyncResult): Promise<void> {
  await sql`
    UPDATE uniplus_sync_log SET
      status = ${result.status},
      total_registros = ${result.total_registros},
      registros_criados = ${result.registros_criados},
      registros_atualizados = ${result.registros_atualizados},
      registros_erros = ${result.registros_erros},
      erros = ${result.erros.length > 0 ? JSON.stringify(result.erros) : null},
      finished_at = NOW()
    WHERE id = ${logId}
  `
}

// ─── Import: Vendedores ─────────────────────────────────────────────────────

export async function syncVendedores(
  client: UniplusClient, db: Sql, userId: number
): Promise<SyncResult> {
  const logId = await createSyncLog(db, 'vendedores', 'import', userId)
  const result: SyncResult = {
    tipo: 'vendedores', direcao: 'import', status: 'success',
    total_registros: 0, registros_criados: 0, registros_atualizados: 0,
    registros_erros: 0, erros: [],
  }

  try {
    const vendedores = await client.getVendedores()
    result.total_registros = vendedores.length

    for (const v of vendedores) {
      try {
        const nome = v.nome?.trim() || `Vendedor ${v.codigo}`
        const email = v.email?.trim() || ''

        const [existing] = await db`
          SELECT id FROM usuarios WHERE uniplus_id = ${v.codigo}
        `

        if (existing) {
          await db`
            UPDATE usuarios SET
              nome = ${nome},
              uniplus_updated_at = NOW(),
              updated_at = NOW()
            WHERE id = ${existing.id}
          `
          result.registros_atualizados++
        } else {
          // Only create if we have an email, otherwise link by name
          if (email) {
            const [byEmail] = await db`SELECT id FROM usuarios WHERE email = ${email}`
            if (byEmail) {
              await db`
                UPDATE usuarios SET uniplus_id = ${v.codigo}, uniplus_updated_at = NOW(), updated_at = NOW()
                WHERE id = ${byEmail.id}
              `
              result.registros_atualizados++
              continue
            }
          }
          // Skip creating users — just log, admin creates manually
          result.erros.push({ codigo: v.codigo, mensagem: `Vendedor "${nome}" não encontrado no Trends. Crie manualmente e vincule.` })
          result.registros_erros++
        }
      } catch (err) {
        result.erros.push({ codigo: v.codigo, mensagem: err instanceof Error ? err.message : 'Erro desconhecido' })
        result.registros_erros++
      }
    }
  } catch (err) {
    result.status = 'error'
    result.erros.push({ codigo: '', mensagem: err instanceof Error ? err.message : 'Erro ao buscar vendedores' })
  }

  if (result.registros_erros > 0 && result.status !== 'error') {
    result.status = result.registros_criados + result.registros_atualizados > 0 ? 'partial' : 'error'
  }

  await finishSyncLog(db, logId, result)
  return result
}

// ─── Import: Clientes ───────────────────────────────────────────────────────

export async function syncClientes(
  client: UniplusClient, db: Sql, userId: number
): Promise<SyncResult> {
  const logId = await createSyncLog(db, 'clientes', 'import', userId)
  const result: SyncResult = {
    tipo: 'clientes', direcao: 'import', status: 'success',
    total_registros: 0, registros_criados: 0, registros_atualizados: 0,
    registros_erros: 0, erros: [],
  }

  try {
    const entidades = await client.getClientes()
    result.total_registros = entidades.length

    for (const e of entidades) {
      try {
        await upsertCliente(db, e, userId)
        const [existing] = await db`SELECT id FROM clientes WHERE uniplus_id = ${e.codigo}`
        if (existing) {
          result.registros_atualizados++
        } else {
          result.registros_criados++
        }
      } catch (err) {
        // If upsert succeeded before the count check, still count it
        result.erros.push({ codigo: e.codigo, mensagem: err instanceof Error ? err.message : 'Erro desconhecido' })
        result.registros_erros++
      }
    }
  } catch (err) {
    result.status = 'error'
    result.erros.push({ codigo: '', mensagem: err instanceof Error ? err.message : 'Erro ao buscar clientes' })
  }

  if (result.registros_erros > 0 && result.status !== 'error') {
    result.status = result.registros_criados + result.registros_atualizados > 0 ? 'partial' : 'error'
  }

  await finishSyncLog(db, logId, result)
  return result
}

async function upsertCliente(db: Sql, e: UniplusEntidade, userId: number): Promise<void> {
  const razaoSocial = e.razaoSocial?.trim() || e.nome?.trim() || ''
  const cnpj = (e.cnpjCpf || '').replace(/\D/g, '')
  const email = e.email?.trim() || null
  const telefone = e.telefone?.trim() || null
  const celular = e.celular?.trim() || null
  const endereco = [e.endereco, e.numeroEndereco].filter(Boolean).join(', ').trim() || null
  const bairro = e.bairro?.trim() || null
  const cep = e.cep?.trim() || null
  const cidade = e.cidade?.trim() || null
  const estado = e.estado?.trim() || null
  const ativo = e.inativo === 0

  if (!razaoSocial || !cnpj) return

  const [existing] = await db`
    SELECT id FROM clientes WHERE uniplus_id = ${e.codigo}
  `

  if (existing) {
    await db`
      UPDATE clientes SET
        razao_social = ${razaoSocial},
        cnpj = ${cnpj},
        email = ${email},
        telefone = ${telefone},
        celular = ${celular},
        endereco = ${endereco},
        bairro = ${bairro},
        cep = ${cep},
        cidade = ${cidade},
        estado = ${estado},
        ativo = ${ativo},
        uniplus_updated_at = NOW(),
        updated_at = NOW()
      WHERE id = ${existing.id}
    `
  } else {
    // Check if CNPJ already exists (manual entry)
    const [byCnpj] = await db`SELECT id FROM clientes WHERE cnpj = ${cnpj}`

    if (byCnpj) {
      // Link existing record
      await db`
        UPDATE clientes SET
          uniplus_id = ${e.codigo},
          razao_social = ${razaoSocial},
          email = ${email},
          telefone = ${telefone},
          celular = ${celular},
          endereco = ${endereco},
          bairro = ${bairro},
          cep = ${cep},
          cidade = ${cidade},
          estado = ${estado},
          ativo = ${ativo},
          uniplus_updated_at = NOW(),
          updated_at = NOW()
        WHERE id = ${byCnpj.id}
      `
    } else {
      // Determine vendedor_id — try mapping from UniPlus codigoVendedor
      let vendedorId: number | null = null
      if (e.codigoVendedor) {
        const [vendedor] = await db`SELECT id FROM usuarios WHERE uniplus_id = ${e.codigoVendedor}`
        if (vendedor) vendedorId = vendedor.id
      }
      // Fallback: use first admin
      if (!vendedorId) {
        const [admin] = await db`SELECT id FROM usuarios WHERE tipo = 'admin' AND ativo = true LIMIT 1`
        if (admin) vendedorId = admin.id
      }

      await db`
        INSERT INTO clientes (razao_social, cnpj, email, telefone, celular, endereco, bairro, cep, cidade, estado, vendedor_id, ativo, uniplus_id, uniplus_updated_at)
        VALUES (${razaoSocial}, ${cnpj}, ${email}, ${telefone}, ${celular}, ${endereco}, ${bairro}, ${cep}, ${cidade}, ${estado}, ${vendedorId}, ${ativo}, ${e.codigo}, NOW())
      `
    }
  }
}

// ─── Import: Produtos → Tipos de Papel ──────────────────────────────────────

export async function syncProdutos(
  client: UniplusClient, db: Sql, userId: number
): Promise<SyncResult> {
  const logId = await createSyncLog(db, 'produtos', 'import', userId)
  const result: SyncResult = {
    tipo: 'produtos', direcao: 'import', status: 'success',
    total_registros: 0, registros_criados: 0, registros_atualizados: 0,
    registros_erros: 0, erros: [],
  }

  try {
    const produtos = await client.getProdutos()
    result.total_registros = produtos.length

    for (const p of produtos) {
      try {
        const nome = p.nome?.trim() || ''
        if (!nome) continue

        const preco = parseFloat(p.preco) || 0
        const descricao = p.observacao?.trim() || null
        const fornecedor = p.nomeFornecedor?.trim() || null

        const [existing] = await db`
          SELECT id FROM tipos_papel WHERE uniplus_id = ${p.codigo}
        `

        if (existing) {
          await db`
            UPDATE tipos_papel SET
              nome = ${nome},
              descricao = ${descricao},
              fornecedor = ${fornecedor},
              preco_m2 = ${preco},
              ativo = ${p.inativo === 0},
              uniplus_updated_at = NOW(),
              updated_at = NOW()
            WHERE id = ${existing.id}
          `
          result.registros_atualizados++
        } else {
          await db`
            INSERT INTO tipos_papel (nome, descricao, fornecedor, preco_m2, ativo, uniplus_id, uniplus_updated_at)
            VALUES (${nome}, ${descricao}, ${fornecedor}, ${preco}, ${p.inativo === 0}, ${p.codigo}, NOW())
          `
          result.registros_criados++
        }
      } catch (err) {
        result.erros.push({ codigo: p.codigo, mensagem: err instanceof Error ? err.message : 'Erro desconhecido' })
        result.registros_erros++
      }
    }
  } catch (err) {
    result.status = 'error'
    result.erros.push({ codigo: '', mensagem: err instanceof Error ? err.message : 'Erro ao buscar produtos' })
  }

  if (result.registros_erros > 0 && result.status !== 'error') {
    result.status = result.registros_criados + result.registros_atualizados > 0 ? 'partial' : 'error'
  }

  await finishSyncLog(db, logId, result)
  return result
}

// ─── Import: Condições de Pagamento ─────────────────────────────────────────

export async function syncCondicoesPagamento(
  client: UniplusClient, db: Sql, userId: number
): Promise<SyncResult> {
  const logId = await createSyncLog(db, 'condicoes_pagamento', 'import', userId)
  const result: SyncResult = {
    tipo: 'condicoes_pagamento', direcao: 'import', status: 'success',
    total_registros: 0, registros_criados: 0, registros_atualizados: 0,
    registros_erros: 0, erros: [],
  }

  try {
    const condicoes = await client.getCondicoesPagamento() as Array<Record<string, unknown>>
    result.total_registros = condicoes.length

    for (const c of condicoes) {
      try {
        const codigo = String(c.id || c.codigo || '')
        const nome = String(c.nome || c.descricao || '').trim()
        if (!codigo || !nome) continue

        const [existing] = await db`
          SELECT id FROM condicoes_pagamento WHERE uniplus_id = ${codigo}
        `

        if (existing) {
          await db`
            UPDATE condicoes_pagamento SET
              nome = ${nome},
              uniplus_updated_at = NOW(),
              updated_at = NOW()
            WHERE id = ${existing.id}
          `
          result.registros_atualizados++
        } else {
          await db`
            INSERT INTO condicoes_pagamento (nome, ativo, uniplus_id, uniplus_updated_at)
            VALUES (${nome}, true, ${codigo}, NOW())
          `
          result.registros_criados++
        }
      } catch (err) {
        const codigo = String((c as Record<string, unknown>).id || '')
        result.erros.push({ codigo, mensagem: err instanceof Error ? err.message : 'Erro desconhecido' })
        result.registros_erros++
      }
    }
  } catch (err) {
    result.status = 'error'
    result.erros.push({ codigo: '', mensagem: err instanceof Error ? err.message : 'Erro ao buscar condições de pagamento' })
  }

  if (result.registros_erros > 0 && result.status !== 'error') {
    result.status = result.registros_criados + result.registros_atualizados > 0 ? 'partial' : 'error'
  }

  await finishSyncLog(db, logId, result)
  return result
}

// ─── Import: Vendas → Pedidos ───────────────────────────────────────────────

export async function syncVendas(
  client: UniplusClient, db: Sql, userId: number
): Promise<SyncResult> {
  const logId = await createSyncLog(db, 'vendas', 'import', userId)
  const result: SyncResult = {
    tipo: 'vendas', direcao: 'import', status: 'success',
    total_registros: 0, registros_criados: 0, registros_atualizados: 0,
    registros_erros: 0, erros: [],
  }

  try {
    const vendas = await client.getVendas()
    result.total_registros = vendas.length

    for (const v of vendas) {
      try {
        const codigo = String(v.idVenda)
        const valorTotal = parseFloat(v.valorTotal) || 0
        const documento = v.documento || ''

        // Find cliente by UniPlus code
        let clienteId: number | null = null
        if (v.codigoCliente) {
          const [cli] = await db`SELECT id FROM clientes WHERE uniplus_id = ${v.codigoCliente}`
          if (cli) clienteId = cli.id
        }

        // Find vendedor
        let vendedorId: number | null = null
        if (v.nomeVendedor) {
          const [vend] = await db`SELECT id FROM usuarios WHERE nome ILIKE ${v.nomeVendedor} LIMIT 1`
          if (vend) vendedorId = vend.id
        }
        if (!vendedorId) {
          const [admin] = await db`SELECT id FROM usuarios WHERE tipo = 'admin' AND ativo = true LIMIT 1`
          if (admin) vendedorId = admin.id
        }

        const [existing] = await db`
          SELECT id FROM pedidos WHERE uniplus_id = ${codigo}
        `

        // Map UniPlus status to Trends
        const statusMap: Record<number, string> = { 1: 'pendente', 2: 'em_producao', 3: 'concluido', 4: 'cancelado' }
        const status = statusMap[v.status] || 'pendente'

        if (existing) {
          await db`
            UPDATE pedidos SET
              valor_total = ${valorTotal},
              status = ${status},
              cliente_id = ${clienteId},
              cliente_nome = ${v.nomeCliente || null},
              origem = 'uniplus',
              uniplus_updated_at = NOW(),
              updated_at = NOW()
            WHERE id = ${existing.id}
          `
          result.registros_atualizados++
        } else {
          const numero = `UP-${documento || codigo}`
          const emissao = v.emissao || null
          await db`
            INSERT INTO pedidos (numero, cliente_id, cliente_nome, vendedor_id, status, valor_total, data_entrega, origem, uniplus_id, uniplus_updated_at)
            VALUES (${numero}, ${clienteId}, ${v.nomeCliente || null}, ${vendedorId}, ${status}, ${valorTotal}, ${emissao}, 'uniplus', ${codigo}, NOW())
          `
          result.registros_criados++
        }
      } catch (err) {
        result.erros.push({ codigo: String(v.idVenda), mensagem: err instanceof Error ? err.message : 'Erro desconhecido' })
        result.registros_erros++
      }
    }
  } catch (err) {
    result.status = 'error'
    result.erros.push({ codigo: '', mensagem: err instanceof Error ? err.message : 'Erro ao buscar vendas' })
  }

  if (result.registros_erros > 0 && result.status !== 'error') {
    result.status = result.registros_criados + result.registros_atualizados > 0 ? 'partial' : 'error'
  }

  await finishSyncLog(db, logId, result)
  return result
}

// ─── Full Sync ──────────────────────────────────────────────────────────────

export async function syncFull(
  client: UniplusClient, db: Sql, userId: number
): Promise<SyncResult> {
  const logId = await createSyncLog(db, 'full', 'import', userId)
  const results: SyncResult[] = []

  try {
    // Order matters: vendedores first (for FK references in clientes)
    results.push(await syncVendedores(client, db, userId))
    results.push(await syncClientes(client, db, userId))
    results.push(await syncProdutos(client, db, userId))
    results.push(await syncCondicoesPagamento(client, db, userId))
    results.push(await syncVendas(client, db, userId))

    // Update last_sync_at
    await db`UPDATE uniplus_config SET last_sync_at = NOW(), updated_at = NOW() WHERE ativo = true`
  } catch (err) {
    // Already logged in individual syncs
  }

  // Aggregate results
  const aggregated: SyncResult = {
    tipo: 'full',
    direcao: 'import',
    status: 'success',
    total_registros: results.reduce((s, r) => s + r.total_registros, 0),
    registros_criados: results.reduce((s, r) => s + r.registros_criados, 0),
    registros_atualizados: results.reduce((s, r) => s + r.registros_atualizados, 0),
    registros_erros: results.reduce((s, r) => s + r.registros_erros, 0),
    erros: results.flatMap(r => r.erros),
  }

  if (results.some(r => r.status === 'error')) {
    aggregated.status = results.every(r => r.status === 'error') ? 'error' : 'partial'
  } else if (aggregated.registros_erros > 0) {
    aggregated.status = 'partial'
  }

  await finishSyncLog(db, logId, aggregated)
  return aggregated
}

// ─── Export: Cliente → UniPlus ───────────────────────────────────────────────

export async function exportCliente(
  client: UniplusClient, db: Sql, clienteId: number
): Promise<SyncResult> {
  const result: SyncResult = {
    tipo: 'clientes', direcao: 'export', status: 'success',
    total_registros: 1, registros_criados: 0, registros_atualizados: 0,
    registros_erros: 0, erros: [],
  }

  try {
    const [cli] = await db`SELECT * FROM clientes WHERE id = ${clienteId}`
    if (!cli) throw new Error('Cliente não encontrado')

    const entidade: Partial<UniplusEntidade> = {
      nome: cli.razao_social,
      razaoSocial: cli.razao_social,
      cnpjCpf: cli.cnpj,
      email: cli.email || '',
      telefone: cli.telefone || '',
      celular: cli.celular || '',
      endereco: cli.endereco || '',
      bairro: cli.bairro || '',
      cep: cli.cep || '',
      cidade: cli.cidade || '',
      estado: cli.estado || '',
      tipo: '1',
      tipoPessoa: (cli.cnpj || '').replace(/\D/g, '').length > 11 ? 'J' : 'F',
    }

    if (cli.uniplus_id) {
      entidade.codigo = cli.uniplus_id
      await client.updateEntidade(entidade)
      result.registros_atualizados = 1
    } else {
      const created = await client.createEntidade(entidade)
      if (created?.codigo) {
        await db`UPDATE clientes SET uniplus_id = ${created.codigo}, uniplus_updated_at = NOW() WHERE id = ${clienteId}`
      }
      result.registros_criados = 1
    }
  } catch (err) {
    result.status = 'error'
    result.registros_erros = 1
    result.erros.push({ codigo: String(clienteId), mensagem: err instanceof Error ? err.message : 'Erro ao exportar' })
  }

  return result
}

// ─── Export: Orçamento → UniPlus (como DAV) ─────────────────────────────────

export async function exportOrcamento(
  client: UniplusClient, db: Sql, orcamentoId: number
): Promise<SyncResult> {
  const result: SyncResult = {
    tipo: 'clientes', direcao: 'export', status: 'success',
    total_registros: 1, registros_criados: 0, registros_atualizados: 0,
    registros_erros: 0, erros: [],
  }

  try {
    const [orc] = await db`
      SELECT o.*, c.uniplus_id as cliente_uniplus_id
      FROM orcamentos o
      LEFT JOIN clientes c ON o.cliente_id = c.id
      WHERE o.id = ${orcamentoId}
    `
    if (!orc) throw new Error('Orçamento não encontrado')

    const dav = {
      tipoDocumento: 2,  // orçamento
      codigoCliente: orc.cliente_uniplus_id || '',
      valorTotal: orc.valor_total || 0,
      observacao: orc.observacoes || `Orçamento ${orc.numero} - Trends`,
    }

    if (orc.uniplus_id) {
      await client.put(`/public-api/v1/davs`, { ...dav, codigo: orc.uniplus_id })
      result.registros_atualizados = 1
    } else {
      const created = await client.post<{ codigo?: string }>('/public-api/v1/davs', dav)
      if (created?.codigo) {
        await db`UPDATE orcamentos SET uniplus_id = ${created.codigo}, uniplus_updated_at = NOW() WHERE id = ${orcamentoId}`
      }
      result.registros_criados = 1
    }
  } catch (err) {
    result.status = 'error'
    result.registros_erros = 1
    result.erros.push({ codigo: String(orcamentoId), mensagem: err instanceof Error ? err.message : 'Erro ao exportar' })
  }

  return result
}
