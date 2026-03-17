# Trends — Sistema de Orçamentos para Etiquetas

Sistema interno de orçamentos, precificação e gestão de pedidos para a **Trends Soluções em Etiquetas**.

## Stack

| Camada     | Tecnologia                                             |
| ---------- | ------------------------------------------------------ |
| Framework  | Next.js 16 (Pages Router)                              |
| UI         | React 19 · Tailwind CSS v4 · shadcn/ui · Lucide icons  |
| State      | Zustand                                                |
| Auth       | NextAuth v4 (Google OAuth + Credentials)               |
| Database   | PostgreSQL (Neon serverless) via `postgres.js`          |
| Validation | Zod v4 · react-hook-form                               |
| PDF        | jsPDF + jspdf-autotable                                |
| Env        | Doppler                                                |
| Package    | pnpm                                                   |

## Pré-requisitos

- Node.js 20+
- pnpm
- [Doppler CLI](https://docs.doppler.com/docs/install-cli) configurado com acesso ao projeto
- Google OAuth credentials configuradas no Google Cloud Console

## Setup

```bash
pnpm install
```

## Comandos

```bash
# Desenvolvimento (com NEXTAUTH_URL corrigida para localhost)
pnpm dev:local

# Desenvolvimento (usa NEXTAUTH_URL do Doppler — pode apontar para prod)
doppler run -- pnpm dev

# Build de produção
doppler run -- pnpm build

# Iniciar em produção
doppler run -- pnpm start

# Lint
pnpm lint
pnpm lint:fix
```

## Variáveis de Ambiente (via Doppler)

| Variável              | Descrição                          |
| --------------------- | ---------------------------------- |
| `DATABASE_URL`        | URL de conexão Neon PostgreSQL     |
| `NEXTAUTH_URL`        | URL base do app (ex: https://...)  |
| `NEXTAUTH_SECRET`     | Secret para JWT do NextAuth        |
| `GOOGLE_CLIENT_ID`    | Google OAuth Client ID             |
| `GOOGLE_CLIENT_SECRET`| Google OAuth Client Secret         |

> **Nota:** Para Google OAuth funcionar em dev, adicione `http://localhost:3000/api/auth/callback/google` como URI de redirecionamento autorizada no Google Cloud Console.

## Migrações de Banco

Os arquivos SQL estão em `migrations/`. Para rodar:

```bash
# Criar script temporário run-migrations.mjs:
cat > run-migrations.mjs << 'EOF'
import fs from 'fs'
import postgres from 'postgres'
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', max: 1 })
const files = process.argv.slice(2)
for (const file of files) {
  console.log(`Running ${file}...`)
  await sql.unsafe(fs.readFileSync(file, 'utf8'))
  console.log(`✓ ${file}`)
}
await sql.end()
EOF

# Rodar uma migração específica
doppler run -- node run-migrations.mjs migrations/005_materiais_cadastros.sql

# Rodar todas de uma vez
doppler run -- node run-migrations.mjs migrations/005_materiais_cadastros.sql migrations/006_tabelas_margem.sql migrations/007_fornecedores_papel.sql migrations/008_orcamento_novos_campos.sql
```

### Migrações aplicadas

| #   | Arquivo                           | Descrição                                                         |
| --- | --------------------------------- | ----------------------------------------------------------------- |
| 001 | `001_init.sql`                    | Tabelas base: usuarios, clientes, tipos_papel, orcamentos, pedidos |
| 002 | `002_google_oauth.sql`            | Campos Google OAuth em usuarios                                   |
| 003 | `003_tipos_papel_campos_preco.sql`| Colunas de precificação em tipos_papel                            |
| 004 | `004_seed_tipos_papel_precos.sql` | Seed de dados iniciais de papel                                   |
| 005 | `005_materiais_cadastros.sql`     | Facas, cores Pantone, tubetes, acabamentos, condições pagamento    |
| 006 | `006_tabelas_margem.sql`          | Tabelas de margem configuráveis + faixas graduadas por rolos       |
| 007 | `007_fornecedores_papel.sql`      | Múltiplos fornecedores por papel, preço médio                     |
| 008 | `008_orcamento_novos_campos.sql`  | Campos novos em itens/orçamentos, histórico de frete              |

## Estrutura do Projeto

```
pages/
  api/                    # API routes (CRUD)
    auth/                 # NextAuth
    clientes/             # Clientes CRUD
    orcamentos/           # Orçamentos + /calcular + /converter
    pedidos/              # Pedidos CRUD
    facas/                # Facas CRUD
    cores-pantone/        # Cores Pantone CRUD
    tubetes/              # Tubetes CRUD
    acabamentos/          # Acabamentos CRUD
    condicoes-pagamento/  # Condições de pagamento CRUD
    tabelas-margem/       # Tabelas de margem + faixas
    tipos-papel/          # Tipos de papel + /fornecedores
    historico-frete/      # Histórico de frete por cliente
    usuarios/             # Usuários CRUD
    dashboard.ts          # Dashboard stats
  orcamentos/
    [id].tsx              # Formulário de orçamento (página principal)
  dashboard.tsx
  clientes.tsx
  materiais.tsx           # 5 abas: Papéis, Facas, Pantone, Tubetes, Acabamentos
  condicoes-pagamento.tsx
  tabelas-margem.tsx
  orcamentos.tsx
  pedidos.tsx
  usuarios.tsx
  tipos-papel.tsx         # DEPRECATED → redirect /materiais

components/
  ui/                     # shadcn/ui components
  layout/                 # Header, Sidebar, MainLayout
  forms/                  # Formulários reutilizáveis

lib/
  auth.ts                 # NextAuth config
  auth-middleware.ts       # withAuth, withAdmin HOFs
  db.ts                   # Conexão PostgreSQL (Neon)
  pricing.ts              # Motor de precificação (calcularItem, calcularMultiplasQuantidades)
  pdf-orcamento.ts        # Geração de PDF de orçamento
  validations/            # Schemas Zod
  utils.ts                # Helpers (formatCurrency, formatLocalDate, etc.)

services/
  api.ts                  # Axios services (clientesService, facasService, etc.)

types/
  index.ts                # Todas interfaces/types TypeScript

migrations/               # SQL migrations (001-008)
store/                    # Zustand stores
styles/                   # Tailwind globals
```

## Autenticação

- **Google OAuth** — Login via Google, novos usuários ficam pendentes (`ativo=false`) até admin aprovar
- **Credentials** — Login com email/senha (bcrypt)
- **Roles:** `admin` (acesso total) e `vendedor` (orçamentos/pedidos)
- JWT com validade de 24 horas

## Motor de Precificação

O cálculo de preço (`lib/pricing.ts`) considera:

1. **Metragem linear** por rolo com espaçamento (3mm altura, 5mm largura)
2. **Arredondamento de rolos** (CEIL) — avisos para metragem fora do ideal (40-46m)
3. **Custo material** com buffer de 5%
4. **Custo Pantone** — adicional por m² + % hora separação
5. **Custo tubete** — por unidade
6. **Custo máquina** — multiplicador de velocidade + % adicional da faca
7. **Acabamentos** — percentuais adicionais (serrilha, verniz, etc.)
8. **Margem configurável** — por faixas de quantidade de rolos (tabelas por vendedor)
9. **Mínimo 4 rolos** — aviso (não bloqueante)
10. **Múltiplas quantidades** — cálculo em lote por item

## Licença

Uso interno — Trends Soluções em Etiquetas.
