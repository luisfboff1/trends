# Arquitetura — Trends

> Última revisão: 2026-08-13. Este documento descreve o sistema **como ele está implementado hoje** (não o plano original). Mantenha atualizado à medida que a arquitetura mudar — é mais barato editar uma seção aqui do que redescobrir isso lendo código depois.

## Stack

| Camada     | Tecnologia                                            |
| ---------- | ------------------------------------------------------ |
| Framework  | Next.js 16 (Pages Router)                              |
| UI         | React 19 · Tailwind CSS v4 · shadcn/ui · Lucide icons  |
| State      | Zustand                                                |
| Auth       | NextAuth v4 (Google OAuth + Credentials, JWT 24h)      |
| Database   | PostgreSQL (Neon serverless) via `postgres.js`, **sem ORM** — SQL cru em toda a base |
| Validation | Zod v4 · react-hook-form                               |
| PDF        | jsPDF + jspdf-autotable                                |
| Env        | Doppler (`doppler run -- <comando>`)                   |
| Package    | pnpm                                                    |
| Deploy     | Vercel                                                  |

## Camadas e fluxo de uma requisição

```
pages/*.tsx (rota + getServerSideProps)
   ↓ usa requireFeature() para checar permissão de página
   ↓ chama services/api.ts (axios)
pages/api/**/*.ts (API route)
   ↓ protegida por withAuth / withRole / withAdmin (lib/auth-middleware.ts)
lib/*.ts (regra de negócio: pricing.ts, uniplus-sync.ts, pdf-orcamento.ts...)
   ↓
lib/db.ts → postgres.js → Neon PostgreSQL
```

Não existe camada de repositório/ORM: cada API route escreve SQL diretamente via template literals do `postgres.js` (`sql\`SELECT ...\``). Isso é intencional (ver `Docs/Uniplus/plan.md` — "SQL agent atuará depois"), mas significa que qualquer mudança de schema exige grep manual por todo `pages/api/` e `lib/` para achar todo lugar que toca a tabela.

## Autenticação e RBAC

- **NextAuth v4**, sessão JWT válida por 24h (`lib/auth.ts`).
- **Login Google**: usuário novo é criado com `ativo=false` (pendente) e redirecionado para `/aguardando-aprovacao`; um admin precisa aprovar manualmente (marcar `ativo=true`) na página `/usuarios`.
- **Login Credentials**: email + senha (bcrypt), só funciona se `senha_hash` estiver setado — contas criadas via UniPlus sync (vendedores importados) recebem `senha_hash = 'UNIPLUS_NO_LOGIN'` e **não conseguem logar** até um admin definir uma senha real.
- **3 roles** (`usuarios.tipo`): `admin`, `operador`, `vendedor`. Ver `types/index.ts` (`UserTipo`, `ALL_FEATURES`, `DEFAULT_PERMISSIONS`).
- **Permissões granulares por feature**: tabela `usuario_permissoes` (`usuario_id`, `feature`, `habilitado`), uma linha por feature de `ALL_FEATURES` (`dashboard`, `clientes`, `orcamentos`, `pedidos`, `vendas`, `materiais`, `tabelas_margem`, `condicoes_pagamento`, `usuarios`, `uniplus`). Populada com os defaults do `tipo` no primeiro login/signup; admin pode customizar por usuário na página `/usuarios`.
- **Enforcement é em duas camadas, mas assimétrico — ver `Docs/BUGS.md`**:
  - **Página**: `lib/require-feature.ts` (`requireFeature(ctx, feature)`) roda em `getServerSideProps` e redireciona para `/dashboard` se a feature estiver desligada. Admin sempre passa.
  - **API**: a maioria das rotas (`clientes`, `tipos-papel`, `tabelas-margem`, `condicoes-pagamento`, etc.) usa apenas `withAuth` (exige sessão válida, **não checa a permissão granular da feature**). Só as rotas `/api/uniplus/*` e algumas ações dentro de `/api/usuarios` checam `tipo === 'admin'` explicitamente.

## Integração UniPlus (ERP)

- O UniPlus roda num servidor "Yoda" **exposto em IP público** (`https://<ip>:3000`, certificado self-signed — ver `uniplus_config` no banco). Isso resolve a "decisão crítica de arquitetura" deixada em aberto no `Docs/Uniplus/plan.md`: **não existe e não é necessário um sync agent local** — a Vercel acessa o Yoda diretamente.
- `lib/uniplus-client.ts` — cliente HTTP com gestão de token OAuth (client_credentials).
- `lib/uniplus-sync.ts` + `pages/api/uniplus/{sync,export,config,status,browse}.ts` — sync bidirecional acionado pela UI (`/uniplus`, admin only). Isso é o caminho "oficial", mas **a carga real de produção (24.8k vendas) foi feita rodando `scripts/uniplus-full-sync.mjs` diretamente no terminal**, não pelo botão da UI — ver `Docs/BUGS.md`.
- O export Trends → UniPlus (`exportCliente`, `exportOrcamento`) existe em código mas **nunca foi usado em produção** (0 orçamentos com `uniplus_id` preenchido).

## Import histórico (planilha Excel)

- `scripts/import-pedidos-from-excel.py` lê `Reunião/TRENDS - TABELA PRODUCAO 2026 - LUIS.xlsx` e gera `scripts/pedidos_import.json`.
- `scripts/import-pedidos-load-db.mjs` faz `DELETE FROM pedidos WHERE origem = 'importacao'` seguido de um `INSERT` em lote a partir desse JSON.
- É um pipeline **repetível** (idempotente por causa do DELETE inicial) — se a planilha for atualizada, rode os dois scripts de novo, nessa ordem.

## Motor de precificação

Ver `Docs/REGRAS_NEGOCIO.md` para as regras completas. Fica em `lib/pricing.ts`, que hoje tem **dois motores coexistindo**:
- `calcularItem()` — motor atual ("Fase 1"), com margem configurável por tabela (`tabelas_margem` + `faixas_margem`, por faixa de quantidade de rolos), custo de Pantone/tubete/máquina/acabamentos.
- `calcularItemLegacy()` — motor antigo (margem fixa vendedor=2.8x / revenda=2.1x + tabela de desconto por quantidade), mantido só para orçamentos antigos que já usavam esse cálculo.

## Estrutura de pastas

```
pages/            # rotas Next.js (Pages Router) + pages/api/**
components/       # ui/ (shadcn), layout/ (header, sidebar), forms/
lib/              # regra de negócio, auth, db, integrações
  validations/    # schemas Zod
services/         # api.ts — client axios usado pelo front
store/            # Zustand (auth, modal, sidebar, theme)
types/            # todas as interfaces TS do domínio
migrations/       # SQL, numeradas sequencialmente (ver README)
scripts/          # ferramentas de linha de comando reutilizáveis (migração, import Excel, sync UniPlus manual)
Docs/             # esta pasta — arquitetura, banco, regras de negócio, bugs
Docs/Uniplus/     # documentação específica da integração ERP
Plans/            # planos de implementação (histórico, não necessariamente atual)
Reunião/          # atas e planilhas de reunião com o cliente
MeguisPet/        # projeto-template usado como referência de padrões ao criar este projeto
```

## Deploy

- Vercel (produção), variáveis de ambiente via Doppler (`prd` config, projeto `trends`).
- `pnpm build` roda `next build`; todas as rotas de `pages/api/` são funções serverless (`ƒ` no output do build).
