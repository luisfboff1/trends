# Plan: Integração Bidirecional UniPlus ERP — Fase 2

## TL;DR
Integrar o sistema Trends com o UniPlus ERP (Intelidata) via API REST local (Yoda server, porta 8443). Sincronização **bidirecional** e **manual** (botão na interface): importar clientes, produtos, condições de pagamento e vendas do UniPlus → Trends, e exportar orçamentos/pedidos do Trends → UniPlus. Sem polling automático — o admin dispara a sincronização quando quiser.

## Decisões Confirmadas
- **Ambiente**: Desktop (Yoda server local, porta 8443, certificado self-signed) — **CONFIRMAR NA VISITA se têm UniPlus Web também**
- **Auth code fixo**: `dW5pcGx1czpsNGd0cjFjazJyc3ByM25nY2wzZW50` (Base64 de "uniplus:l4gtr1ck2rspr3ngcl3ent")
- **Direção**: Bidirecional (UniPlus ↔ Trends)
- **Dados**: Tudo junto (clientes, produtos/papéis, condições de pagamento, vendas)
- **Frequência**: Manual (botão na interface, sem cron/polling)
- **Fonte de verdade**: UniPlus para dados compartilhados (clientes, produtos); Trends para orçamentos/cotações

---

## ⚠️ DECISÃO CRÍTICA DE ARQUITETURA: Desktop vs Cloud

### O Problema

O **Trends** roda na **Vercel** (cloud, internet pública). O **UniPlus Desktop/Yoda** roda no **PC local** da empresa (rede interna, IP tipo `192.168.x.x`). O Yoda **é** a API — os dados moram nele. **Toda vez** que clicar sync, o Trends precisa acessar o Yoda para buscar/enviar dados. Um servidor na Vercel **NÃO consegue** acessar `https://192.168.x.x:8443` — é rede privada, sem rota pela internet.

Isso não é configuração única. É comunicação ativa a cada sincronização: gerar token (60 min) + buscar dados + enviar dados.

### Hipótese A: Eles têm (ou podem ter) UniPlus Web

Se a Trends usar o **UniPlus Web** (versão cloud da Intelidata, hospedado na GetTI/Amazon), aí teria uma URL pública tipo `https://getcard.intelidata.inf.br` acessível de qualquer lugar. **Nesse caso o problema desaparece** — a Vercel acessa diretamente, sem nenhuma infra extra.

→ **PERGUNTAR NA VISITA**: "Vocês têm UniPlus Web ou só Desktop?"

### Hipótese B: Só Desktop — Precisa de Sync Agent Local

Se for só Desktop, a solução recomendada é um **sync agent**: um script Node.js rodando no PC da Trends Solutions (na mesma rede que o Yoda) que faz a ponte:

```
[PC local] Sync Agent → acessa Yoda (localhost:8443) → escreve direto no Neon PostgreSQL (cloud)
                                                        ↓
[Cloud] Trends App (Vercel) → lê do Neon PostgreSQL ← dados já sincronizados
```

**Vantagens**:
- Simples, seguro, sem exposição de portas à internet
- Usa a mesma connection string do Neon que o Trends já usa
- O admin dispara a sync pela interface do Trends, que notifica o agent

**Alternativas** (menos recomendadas):

| Opção | Como funciona | Problema |
|-------|--------------|----------|
| **Cloudflare Tunnel** | Instalar `cloudflared` no PC, expõe Yoda na internet | Dependência externa, latência, segurança |
| **Sync via browser** | Admin na mesma rede Wi-Fi, browser chama Yoda local e repassa | CORS, lento, precisa estar na rede |
| **VPN** | Túnel entre Vercel e rede local | Complexo, custo, Vercel serverless não suporta VPN |

### Perguntas para a Visita Presencial

- [ ] **Têm UniPlus Web ou só Desktop?** ← define toda a arquitetura
- [ ] Se só Desktop: **tem um PC que fica ligado o dia todo?** (para rodar o sync agent)
- [ ] Se só Desktop: **esse PC tem acesso à internet?** (para conectar ao Neon PostgreSQL)
- [ ] **Têm interesse em migrar para UniPlus Web?** (resolve o problema de vez)
- [ ] **O Yoda já está habilitado e rodando?** ou precisa ativar?

