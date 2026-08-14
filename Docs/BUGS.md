# Bugs & Pendências — Trends

> Backlog vivo de problemas conhecidos, lacunas e dívidas técnicas. Adicione um item sempre que achar algo que não é "regra de negócio" nem "arquitetura pretendida", mas sim algo quebrado, incompleto ou frágil. Quando resolver, mova para "Resolvidos" com a data e o commit, não apague — o histórico ajuda a não redescobrir o mesmo problema depois.

Formato de cada item: **o que**, **impacto**, **evidência** (como confirmar/reproduzir), **sugestão** (se houver).

---

## Abertos

### 1. Permissão granular (`usuario_permissoes`) só é checada nas páginas, não nas APIs
- **Impacto**: um usuário logado com uma feature desligada (ex.: `vendedor` sem `materiais`) não vê o link no menu nem consegue abrir `/materiais`, mas consegue chamar `/api/tipos-papel`, `/api/tabelas-margem`, `/api/condicoes-pagamento`, `/api/clientes` etc. diretamente — essas rotas usam só `withAuth` (sessão válida), não checam `usuario_permissoes`. Só `/api/uniplus/*` e ações administrativas dentro de `/api/usuarios` checam `tipo === 'admin'` de fato.
- **Evidência**: `grep -n "withAuth\|withAdmin" pages/api/tipos-papel/index.ts pages/api/clientes/index.ts pages/api/tabelas-margem/index.ts` — todas usam só `withAuth`.
- **Sugestão**: criar um `withFeature(feature, handler)` análogo ao `withAdmin`, que carrega `usuario_permissoes` do `req.user` e aplica nas rotas hoje protegidas só por `withAuth`.

### 2. Sync UniPlus real não passou pela UI — `uniplus_sync_log` não reflete a realidade
- **Impacto**: a tabela `uniplus_sync_log`, pensada para auditar sincronizações, tem **1 registro só**, de 2026-03-24, com `total_registros=0` — mesmo com 24.817 vendas e 6.261 produtos importados do UniPlus em produção. Isso quer dizer que quem olhar essa tabela pra saber "quando foi a última sync" ou "quantos registros vieram" vai se enganar.
- **Evidência**: a carga real foi feita rodando `scripts/uniplus-full-sync.mjs` (antes `run-sync-v2.mjs`) direto no terminal, não pelo botão "Sincronizar" da página `/uniplus` (`pages/api/uniplus/sync.ts` → `lib/uniplus-sync.ts::syncFull`, que é quem grava em `uniplus_sync_log`).
- **Sugestão**: decidir se `/uniplus` (a sync via UI) é pra ser o caminho oficial daqui pra frente — se sim, testar e validar que ela dá conta do volume completo (24k+ vendas, paginação/timeout de função serverless na Vercel pode ser um problema real pra payloads desse tamanho); se não, documentar que `scripts/uniplus-full-sync.mjs` é o processo real e considerar automatizar via cron externo em vez de manter a UI como se fosse funcional.

### 3. Vendas UniPlus sem cliente/vendedor vinculado
- **Impacto**: ~35% dos pedidos `origem='uniplus'` (38.305 no total, 24.817 são UniPlus) estão sem `cliente_id`, e ~37% sem `vendedor_id`. Relatórios/dashboards que agrupam por cliente ou vendedor sub-representam esse volume.
- **Evidência**: rodar a query abaixo contra o banco (via `doppler run -- node <script>` com `postgres.js`):
  ```sql
  SELECT
    COUNT(*) FILTER (WHERE cliente_id IS NOT NULL)::float / COUNT(*) AS pct_com_cliente,
    COUNT(*) FILTER (WHERE vendedor_id IS NOT NULL)::float / COUNT(*) AS pct_com_vendedor
  FROM pedidos WHERE origem = 'uniplus';
  ```
