# Regras de Negócio — Trends

> Última revisão: 2026-08-13. Extraído do código atual (`lib/pricing.ts`, `lib/auth.ts`, APIs), não do plano original — o plano ficou defasado em vários pontos (ver notas "difere do plano" abaixo). Atualize esta página sempre que uma regra mudar; ela é o contrato entre o código e quem decide preço/fluxo.

## 1. Motor de precificação (`lib/pricing.ts`)

Existem **dois motores**. Todo orçamento novo usa o atual; o legacy só existe para não quebrar orçamentos antigos.

### 1.1 Motor atual — `calcularItem()`

Ordem do cálculo, por item de orçamento:

1. **Espaçamento automático**: `altura_total_mm = altura_mm + 3mm`.
2. **Quantidade por rolo**: se não informada, calculada para render ~40m de metragem ideal por rolo (`METRAGEM_IDEAL_MIN`).
3. **Metragem por rolo** = `(altura_total_mm / 1000) × (quantidade_por_rolo / colunas)`.
   - Aviso (não bloqueante) se isso passar de 46m (`METRAGEM_IDEAL_MAX`).
4. **Arredondamento de rolos**: `quantidade_rolos = CEIL(quantidade_desejada / quantidade_por_rolo)` — **nunca arredonda para baixo**, o cliente sempre recebe pelo menos o que pediu.
   - Aviso (não bloqueante) se `quantidade_rolos < 4` (`MINIMO_ROLOS`).
5. **m² total**: largura considera o gap de 5mm entre colunas (`ESPACAMENTO_LARGURA_MM`) — `largura_total_mm = colunas × (largura_mm + 5) − 5`.
6. **Custo material** = `m2_total × preco_m2 × 1.05` (buffer de 5% de desperdício de papel).
7. **Custo cor** (só se `cor_tipo === 'pantone'`): `m2_total × custo_m2_da_cor` **+** `custo_material × (percentual_hora_separacao / 100)`. Cor `'branca'` não soma nada.
8. **Custo tubetes** = `custo_unidade_tubete × quantidade_rolos`.
9. **Custo máquina** = `(custo_material + custo_cor) × (velocidade_multiplicador − 1)` **+** `(custo_material + custo_cor) × (percentual_adicional_faca / 100)`. Vem da faca selecionada (`facas.velocidade_multiplicador`, `facas.percentual_adicional`).
10. **Acabamentos**: cada acabamento selecionado soma `custo_total_até_aqui × (percentual_adicional / 100)` — são cumulativos (aplicados um após o outro sobre a mesma base, não compostos entre si).
11. **Margem**: busca em `faixas_margem` da `tabela_margem` do vendedor (`usuarios.tabela_margem_id`) a faixa cujo `min_rolos ≤ quantidade_rolos ≤ max_rolos` (`max_rolos IS NULL` = sem teto). Se o vendedor não tem tabela configurada, cai no fallback fixo: **vendedor = 180% (2.8x)**, **revenda = 110% (2.1x)**.
12. **Preço de venda** = `custo_total × (1 + margem_percentual / 100)`.
13. **Preço unitário** = `preco_venda / quantidade_real` (onde `quantidade_real = quantidade_rolos × quantidade_por_rolo`, ou seja, pode ser maior que o pedido pelo cliente por causa do arredondamento de rolos).

**Preço do papel usado**: `tipos_papel.preco_m2_medio` se existir, senão `tipos_papel.preco_m2` (ver `pages/api/orcamentos/[id]/calcular.ts`).

**Diferença do plano original** (`Plans/deep-hopping-engelbart.md`): o plano descrevia margem fixa (2.8x/2.1x) + desconto progressivo por quantidade. Isso foi substituído por margem configurável por tabela/faixa de rolos. A tabela de desconto progressivo (2% a 5.000un até 28% a 500.000+) **só existe no motor legacy** hoje.

### 1.1.1 Espaçamento real por faca — Z (número de dentes) e engrenagem

O espaçamento de 3mm do passo 1 acima é um **valor fixo genérico**. Cada faca física, na prática, tem um espaçamento próprio, determinado pelo número de dentes (**Z**) da engrenagem de corte. Isso vem de um sistema de produção separado ("Calcula Melhor opção Porta Clichês") que a Trends já usa há anos — reverso-projetamos a fórmula dele pra dentro do sistema (`lib/porta-cliche.ts`).