## Documentação Relacionada
- [Guia de Configuração Presencial](./GUIA_CONFIGURACAO_UNIPLUS.md) — Passo a passo para configurar no local
- [Referência API UniPlus](./uniplus_api_integration%20(1).md) — Documentação de endpoints e exemplos

## Documentação Oficial UniPlus API
- [API Uniplus – Comece por aqui](https://kb.beemore.com/dc/pt-br/domains/suporte/documents/api-uniplus-comece-por-aqui)
- [Endpoints Individuais](https://kb.beemore.com/dc/pt-br/domains/suporte/documents/endpoints-individuais-api)
- [Endpoints Agrupados](https://kb.beemore.com/dc/pt-br/domains/suporte/documents/endpoints-agrupados-api)
- [API Commons](https://kb.beemore.com/dc/pt-br/domains/suporte/documents/endpoints-agrupados-api-commons)
- [API Vendas](https://kb.beemore.com/dc/pt-br/domains/suporte/documents/api-vendas)
- [Testando Comunicação via API](https://kb.beemore.com/dc/pt-br/domains/suporte/documents/testando-comunicacao-via-api)

---

## Mapeamento de Entidades: UniPlus → Trends

### 1. Clientes (entidades tipo=1)
| UniPlus (`/v1/entidades`) | Trends (`clientes`) | Notas |
|---|---|---|
| codigo | **uniplus_id** (NOVO) | Chave de mapeamento |
| nome | razao_social | |
| cnpjCpf | cnpj | |
| email | email | |
| telefone | telefone | |
| celular | — | Não existe no Trends (pode adicionar) |
| endereco + bairro | endereco | Concatenar |
| cep | — | Não existe no Trends (pode adicionar) |
| cidade | cidade | UniPlus retorna código — precisa lookup em `/v1/commons/cidade` |
| estado | estado | UniPlus retorna código — precisa lookup em `/v1/commons/estado` |
| codigoVendedor | vendedor_id | Precisa lookup: encontrar usuario com uniplus_id matching |
| inativo | ativo | Inverter (inativo=true → ativo=false) |
| tipoPessoa | — | J=Jurídica, F=Física (Trends assume CNPJ) |

### 2. Produtos → Tipos de Papel
| UniPlus (`/v1/produtos`) | Trends (`tipos_papel`) | Notas |
|---|---|---|
| codigo | **uniplus_id** (NOVO) | |
| nome | nome | |
| descricao | descricao | |
| preco | preco_m2 | ⚠️ Verificar se é preço por m² ou unitário |
| custo | — | Pode mapear para fornecedores_papel |
| unidadeMedida | — | Referência |
| ncm | — | Não existe no Trends |

### 3. Condições de Pagamento
| UniPlus (`/v1/commons/condicaopagamento`) | Trends (`condicoes_pagamento`) | Notas |
|---|---|---|
| id | **uniplus_id** (NOVO) | |
| nome/descricao | nome, descricao | |

### 4. Vendas → Pedidos
| UniPlus (`/v2/venda`) | Trends (`pedidos`) | Notas |
|---|---|---|
| idVenda | **uniplus_id** (NOVO) | |
| codigoCliente | cliente_id | Lookup via uniplus_id |
| nomeCliente | — | Redundante |
| emissao | created_at | |
| valorTotal | valor_total | |
| status | status | Mapear status UniPlus → Trends |

### 5. Vendedores (entidades tipo=4) → Usuários
| UniPlus (`/v1/entidades?tipo.eq=4`) | Trends (`usuarios`) | Notas |
|---|---|---|
| codigo | **uniplus_id** (NOVO) | |
| nome | nome | |
| email | email | |

---

## Steps

### Fase A: Infraestrutura (Steps 1-3)

#### Step 1: Migração 009 — Colunas de sincronização UniPlus
*Sem dependências*

Criar `migrations/009_uniplus_sync.sql`:

**Alterações em tabelas existentes** — adicionar `uniplus_id VARCHAR(50)` + `uniplus_updated_at TIMESTAMPTZ` em:
- `clientes` (+ adicionar `celular VARCHAR(20)`, `cep VARCHAR(10)`, `bairro VARCHAR(100)`)
- `tipos_papel`
- `condicoes_pagamento`
- `pedidos`
- `usuarios`
- `orcamentos`

**Nova tabela `uniplus_config`:**
- id SERIAL PK
- server_url VARCHAR(500) NOT NULL — ex: "https://192.168.1.100:8443"
- auth_code VARCHAR(500) NOT NULL — código Base64 para Basic auth
- conta VARCHAR(100) — identificador da conta (opcional para desktop)
- ativo BOOLEAN DEFAULT true
- last_sync_at TIMESTAMPTZ
- created_at, updated_at TIMESTAMPTZ

**Nova tabela `uniplus_sync_log`:**
- id SERIAL PK
- tipo VARCHAR(50) NOT NULL — 'clientes' | 'produtos' | 'condicoes_pagamento' | 'vendas' | 'vendedores' | 'full'
- direcao VARCHAR(10) NOT NULL — 'import' | 'export'
- status VARCHAR(20) NOT NULL — 'running' | 'success' | 'error' | 'partial'
- total_registros INTEGER DEFAULT 0
- registros_criados INTEGER DEFAULT 0
- registros_atualizados INTEGER DEFAULT 0
- registros_erros INTEGER DEFAULT 0
- erros JSONB — detalhes dos erros
- iniciado_por INTEGER REFERENCES usuarios(id)
- started_at TIMESTAMPTZ DEFAULT NOW()
- finished_at TIMESTAMPTZ

**Indexes**: UNIQUE em `uniplus_id` para clientes, tipos_papel, condicoes_pagamento, pedidos, usuarios, orcamentos (onde NOT NULL)

#### Step 2: Tipos TypeScript + Validações UniPlus
*Depende de Step 1*

**`types/uniplus.ts`** — Novos tipos:
- `UniplusConfig` — configuração de conexão
- `UniplusSyncLog` — registro de sincronização
- `UniplusToken` — {access_token, token_type, expires_in, obtained_at}
- `UniplusEntidade` — tipo da API (codigo, nome, cnpjCpf, tipo, email, telefone, celular, endereco, bairro, cep, cidade, estado, codigoVendedor, inativo, tipoPessoa)
- `UniplusProduto` — (codigo, nome, descricao, preco, custo, ean, ncm, unidadeMedida, ativo)
- `UniplusCondicaoPagamento` — (id, nome, descricao)
- `UniplusVenda` — (idVenda, codigoCliente, nomeCliente, emissao, valorTotal, status)
- `UniplusVendaItem` — (idVenda, codigoProduto, descricaoProduto, quantidade, valorUnitario, valorTotal)
- `UniplusDav` — (codigo, tipoDocumento, cliente, vendedor, data, valor, itens[], condicaoPagamento, status)
- `SyncDirection` — 'import' | 'export'
- `SyncStatus` — 'running' | 'success' | 'error' | 'partial'

**`lib/validations/uniplus.ts`** — Zod schemas para validar config (server_url, auth_code)

#### Step 3: Cliente HTTP UniPlus
*Depende de Step 2*

**`lib/uniplus-client.ts`** — Classe `UniplusClient`:
- Constructor recebe `{serverUrl, authCode}`
- **Token management**: `getToken()` → POST `/oauth/token` com Basic auth, cache token em memória, auto-refresh quando expirado (expires_in - 60s buffer)
- **SSL**: Usar `https.Agent({ rejectUnauthorized: false })` para certificado self-signed do Yoda (⚠️ apenas para o servidor UniPlus local configurado)
- **Métodos genéricos**:
  - `get<T>(path, params?)` — GET com paginação automática (busca todas as páginas se `fetchAll=true`, limit=100 por request)
  - `post<T>(path, body)` — POST
  - `put<T>(path, body)` — PUT
  - `delete(path, codigo)` — DELETE
- **Métodos específicos**:
  - `getEntidades(tipo?: number)` — `/v1/entidades?tipo.eq={tipo}`
  - `getEntidade(codigo)` — `/v1/entidades/{codigo}`
  - `createEntidade(data)` — POST `/v1/entidades`
  - `updateEntidade(data)` — PUT `/v1/entidades`
  - `getProdutos()` — `/v1/produtos`
  - `getCondicoesPagamento()` — `/v1/commons/condicaopagamento`
  - `getVendas(desde?: Date)` — `/v2/venda?emissao.ge={date}`
  - `getVendaItens(desde?: Date)` — `/v2/venda-item?emissao.ge={date}`
  - `getDavs(tipo?: number)` — `/v1/davs?tipoDocumento.eq={tipo}`
  - `createDav(data)` — POST `/v1/davs`
  - `testConnection()` — tenta autenticar e retorna true/false

**Padrão de referência**: Usar `services/api.ts` como template de estilo (Axios), mas para server-side com `axios` diretamente + https agent customizado.

---

### Fase B: Importação UniPlus → Trends (Steps 4-6)

#### Step 4: Serviço de Sincronização (Import)
*Depende de Step 3*

**`lib/uniplus-sync.ts`** — Funções de sync:

- `syncClientes(client, db, userId)`:
  1. Buscar todas entidades tipo=1 (clientes) do UniPlus com paginação
  2. Buscar lookup tables: `/v1/commons/cidade`, `/v1/commons/estado` (para resolver códigos → nomes)
  3. Para cada entidade: verificar se existe `clientes.uniplus_id = codigo`
     - Se não existe: INSERT novo cliente
     - Se existe: UPDATE campos (razao_social, cnpj, email, telefone, celular, endereco, bairro, cep, cidade, estado, ativo)
  4. Retornar contagem {criados, atualizados, erros}

- `syncProdutos(client, db, userId)`:
  1. Buscar todos produtos do UniPlus
  2. Para cada: verificar `tipos_papel.uniplus_id = codigo`
     - Se não existe: INSERT como tipo_papel (nome, preco)
     - Se existe: UPDATE
  3. Retornar contagem

- `syncCondicoesPagamento(client, db, userId)`:
  1. Buscar `/v1/commons/condicaopagamento`
  2. Upsert por uniplus_id na tabela `condicoes_pagamento`

- `syncVendedores(client, db, userId)`:
  1. Buscar entidades tipo=4 (vendedores)
  2. Upsert em `usuarios` por uniplus_id (apenas nome/email, tipo='vendedor')

- `syncVendas(client, db, userId)`:
  1. Buscar vendas (opcionalmente filtrando por data)
  2. Upsert em `pedidos` por uniplus_id

- `syncFull(client, db, userId)`:
  1. Executar na ordem: vendedores → clientes → produtos → condições → vendas
  2. Registrar em `uniplus_sync_log`
  3. Atualizar `uniplus_config.last_sync_at`

**Gestão de erros**: Se um registro falha, logar e continuar (não abortar a sync inteira). Acumular erros no JSONB.

#### Step 5: API Routes UniPlus
*Depende de Step 4*

**`pages/api/uniplus/config.ts`**:
- GET — retorna config atual (server_url, conta, last_sync_at) — SEM auth_code no response
- POST — salvar/atualizar config (server_url, auth_code, conta) — somente admin
- POST com `?test=true` — testar conexão sem salvar

**`pages/api/uniplus/sync.ts`**:
- POST `{ tipo: 'full' | 'clientes' | 'produtos' | 'condicoes' | 'vendedores' | 'vendas', direcao: 'import' }` — disparar sincronização
- Somente admin
- Verificar se não há sync running (evitar duplicação)
- Executar sync, retornar resultado com contagens

**`pages/api/uniplus/status.ts`**:
- GET — retorna últimos N logs de sync + status da config
- GET `?running=true` — verifica se há sync em andamento

**Middleware**: Todas as rotas usam `authMiddleware` + verificação `tipo === 'admin'`

#### Step 6: Página de Integração UniPlus (Import)
*Depende de Step 5*

**`pages/uniplus.tsx`** — Nova página acessível apenas para admin:

**Seção 1: Configuração**
- Formulário: Server URL, Auth Code (password input), Conta (opcional)
- Botão "Testar Conexão" — chama POST config?test=true
- Botão "Salvar" — chama POST config
- Indicador de status: conectado/desconectado, último sync

**Seção 2: Sincronização**
- Cards por tipo de dado (Clientes, Produtos, Condições de Pagamento, Vendedores, Vendas)
- Cada card mostra: última sync, total importado
- Botão "Sincronizar Tudo" (chama sync tipo=full)
- Botão individual por tipo de dado
- Loading state durante sync
- Resultado: tabela com criados/atualizados/erros

**Seção 3: Histórico de Sincronização**
- Tabela com últimas sincronizações (data, tipo, direção, status, contagens)
- Expandir para ver erros detalhados

**Componentes**: Reutilizar `Card`, `Button`, `Table`, `Badge` do shadcn/ui existente

**Sidebar**: Adicionar link "UniPlus" no sidebar (ícone de sync/refresh) — visível apenas para admin

---

### Fase C: Exportação Trends → UniPlus (Steps 7-8)

#### Step 7: Serviço de Export
*Depende de Step 4*

**Adicionar em `lib/uniplus-sync.ts`**:

- `exportCliente(client, db, clienteId)`:
  1. Buscar cliente do Trends por id
  2. Se tem `uniplus_id` → PUT `/v1/entidades` (atualizar)
  3. Se não tem → POST `/v1/entidades` (criar, salvar uniplus_id retornado)

- `exportOrcamento(client, db, orcamentoId)`:
  1. Buscar orçamento + itens do Trends
  2. Mapear para formato DAV UniPlus (tipoDocumento=2 para orçamento)
  3. Se `uniplus_id` existe → PUT `/v1/davs`
  4. Se não → POST `/v1/davs`, salvar uniplus_id

- `exportPedido(client, db, pedidoId)`:
  1. Buscar pedido do Trends
  2. Mapear para formato DAV UniPlus (tipoDocumento=4 para pedido de venda)
  3. Upsert no UniPlus

#### Step 8: API Routes + UI de Export
*Depende de Step 7*

**`pages/api/uniplus/export.ts`**:
- POST `{ tipo: 'cliente' | 'orcamento' | 'pedido', id: number }` — exportar registro específico
- POST `{ tipo: 'clientes' | 'orcamentos', ids?: number[] }` — exportar em lote
- Somente admin

**UI**: Adicionar na página UniPlus:
- Seção 4: Exportação
- Seletor de tipo + lista de registros sem uniplus_id (não sincronizados)
- Botão "Exportar Selecionados" e "Exportar Todos Pendentes"

**Opcional (inline)**: Botão "Enviar ao UniPlus" nas páginas de clientes, orçamentos, pedidos — visível para admin

---

### Fase D: Serviço API Frontend + Polimento (Step 9)

#### Step 9: Frontend Service + Ajustes Finais
*Depende de Steps 6 e 8*

**`services/api.ts`** — Adicionar:
- `uniplusService` com métodos: getConfig, saveConfig, testConnection, sync, getStatus, getSyncLogs, exportRecord

**Atualizações nas páginas existentes**:
- Clientes: mostrar badge "UniPlus" se tem uniplus_id
- Pedidos: mostrar badge "UniPlus" se importado do UniPlus
- Tipos de Papel: badge indicando origem

---

## Arquivos Relevantes

### Criar
- `migrations/009_uniplus_sync.sql` — Migração com colunas uniplus_id + tabelas de config/log
- `types/uniplus.ts` — Tipos TypeScript para API UniPlus
- `lib/validations/uniplus.ts` — Schemas Zod para config
- `lib/uniplus-client.ts` — Cliente HTTP com token management + SSL
- `lib/uniplus-sync.ts` — Lógica de sincronização (import + export)
- `pages/api/uniplus/config.ts` — API config
- `pages/api/uniplus/sync.ts` — API sync (import)
- `pages/api/uniplus/status.ts` — API status/logs
- `pages/api/uniplus/export.ts` — API export
- `pages/uniplus.tsx` — Página de gerenciamento UniPlus

### Modificar
- `types/index.ts` — Adicionar re-exports de uniplus.ts, novos campos uniplus_id nos tipos existentes (Cliente, TipoPapel, etc)
- `services/api.ts` — Adicionar uniplusService
- `components/layout/sidebar.tsx` — Adicionar link UniPlus (admin only)
- `pages/clientes.tsx` — Badge UniPlus
- `pages/pedidos.tsx` — Badge UniPlus
- `pages/tipos-papel.tsx` — Badge UniPlus

### Referência (templates de estilo)
- `lib/db.ts` — Padrão de acesso ao banco (postgres.js, raw SQL)
- `lib/auth-middleware.ts` — Padrão de middleware de autenticação
- `lib/sanitization.ts` — Padrão de sanitização de input
- `services/api.ts` — Padrão de serviço API frontend (Axios)
- `pages/api/clientes/index.ts` — Template de API route com CRUD
- `pages/clientes.tsx` — Template de página com tabela + formulário

---

## Verificação

1. **Testar conexão**: Na página UniPlus, inserir URL do servidor Yoda + auth code, clicar "Testar Conexão" — deve retornar sucesso
2. **Import clientes**: Clicar "Sincronizar Clientes", verificar que aparecem na tabela de clientes com badge UniPlus e uniplus_id preenchido
3. **Import produtos**: Sincronizar, verificar na tabela tipos_papel
4. **Import condições pagamento**: Sincronizar, verificar na tabela condicoes_pagamento
5. **Import vendas**: Sincronizar, verificar na tabela pedidos
6. **Re-import (idempotência)**: Sincronizar novamente — deve atualizar existentes, não duplicar
7. **Export cliente**: Criar cliente no Trends, exportar ao UniPlus — verificar uniplus_id preenchido
8. **Export orçamento**: Criar orçamento no Trends, exportar como DAV ao UniPlus
9. **Histórico**: Verificar que todos os syncs aparecem no log com contagens corretas
10. **Erros**: Testar com servidor offline — deve mostrar erro amigável, não crashar
11. **Segurança**: Verificar que rotas UniPlus são acessíveis apenas por admin
12. **Build**: `pnpm build` sem erros

---

## Considerações

1. **Mapeamento cidade/estado**: UniPlus retorna códigos numéricos para cidade e estado. Precisamos buscar as tabelas commons de cidade/estado na primeira sync e cachear localmente, ou adicionar campos code no Trends. **Recomendação**: Buscar lookup tables na sync e converter.

2. **Produtos vs Tipos de Papel**: No Trends, "tipos_papel" são tipos de material (papel) com preço por m². No UniPlus, "produtos" pode incluir qualquer produto. **Recomendação**: Filtrar no import — importar apenas produtos relevantes (papéis), ou criar uma configuração de mapeamento de categorias.

3. **auth_code em produção**: O auth code fixo do Yoda é hardcoded na doc (`dW5pcGx1czpsNGd0cjFjazJyc3ByM25nY2wzZW50`). Para segurança, armazenar como env var no Doppler ao invés de no banco. **Recomendação**: Campo no banco para flexibilidade, mas com opção de usar env var `UNIPLUS_AUTH_CODE`.

4. **Rede: Trends na cloud vs UniPlus local**: Ver seção "⚠️ DECISÃO CRÍTICA DE ARQUITETURA" no topo. Se for Desktop-only, o plano muda para incluir um **sync agent local** (Node.js no PC da Trends). Se tiverem UniPlus Web, o plano funciona como está (API routes no Vercel acessam diretamente a URL pública do UniPlus Web).

5. **Impacto no plano se for Desktop-only**: O Step 3 (Cliente HTTP) e Steps 4-8 (sync/export) passam a rodar no **sync agent local** ao invés de nas API routes do Next.js. A página UniPlus (`pages/uniplus.tsx`) continua igual, mas em vez de chamar API routes que acessam o Yoda, ela chama API routes que lêem/escrevem no Neon (os dados já sincronizados pelo agent). O agent pode ser um projeto separado (`sync-agent/`) ou um script no mesmo repo.