- **Causa raiz**: o matching é por nome (substring, case-insensitive) contra `usuarios.nome` — nomes que não batem exatamente (abreviações, apelidos, representantes com razão social diferente do nome comercial) ficam de fora. `fix-vendedores-final.mjs` (já removido do root, lógica documentada em `Docs/REGRAS_NEGOCIO.md` §6) tratou alguns casos manualmente com um mapa de aliases hardcoded — não é um processo repetível para novos casos.
- **Sugestão**: pedir pro UniPlus o `codigoVendedor` na API de vendas (hoje só vem `nomeVendedor`, texto livre) — se existir, resolver por código em vez de nome eliminaria a ambiguidade. Se não existir, montar uma tela de "vendas sem vendedor" pra reconciliação manual assistida, em vez de scripts ad-hoc.

### 4. `clientes.vendedor_id` preenchido em só 28% dos clientes
- **Impacto**: a maioria dos 8.740 clientes não tem vendedor associado — dashboards e regras que dependem de "vendedor do cliente" (ex.: herança de vendedor pra vendas sem match direto, ver `Docs/REGRAS_NEGOCIO.md` §6) cobrem uma fração pequena da base.
- **Evidência**: `SELECT COUNT(*) FILTER (WHERE vendedor_id IS NOT NULL)::float / COUNT(*) FROM clientes;` → ~0.28.
- **Causa provável**: o campo `codigoVendedor` do UniPlus nem sempre vem preenchido na entidade cliente, ou o vendedor referenciado não tinha `uniplus_id` mapeado no momento da sync.

### 5. `clientes.cnpj` sem constraint UNIQUE — duplicidade de clientes
- **Impacto**: migrations 011/012 tornaram `cnpj` nullable e removeram o UNIQUE. Isso foi necessário porque o UniPlus tem registros legítimos sem CNPJ, mas como efeito colateral, nada impede dois `clientes` com o mesmo CNPJ hoje (ex.: filiais importadas como registros separados, ou reimport que não deduplicou).
- **Evidência**: `SELECT cnpj, COUNT(*) FROM clientes WHERE cnpj IS NOT NULL GROUP BY cnpj HAVING COUNT(*) > 1;`
- **Sugestão**: rodar essa query e avaliar se dá pra mesclar os duplicados; se a duplicidade for legítima (matriz/filial), considerar um campo separado em vez de duplicar `razao_social`+`cnpj`.

### 6. Fluxo orçamento → pedido nunca foi usado em produção
- **Impacto**: não é um bug de código (o endpoint `/api/orcamentos/[id]/converter` existe e parece correto), mas é uma lacuna de validação real: 0 pedidos com `origem='sistema'` existem hoje. O caminho "vendedor monta orçamento → aprova → converte em pedido" nunca rodou de ponta a ponta com dados reais, então bugs nele provavelmente não foram descobertos ainda.
- **Evidência**: `SELECT COUNT(*) FROM pedidos WHERE origem='sistema';` → 0. Só 5 orçamentos existem no banco total (4 rascunho, 1 aprovado, 0 convertido).
- **Sugestão**: antes de divulgar esse fluxo pros vendedores como "pronto", fazer um teste manual completo (criar cliente → orçamento → aprovar → converter → conferir pedido) em produção ou staging.

### 7. Export Trends → UniPlus nunca testado
- **Impacto**: `exportCliente`/`exportOrcamento` em `lib/uniplus-sync.ts` e a UI de export em `/uniplus` existem em código, mas `0` orçamentos têm `uniplus_id` preenchido — o caminho de escrita de volta pro ERP nunca rodou contra o Yoda real.
- **Evidência**: `SELECT COUNT(*) FROM orcamentos WHERE uniplus_id IS NOT NULL;` → 0.
- **Sugestão**: tratar como não-validado até o primeiro teste real; não assumir que "exportar orçamento" funciona só porque compila.

