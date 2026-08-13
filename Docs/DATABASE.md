# Database — Trends

> Última revisão: 2026-08-13, contra o banco de produção (Neon). Volumes registrados nesta data — vão ficar desatualizados; o schema (colunas/FKs) é o que importa manter correto aqui.
>
> Convenção do projeto: **sem ORM**. Este documento é a fonte de verdade textual do schema — o schema real vive nas migrations em `migrations/*.sql`, aplicadas em ordem numérica (ver README).

## Visão geral (volumes em 2026-08-13)

| Tabela | Registros | Observação |
|---|---|---|
| `pedidos` | 38.305 | 24.817 origem `uniplus` + 13.488 origem `importacao` |
| `clientes` | 8.740 | 6.261+ vindos do UniPlus |
| `tipos_papel` | 6.289 | 6.261 vindos do UniPlus (produtos), resto cadastro manual |
| `usuarios` | 29 | 5 `admin`, 24 `vendedor` |
| `condicoes_pagamento` | 100 | via sync UniPlus |
| `orcamentos` | 5 | 4 `rascunho`, 1 `aprovado`, 0 `convertido` — uso real ainda é baixo |
| `itens_orcamento` | 5 | |
| `usuario_permissoes` | 50 | |
| `uniplus_sync_log` | 1 | ver `Docs/BUGS.md` — o log não reflete a sync real feita via scripts |

## Domínio: Usuários e permissões

### `usuarios`
Vendedores e admins do sistema. Também recebe vendedores importados do UniPlus (entidades tipo=4).

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | serial PK | |
| `nome`, `email` (UNIQUE) | varchar | |
| `senha_hash` | varchar, nullable | `NULL` ou `'UNIPLUS_NO_LOGIN'` para contas criadas via sync — não conseguem logar por credentials até admin setar senha |
| `tipo` | varchar | `'admin' \| 'operador' \| 'vendedor'` (`UserTipo` em `types/index.ts`) |
| `ativo` | boolean | `false` = pendente de aprovação (fluxo Google OAuth) |
| `google_id` (UNIQUE), `avatar_url` | | login Google |
| `aprovado_por` → `usuarios.id`, `aprovado_em` | | quem/quando aprovou o cadastro pendente |
| `tabela_margem_id` → `tabelas_margem.id` | | tabela de margem usada nos orçamentos desse vendedor |
| `uniplus_id` (UNIQUE parcial, `WHERE NOT NULL`), `uniplus_updated_at` | | mapeamento com entidade tipo=4 do UniPlus |

### `usuario_permissoes`
Permissão granular por feature. `UNIQUE(usuario_id, feature)`.

| Coluna | Tipo | Notas |
|---|---|---|
| `usuario_id` → `usuarios.id` | | `ON DELETE CASCADE` |
| `feature` | varchar | um de `ALL_FEATURES` (`types/index.ts`): `dashboard, clientes, orcamentos, pedidos, vendas, materiais, tabelas_margem, condicoes_pagamento, usuarios, uniplus` |
| `habilitado` | boolean | |

Populada com os defaults de `DEFAULT_PERMISSIONS[tipo]` no primeiro login. **Só é lida no server-side de páginas (`requireFeature`) — a maioria das API routes não checa essa tabela.** Ver `Docs/BUGS.md`.

## Domínio: Clientes

### `clientes`
Sempre pessoa jurídica (CNPJ), vinculado a um vendedor.

| Coluna | Tipo | Notas |
|---|---|---|
| `razao_social` | varchar NOT NULL | |
| `cnpj` | varchar, nullable, **sem UNIQUE** | migration 011/012 tornou nullable e removeu o UNIQUE (CNPJs duplicados existem — clientes com filiais/mesmo CNPJ em registros distintos do UniPlus) |
| `email`, `telefone`, `celular`, `endereco`, `bairro`, `cep`, `cidade`, `estado` | | `celular/cep/bairro` adicionados na migration 009 (UniPlus) |
| `vendedor_id` → `usuarios.id` | nullable | só 28% dos clientes tem isso preenchido hoje — ver `Docs/BUGS.md` |
| `ativo` | boolean | invertido do `inativo` do UniPlus na sync |
| `uniplus_id` (UNIQUE parcial), `uniplus_updated_at` | | |