**Fórmula (confirmada nas três engrenagens, batendo 213 valores reais sem nenhum erro — Z 30–100, altura 50mm):**

```
circunferência = Z × passo
montagem = FLOOR(circunferência / altura_etiqueta_mm)   // quantas etiquetas fecham a volta
espaçamento = circunferência / montagem − altura_etiqueta_mm
```

| Engrenagem | passo (mm/dente) |
|---|---|
| `1/8CP` | 3.175 (= 1/8 polegada) |
| `M1` | π ≈ 3.14159 (módulo 1mm × π) |
| `HELICOIDAL_20_M1` | π ÷ cos(20°) ≈ 3.34322 |

`espaçamento` é classificado (limiares confirmados no bytecode da ferramenta original):

| Espaçamento | Classificação |
|---|---|
| < 2.0mm | Espaçamento pequeno (ruim, aperta demais) |
| 2.0mm – 2.5mm | ACEITÁVEL |
| 2.5mm – 4.0mm | BOM |
| ≥ 4.0mm | Espaçamento grande (ruim, folga demais) |

Cada `faca` pode ter `numero_dentes` (Z) e `tipo_engrenagem` cadastrados (migration 014). Quando os dois estão preenchidos, `pages/api/orcamentos/[id]/calcular.ts` usa o espaçamento real calculado em vez do 3mm fixo. Facas sem Z cadastrado continuam usando o fallback de 3mm.

O cadastro de faca (`/materiais`, aba Facas) tem uma calculadora embutida que reproduz a tela original: informa a altura da etiqueta e a engrenagem, mostra a lista de Z possíveis com Montagem/Espaçamento/Qualidade, e o usuário escolhe direto.

### 1.2 Motor legacy — `calcularItemLegacy()`

Usado apenas para reabrir/recalcular orçamentos antigos que não tinham `faixas_margem`. Fórmula: `preco_por_mil = custo_por_mil × margem_fator × (1 − desconto_pct)`, onde `margem_fator` é 2.8 (vendedor) ou 2.1 (revenda) e `desconto_pct` vem da tabela fixa de desconto por quantidade (`DESCONTO_TABLE`). **Não usa tabela de margem nem quantidade de rolos.**

## 2. Fluxo de orçamento → pedido

1. Orçamento criado como `status = 'rascunho'`, número `ORC-YYYY-NNNN` (sequence `orcamento_seq`).
2. Vendedor edita itens, sistema recalcula preço a cada mudança via `POST /api/orcamentos/[id]/calcular` (preço **nunca fica congelado** enquanto em rascunho — sempre reflete `tipos_papel.preco_m2` atual).
3. Muda para `'enviado'` → `'aprovado'` (fluxo manual, sem regra de negócio automática validando a transição além do enforcement de quem pode converter).
4. **Conversão em pedido** (`POST /api/orcamentos/[id]/converter`):
   - Só permitido se `orcamento.status === 'aprovado'`.
   - Só o vendedor dono do orçamento ou um admin pode converter (`user.tipo !== 'admin' && orc.vendedor_id !== user.id` → 403).
   - Cria `pedidos` com `numero = PED-YYYY-NNNN` (sequence `pedido_seq`), `origem = 'sistema'` (default), `status = 'pendente'`, copiando `cliente_id`, `vendedor_id`, `valor_total`, `observacoes` do orçamento.
   - Marca o orçamento como `status = 'convertido'`.
   - **Esse fluxo nunca gerou um pedido em produção ainda** (0 pedidos com `origem='sistema'`) — todo o volume real de pedidos vem de sync UniPlus ou import de planilha. Ver `Docs/BUGS.md`.

## 3. Roles e permissões (RBAC)