### 8. Numeração de migration duplicada (`013`)
- **Impacto**: baixo (ambas já aplicadas, sem conflito real), mas confunde quem for ler o histórico.
- **Evidência**: `migrations/013_pedidos_cliente_codigo.sql` e `migrations/013_rbac_permissoes.sql` coexistem.
- **Sugestão**: a próxima migration deve ser `014`; não reutilizar `013` de novo. Não vale a pena renomear as existentes (já rodaram em produção).

### 9. `Docs/Uniplus/plan.md` está desatualizado em vários pontos
- **Impacto**: quem ler esse plano pra entender a integração UniPlus vai se basear em informação errada — ex.: descreve a "decisão crítica" Desktop-vs-Web como em aberto (já resolvida, ver `Docs/ARQUITETURA.md`), descreve `uniplus_config.conta` (a coluna real é `user_id`/`user_password`), e não menciona que a sync real roda via `scripts/uniplus-full-sync.mjs` fora da UI.
- **Sugestão**: tratar `Docs/Uniplus/plan.md` como registro histórico da fase de planejamento, não como documentação corrente — `Docs/ARQUITETURA.md`, `Docs/DATABASE.md` e este arquivo são a fonte de verdade atual.

---

## Resolvidos

### Opções de quantidade do orçamento não sobreviviam ao salvar (2026-08-14)
Era: o formulário de item de orçamento deixava adicionar várias "Opções de Quantidade" (ex: comparar preço pra 20 mil vs 30 mil), mas `pages/orcamentos/[id].tsx::handleSave` só enviava `quantidades[0]` pro back-end — as demais eram descartadas silenciosamente. Além disso, o `PUT /api/orcamentos/[id]` fazia `DELETE FROM itens_orcamento` seguido de vários `INSERT` **sem transação** — se qualquer insert falhasse (ex: `tipo_papel_id` apontando pra um registro já apagado), os itens ficavam vazios sem rollback, enquanto os campos do orçamento em si (frete, status) já tinham sido salvos por um UPDATE separado. Também faltava `cliente_id` na cláusula `UPDATE orcamentos SET ...`, então trocar o cliente de um orçamento existente não persistia.

Resolvido: nova coluna `itens_orcamento.quantidades_alt` (JSONB, migration 015) guarda todas as opções comparadas — só a primeira conta no `valor_total`. As duas rotas (`POST /api/orcamentos`, `PUT /api/orcamentos/[id]`) agora usam `sql.begin()` (transação) pro DELETE+INSERT de itens, e o UPDATE passou a incluir `cliente_id`.

### Fórmula de espaçamento por Z confirmada nas três engrenagens (2026-08-13)
Era: `lib/porta-cliche.ts` só tinha `1/8CP` confirmado contra dado real; `M1` e `HELICOIDAL_20_M1` eram hipótese (baseada em constantes de bytecode: π e 20° em radianos) e ficavam desligadas na precificação (fallback pro 3mm fixo).

Resolvido pegando exports em PDF da ferramenta original pras duas engrenagens que faltavam (mesmo processo usado pra confirmar `1/8CP`: altura 50mm, Z 30–100). Bateram 100% com a hipótese:
- `M1`: passo = π ≈ 3.14159mm — confirmado, 71/71 valores exatos
- `HELICOIDAL_20_M1`: passo = π ÷ cos(20°) ≈ 3.34322mm — confirmado, 71/71 valores exatos
- Os limiares de qualidade (2.0 / 2.5 / 4.0mm) se repetem idênticos nas três engrenagens

As três agora estão em `ENGRENAGENS_CONFIRMADAS` e entram na precificação normalmente quando a faca tem Z cadastrado.

**Ainda não identificado** (baixa prioridade, não bloqueia nada): a constante `3.8` encontrada no bytecode ao lado dos limiares confirmados (`2.0`, `2.5`, `4.0`). Os 213 valores reais batem perfeitamente só com esses três limiares nas três engrenagens — `3.8` deve ser usado em outra parte da classe `calculaPC`, não na classificação de qualidade.