Índices: `idx_clientes_vendedor`, `idx_clientes_cnpj` (não-único), `idx_clientes_uniplus_id` (único, parcial).

## Domínio: Catálogo / precificação

### `tipos_papel`
Catálogo de papel — o "produto" do sistema. Populado majoritariamente pela sync UniPlus (`/v1/produtos`).

| Coluna | Notas |
|---|---|
| `preco_m2` NOT NULL | preço usado no motor de precificação (`lib/pricing.ts`) |
| `pago, icms, ipi, frete, total, data_compra` | detalhamento de custo — usados por `fornecedores_papel` também; parcialmente redundante entre as duas tabelas |
| `nome_simplificado`, `preco_m2_medio` | |
| `uniplus_id` (UNIQUE parcial), `uniplus_updated_at` | |

### `fornecedores_papel`
Múltiplos fornecedores por `tipo_papel_id`, cada um com seu próprio `preco_m2` — permite comparar preço médio de compra.

### `facas`
Ferramentas de corte — define `largura_mm`, `altura_mm`, `colunas`, `largura_papel_mm`, `velocidade_multiplicador` e `percentual_adicional` usados como input direto do motor de precificação.

`numero_dentes` (Z) e `tipo_engrenagem` (migration 014) são opcionais — quando preenchidos, o sistema calcula o **espaçamento real** entre etiquetas daquela faca (em vez do valor fixo de 3mm), usando a fórmula de `lib/porta-cliche.ts`. Só `tipo_engrenagem = '1/8CP'` tem a fórmula confirmada hoje; `M1` e `HELICOIDAL_20_M1` existem no schema mas a pricing engine ignora e cai no fallback de 3mm até serem confirmadas (ver `Docs/BUGS.md`).

### `cores_pantone`
`codigo` (UNIQUE), `custo_m2` (default 0.30), `percentual_hora_separacao` — custo extra quando o item do orçamento usa `cor_tipo = 'pantone'`.

### `tubetes`
`diametro_mm` (UNIQUE), `custo_unidade` — custo fixo por rolo.

### `acabamentos`
`percentual_adicional` — cada acabamento selecionado soma um % sobre o custo total do item.

### `tabelas_margem` + `faixas_margem`
Margem configurável por vendedor (`usuarios.tabela_margem_id`), com faixas por **quantidade de rolos**:

```
faixas_margem: tabela_margem_id, min_rolos, max_rolos (nullable = sem teto), percentual
```

### `condicoes_pagamento`
`nome`, `uniplus_id` (UNIQUE parcial) — sincronizada de `/v1/commons/condicaopagamento`.

## Domínio: Orçamentos e pedidos

### `orcamentos`
| Coluna | Notas |
|---|---|
| `numero` (UNIQUE) | formato `ORC-YYYY-NNNN` (sequence `orcamento_seq`, criada on-demand se não existir) |
| `cliente_id`, `vendedor_id` | FK |
| `tipo_margem` | `'vendedor' \| 'revenda'` — usado só pelo motor **legacy** (`calcularItemLegacy`); o motor atual usa `faixas_margem` |
| `status` | `'rascunho' \| 'enviado' \| 'aprovado' \| 'convertido'` |
| `condicao_pagamento_id` → `condicoes_pagamento.id` | |
| `frete_tipo, frete_valor, frete_percentual` | |
| `uniplus_id` (UNIQUE parcial) | export Trends→UniPlus (DAV) — **nunca usado em produção, sempre NULL hoje** |

### `itens_orcamento`
Linhas de um orçamento. `orcamento_id` → `orcamentos.id` (`ON DELETE CASCADE` implícito via app, não confirmado no SQL — checar migration se for depender disso).

| Coluna | Notas |
|---|---|
| `largura_mm`, `altura_mm` | **sem** os +3mm de espaçamento — calculado em runtime |
| `colunas`, `quantidade` | |
| `tipo_produto` | default `'etiqueta'` |
| `faca_id`, `cor_tipo` (`'branca'\|'pantone'`), `cor_pantone_id`, `tubete_id`, `acabamentos_ids` (array de ids) | inputs do motor de precificação atual |
| `quantidade_por_rolo`, `quantidade_rolos`, `metragem_linear` | resultado do cálculo, persistido |