- **3 tipos** (`usuarios.tipo`): `admin`, `operador`, `vendedor`.
- **Permissões default por tipo** (`types/index.ts` → `DEFAULT_PERMISSIONS`), seedadas em `usuario_permissoes` no primeiro login:

  | Feature | admin | operador | vendedor |
  |---|---|---|---|
  | dashboard | ✅ | ✅ | ✅ |
  | clientes | ✅ | ❌ | ✅ |
  | orcamentos | ✅ | ❌ | ✅ |
  | pedidos | ✅ | ✅ | ✅ |
  | vendas | ✅ | ❌ | ✅ |
  | materiais | ✅ | ✅ | ❌ |
  | tabelas_margem | ✅ | ❌ | ❌ |
  | condicoes_pagamento | ✅ | ❌ | ❌ |
  | usuarios | ✅ | ❌ | ❌ |
  | uniplus | ✅ | ❌ | ❌ |

  Um admin pode sobrescrever qualquer uma dessas por usuário individual, em `/usuarios`.
- **Admin sempre passa** em qualquer checagem de feature, independente do que está em `usuario_permissoes`.
- **Cadastro pendente**: login novo via Google cria usuário com `ativo=false`; ele não consegue acessar nada (nem logar de fato) até um admin aprovar em `/usuarios`. Login via credentials para uma conta `ativo=false` também falha.
- **Vendedor sem senha**: vendedores criados automaticamente pela sync UniPlus recebem `senha_hash='UNIPLUS_NO_LOGIN'` — existem no sistema (aparecem como dono de clientes/pedidos) mas não conseguem logar até um admin definir uma senha de verdade.

## 4. Dashboard — visões por role

`pages/api/dashboard-charts.ts`: admin pode passar `?view=` para simular a visão de qualquer role; os demais sempre veem a visão do próprio `tipo`.
- **View `vendedor`**: dados filtrados só pelos pedidos/clientes daquele vendedor (`filterByVendedor`).
- **View `operador`**: dados financeiros removidos (faturamento, valor de vendas, lista de clientes) — operador vê volume/produção, não dinheiro.
- **View `admin`**: dados completos, sem filtro.

## 5. Pedidos — status por origem

O campo `pedidos.status` tem domínios de valores **diferentes** dependendo de `origem`, porque vêm de sistemas diferentes:

| `origem` | valores de `status` observados em produção |
|---|---|
| `'sistema'` | `'pendente'` (inicial na conversão; nunca avançou em produção ainda) |
| `'uniplus'` | `'concluido'`, `'cancelado'`, `'pendente'` (mapeados de códigos numéricos do UniPlus: `0,1→pendente`, `2→em_producao`, `3→concluido`, `4,6→cancelado`, ver `scripts/uniplus-full-sync.mjs`) |
| `'importacao'` | `'entregue'`, `'pendente'` (vem direto da planilha Excel, sem mapeamento) |

Não tratar `status` como um enum único e fechado ao construir filtros/relatórios — sempre considerar `origem` junto.

## 6. Vínculo cliente ↔ vendedor ↔ venda

- Todo `cliente` **pode** ter um `vendedor_id` (não obrigatório).
- Toda venda UniPlus (`pedidos.origem='uniplus'`) tenta resolver `vendedor_id` em duas etapas, nessa ordem de prioridade:
  1. Match direto pelo nome do vendedor retornado na venda (`nomeVendedor`) contra `usuarios.nome` (exato, depois parcial/substring).
  2. Se não achou, herda o `vendedor_id` do **cliente** vinculado à venda.
- Hoje ~63% das vendas UniPlus têm vendedor resolvido e ~65% têm cliente resolvido — os 35-37% restantes ficam sem vínculo. Isso é uma lacuna conhecida, não uma regra — ver `Docs/BUGS.md` antes de assumir que os números de "vendas por vendedor" no dashboard são completos.

## 7. Import de planilha Excel (produção histórica)

- Fonte: `Reunião/TRENDS - TABELA PRODUCAO 2026 - LUIS.xlsx`, uma aba por mês de produção.
- Cada linha vira um `pedidos` com `origem='importacao'`, sem `cliente_id`/`vendedor_id` (só `cliente_nome` texto livre) — esses pedidos **não** aparecem em relatórios que dependem de `cliente_id`.
- Reimport é destrutivo por design: roda `DELETE FROM pedidos WHERE origem='importacao'` antes de inserir de novo (`scripts/import-pedidos-load-db.mjs`) — a cada reimport, todo o histórico de importação é substituído do zero pelo conteúdo atual da planilha.