### `historico_frete`
`cliente_id`, `valor`, `data`, `orcamento_id` (nullable) — histórico de frete cobrado por cliente, usado para sugerir `frete_percentual` em orçamentos futuros.

### `pedidos`
Tabela mais carregada e com **três origens de dados distintas** misturadas na mesma tabela — ver `origem`:

| Coluna | Notas |
|---|---|
| `numero` (UNIQUE) | `PED-YYYY-NNNN` (sistema) ou `UP-<idVenda>` (UniPlus) |
| `orcamento_id`, `cliente_id`, `vendedor_id` | FK, nullable |
| `status` | valores variam por origem — ver `Docs/REGRAS_NEGOCIO.md` |
| **`origem`** | `'sistema'` (convertido de orçamento — **0 registros hoje**), `'uniplus'` (venda importada do ERP), `'importacao'` (planilha Excel histórica) |
| `uniplus_id` (UNIQUE parcial), `uniplus_cliente_codigo`, `uniplus_updated_at` | mapeamento com `/v2/venda` |
| `cliente_nome` | nome cru vindo do UniPlus/Excel, usado como fallback quando `cliente_id` não foi resolvido |
| `ordem_fabricacao`, `material`, `codigo_faca`, `etiqueta_dimensao`, `quantidade`, `produzido_por`, `tipo_producao`, `ordem_compra`, `data_producao`, `mes_referencia` | **campos exclusivos de `origem='importacao'`** (produção histórica da planilha Excel) — ficam `NULL` para pedidos `'uniplus'`/`'sistema'` |
| `data_entrega` | preenchida para pedidos `'uniplus'` (data de emissão da venda) |

Índices relevantes: `idx_pedidos_origem`, `idx_pedidos_status`, `idx_pedidos_mes_referencia`, `idx_pedidos_tipo_producao`, `idx_pedidos_material`, `idx_pedidos_cliente_nome`, `idx_pedidos_uniplus_cliente_codigo` (parcial).

## Domínio: Integração UniPlus

### `uniplus_config`
Linha única (`ativo=true`) com credenciais de conexão ao Yoda: `server_url`, `auth_code` (Basic auth do OAuth), `user_id`/`user_password` (defaults `'24'`/`'9637'` — headers extras exigidos por alguns endpoints da API UniPlus), `last_sync_at`.

### `uniplus_sync_log`
Histórico de sincronizações disparadas pela UI (`tipo`: `clientes|produtos|condicoes_pagamento|vendedores|vendas|full`, `direcao`: `import|export`, `status`: `running|success|error|partial`, contadores + `erros` jsonb). **Hoje só tem 1 registro e não reflete a sync real** (feita via `scripts/uniplus-full-sync.mjs` fora da UI) — ver `Docs/BUGS.md`.

## Diagrama de relacionamentos (FKs)

```
usuarios ←── clientes.vendedor_id
usuarios ←── orcamentos.vendedor_id
usuarios ←── pedidos.vendedor_id
usuarios ←── usuario_permissoes.usuario_id
usuarios ←── usuarios.aprovado_por (auto-referência)
usuarios ←── uniplus_sync_log.iniciado_por
usuarios.tabela_margem_id ──→ tabelas_margem

clientes ←── orcamentos.cliente_id
clientes ←── pedidos.cliente_id
clientes ←── historico_frete.cliente_id

orcamentos ←── itens_orcamento.orcamento_id
orcamentos ←── pedidos.orcamento_id
orcamentos ←── historico_frete.orcamento_id
orcamentos.condicao_pagamento_id ──→ condicoes_pagamento

tipos_papel ←── itens_orcamento.tipo_papel_id
tipos_papel ←── fornecedores_papel.tipo_papel_id

tabelas_margem ←── faixas_margem.tabela_margem_id

facas ←── itens_orcamento.faca_id
cores_pantone ←── itens_orcamento.cor_pantone_id
tubetes ←── itens_orcamento.tubete_id
```

## Migrations

Numeradas sequencialmente em `migrations/`, aplicadas com `scripts/run-migration.mjs` (ver README). Note que existem **duas migrations `013`** no histórico (`013_pedidos_cliente_codigo.sql` e `013_rbac_permissoes.sql`) — ambas já aplicadas em produção, mas a numeração colidiu; `014` já foi usada (`014_facas_porta_cliche.sql`), a próxima é `015`.
