# Plan: Sistema de Gestão Trends Solutions

## Context

Build a Next.js management system for Trends Solutions — a label manufacturing company. The system handles quote generation (orçamentos), client management (clientes linked to sellers), paper type catalog with m² pricing, and order conversion. Based on the meeting notes, MeguisPet architecture, Trends visual identity (red #dd2620), and Neon PostgreSQL (already in .env.local).

**Critical differences from MeguisPet:**
- Database: **Neon PostgreSQL** (not Supabase) — env vars already configured
- Auth: **NextAuth.js v5** with CredentialsProvider + bcryptjs (no Supabase Auth)
- DB queries: **raw SQL via postgres.js** (no ORM — SQL agent will act later)
- App created **at root** of trends repo (same level as Site/, Planilha/ folders)

---

## 1. Pricing Engine (from PRECOS spreadsheet analysis)

The PRECOS sheet reveals:
- **Input**: largura_mm, altura_mm (+3mm espaçamento automático), colunas, quantidade, tipo_papel (preco_m2), tipo_margem
- **Margem vendedor**: custo × 2.8 (180% markup = 2.8x)
- **Margem revenda**: custo × 2.1 (110% markup = 2.1x)
- **Paper buffer**: +5% on raw m² cost
- **Progressive discounts** (applied to final price):
  | Quantidade | Desconto |
  |---|---|
  | 1–4.999 | 0% |
  | 5.000–9.999 | 2% |
  | 10.000–14.999 | 3% |
  | 15.000–19.999 | 4% |
  | 20.000–49.999 | 5% |
  | 50.000–99.999 | 10% |
  | 100.000–199.999 | 15% |
  | 200.000–299.999 | 20% |
  | 300.000–499.999 | 25% |
  | 500.000+ | 28% |

```typescript
// lib/pricing.ts
const MARGEM = { vendedor: 2.8, revenda: 2.1 }
const BUFFER_PAPEL = 0.05 // +5%

export function calcularItem(params: {
  largura_mm: number, altura_mm: number, colunas: number,
  quantidade: number, preco_m2: number, tipo_margem: 'vendedor' | 'revenda'
}) {
  const altura_total = params.altura_mm + 3 // espaçamento
  const m2_por_mil = (params.largura_mm * altura_total * params.colunas * 1000) / 1_000_000
  const custo_por_mil = m2_por_mil * params.preco_m2 * (1 + BUFFER_PAPEL)
  const desconto = getDesconto(params.quantidade)
  const preco_por_mil = custo_por_mil * MARGEM[params.tipo_margem] * (1 - desconto)
  return {
    m2_total: m2_por_mil * params.quantidade / 1000,
    custo_por_mil,
    preco_por_mil,
    desconto,
    valor_total: preco_por_mil * params.quantidade / 1000
  }
}
```

---

## 2. Database Schema (minimal, normalized)

**File:** `supabase/migrations/001_init.sql` (but executed against Neon)

```sql
-- 1. usuarios (sellers/admins)
CREATE TABLE usuarios (
  id        SERIAL PRIMARY KEY,
  nome      VARCHAR(255) NOT NULL,
  email     VARCHAR(255) UNIQUE NOT NULL,
  senha_hash VARCHAR(255) NOT NULL,
  tipo      VARCHAR(20) NOT NULL DEFAULT 'vendedor',  -- 'admin' | 'vendedor'
  ativo     BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. clientes (always CNPJ, linked to vendedor)
CREATE TABLE clientes (
  id           SERIAL PRIMARY KEY,
  razao_social VARCHAR(255) NOT NULL,
  cnpj         VARCHAR(18) UNIQUE NOT NULL,
  email        VARCHAR(255),
  telefone     VARCHAR(20),
  endereco     TEXT,
  cidade       VARCHAR(100),
  estado       VARCHAR(2),
  vendedor_id  INTEGER REFERENCES usuarios(id),
  ativo        BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 3. tipos_papel (paper catalog — the "product" in this system)
CREATE TABLE tipos_papel (
  id          SERIAL PRIMARY KEY,
  nome        VARCHAR(255) NOT NULL,
  descricao   TEXT,
  fornecedor  VARCHAR(255),
  preco_m2    DECIMAL(10,4) NOT NULL,  -- R$/m² (updated by admin)
  ativo       BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 4. orcamentos (quotes — recalculated from current prices on open)
CREATE TABLE orcamentos (
  id           SERIAL PRIMARY KEY,
  numero       VARCHAR(50) UNIQUE NOT NULL,  -- auto-generated ORÇ-YYYY-NNNN
  cliente_id   INTEGER REFERENCES clientes(id),
  vendedor_id  INTEGER REFERENCES usuarios(id),
  tipo_margem  VARCHAR(20) NOT NULL DEFAULT 'vendedor',  -- 'vendedor' | 'revenda'
  status       VARCHAR(30) NOT NULL DEFAULT 'rascunho',  -- 'rascunho' | 'enviado' | 'aprovado' | 'convertido'
  observacoes  TEXT,
  valor_total  DECIMAL(12,2),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 5. itens_orcamento (quote line items — inputs locked, price recalculated)
CREATE TABLE itens_orcamento (
  id                  SERIAL PRIMARY KEY,
  orcamento_id        INTEGER REFERENCES orcamentos(id) ON DELETE CASCADE,
  tipo_papel_id       INTEGER REFERENCES tipos_papel(id),
  largura_mm          DECIMAL(8,2) NOT NULL,
  altura_mm           DECIMAL(8,2) NOT NULL,  -- WITHOUT +3mm (calculated on display)
  colunas             INTEGER NOT NULL DEFAULT 1,
  quantidade          INTEGER NOT NULL,
  imagem_url          TEXT,
  observacoes         TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 6. pedidos (orders — converted from approved quotes)
CREATE TABLE pedidos (
  id           SERIAL PRIMARY KEY,
  numero       VARCHAR(50) UNIQUE NOT NULL,  -- auto-generated PED-YYYY-NNNN
  orcamento_id INTEGER REFERENCES orcamentos(id),
  cliente_id   INTEGER REFERENCES clientes(id),
  vendedor_id  INTEGER REFERENCES usuarios(id),
  status       VARCHAR(30) NOT NULL DEFAULT 'pendente',  -- 'pendente' | 'producao' | 'entregue' | 'cancelado'
  observacoes  TEXT,
  valor_total  DECIMAL(12,2),
  data_entrega DATE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
```

**Note:** No separate `descontos` table — progressive discounts are hardcoded in `lib/pricing.ts` (configurable later by SQL agent).

---

## 3. Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (Pages Router — matches MeguisPet) |
| React | 19 |
| Language | TypeScript strict |
| Styling | Tailwind CSS v4 + Shadcn/ui |
| Animations | Framer Motion 12 |
| State | Zustand 5 |
| Auth | **NextAuth.js v5** (CredentialsProvider + bcryptjs) |
| Database | **Neon PostgreSQL** via `postgres` (postgres.js) |
| HTTP Client | Axios (service layer) |
| Tables | @tanstack/react-table v8 |
| Charts | Recharts 3 |
| Forms | React Hook Form + Zod |
| PDF | jsPDF + jspdf-autotable |
| Icons | Lucide React (NO emojis) |
| Toasts | Radix Toast |
| Package Mgr | pnpm |
| Deploy | Vercel |

---

## 4. Folder Structure (at root of trends repo)

```
trends/                    ← Root (Next.js app lives HERE)
├── pages/
│   ├── _app.tsx           ← NProgress + Toaster + MainLayout + session provider
│   ├── _document.tsx
│   ├── index.tsx          ← redirect to /dashboard
│   ├── login.tsx          ← no layout
│   ├── dashboard.tsx      ← quote/order stats
│   ├── clientes.tsx
│   ├── tipos-papel.tsx    ← paper catalog (admin only)
│   ├── orcamentos.tsx     ← quote list
│   ├── orcamentos/[id].tsx← quote detail/editor with live pricing
│   ├── pedidos.tsx
│   └── api/
│       ├── auth/[...nextauth].ts
│       ├── clientes/index.ts
│       ├── tipos-papel/index.ts
│       ├── orcamentos/index.ts
│       ├── orcamentos/[id].ts
│       ├── orcamentos/[id]/converter.ts  ← POST: convert to order
│       └── pedidos/index.ts
├── components/
│   ├── ui/               ← Shadcn base (button, input, dialog, table, etc.)
│   ├── layout/           ← header.tsx, sidebar.tsx, main-layout.tsx
│   ├── forms/            ← ClienteForm, TipoPapelForm, OrcamentoForm
│   ├── modals/           ← modal-host.tsx
│   └── dashboards/       ← StatsCard, QuoteChart, RecentOrders
├── hooks/
│   ├── useAuth.ts
│   ├── useSidebar.ts
│   └── useModal.ts
├── services/
│   └── api.ts            ← Axios instance + clientesService, orcamentosService, etc.
├── store/
│   ├── auth.ts
│   ├── modal.ts
│   ├── sidebar.ts
│   └── theme.ts
├── lib/
│   ├── db.ts             ← postgres.js connection (using DATABASE_URL from .env.local)
│   ├── auth.ts           ← NextAuth config (CredentialsProvider)
│   ├── auth-middleware.ts← withAuth HOF (adapted from MeguisPet's withSupabaseAuth)
│   ├── pricing.ts        ← calcularItem() + getDesconto()
│   ├── validation-middleware.ts
│   ├── sanitization.ts
│   ├── rate-limit.ts
│   ├── cache-manager.ts
│   ├── utils.ts          ← cn(), formatCurrency(), formatCNPJ(), etc.
│   └── validations/
│       ├── cliente.ts
│       ├── tipo-papel.ts
│       └── orcamento.ts
├── types/
│   └── index.ts          ← All domain interfaces
├── styles/
│   └── globals.css       ← Tailwind + Trends CSS vars (--primary: #dd2620)
├── public/
│   └── logo.webp         ← copy from Site/assets
├── migrations/
│   └── 001_init.sql
├── Site/                 ← Keep (static HTML reference)
├── Planilha/             ← Keep
├── MeguisPet/            ← Keep (template docs)
├── Reunião/              ← Keep
├── .env.local            ← Existing Neon vars + add NEXTAUTH_SECRET, NEXTAUTH_URL
├── next.config.js
├── tsconfig.json
├── package.json
└── ...
```

---

## 5. Auth Pattern (NextAuth adapted from MeguisPet)

```typescript
// lib/auth.ts — NextAuth config
export const authOptions: NextAuthOptions = {
  providers: [CredentialsProvider({
    credentials: { email: {}, password: {} },
    async authorize(credentials) {
      const user = await getUserByEmail(credentials.email)
      if (!user || !bcrypt.compareSync(credentials.password, user.senha_hash)) return null
      return { id: user.id, name: user.nome, email: user.email, tipo: user.tipo }
    }
  })],
  callbacks: {
    jwt: ({ token, user }) => user ? { ...token, id: user.id, tipo: user.tipo } : token,
    session: ({ session, token }) => ({ ...session, user: { ...session.user, id: token.id, tipo: token.tipo } })
  },
  pages: { signIn: '/login' }
}

// lib/auth-middleware.ts — withAuth HOF (replaces withSupabaseAuth)
export function withAuth(handler) {
  return async (req, res) => {
    const session = await getServerSession(req, res, authOptions)
    if (!session) return res.status(401).json({ success: false, error: 'Não autorizado' })
    req.user = session.user
    return handler(req, res)
  }
}
```

---

## 6. Visual Identity (globals.css)

```css
:root {
  --primary: #dd2620;        /* Trends red */
  --primary-hover: #b81e19;
  --title: #000000;
  --desc: #606060;
  --body-bg: #fbfbfb;
  --panel-bg: #ffffff;
  /* Shadcn mapping */
  --background: #fbfbfb;
  --foreground: #000000;
  --card: #ffffff;
  --border: #e0e0e0;
  --ring: #dd2620;
}
.dark {
  --background: #1f1f1f;
  --foreground: #ffffff;
  --card: #000000;
  --border: #333333;
}
```

Sidebar & header use black background with red accent (matching design-system.html ds-nav).

---

## 7. Key Pages & Components

### Sidebar items
- Dashboard (`/dashboard`) — visible to all
- Clientes (`/clientes`) — visible to all, filter by vendedor
- Orçamentos (`/orcamentos`) — visible to all
- Pedidos (`/pedidos`) — visible to all
- Tipos de Papel (`/tipos-papel`) — admin only
- (Future: Estoque, Máquinas)

### Quote editor (`/orcamentos/[id]`)
- Split layout: client info + item table
- Each item row: tipo_papel (dropdown), largura_mm, altura_mm, colunas, quantidade
- Live calculation: shows custo_m2, desconto %, preco_por_mil, total — recalculated on every change
- "Converter em Pedido" button (only for status='aprovado')
- Print/PDF export

### Pricing display
- Show: `area_m2`, `custo_por_mil`, `desconto`, `preco_por_mil`, `valor_total`
- Always recalculates from current `tipos_papel.preco_m2`

---

## 8. Implementation Steps

1. **Init Next.js app** at repo root with pnpm (`pnpm create next-app . --typescript --tailwind --no-app`)
2. **Install dependencies**: nextauth, bcryptjs, postgres, @tanstack/react-table, recharts, framer-motion, zustand, axios, react-hook-form, zod, @radix-ui/*, lucide-react, jspdf, shadcn-ui
3. **Setup Shadcn** (`pnpm dlx shadcn@latest init`) with Trends red as primary
4. **Copy lib files** from MeguisPet: validation-middleware, sanitization, rate-limit, cache-manager, utils
5. **Adapt auth**: replace withSupabaseAuth → withAuth (NextAuth)
6. **Create db.ts**: postgres.js connection with DATABASE_URL
7. **Run migration SQL** against Neon to create tables
8. **Copy store files** (auth, modal, sidebar, theme) — update auth store for NextAuth session
9. **Copy layout** (header, sidebar, main-layout) — apply Trends brand colors
10. **Build pages** in order: login → dashboard → clientes → tipos-papel → orcamentos (list + detail) → pedidos
11. **Implement pricing engine** in `lib/pricing.ts`
12. **Build OrcamentoForm** with live pricing calculation
13. **Add PDF export** for quotes

---

## 9. Files to Copy Exactly from MeguisPet

| File | Source | Action |
|---|---|---|
| `lib/validation-middleware.ts` | MeguisPet | Copy as-is |
| `lib/sanitization.ts` | MeguisPet | Copy as-is |
| `lib/rate-limit.ts` | MeguisPet | Copy as-is |
| `lib/cache-manager.ts` | MeguisPet | Copy as-is |
| `lib/utils.ts` | MeguisPet | Copy + add formatCNPJ, formatMM |
| `store/modal.ts` | MeguisPet | Copy, update ModalId union |
| `store/sidebar.ts` | MeguisPet | Copy as-is |
| `store/theme.ts` | MeguisPet | Copy as-is |
| `store/auth.ts` | MeguisPet | Adapt for NextAuth (no Supabase) |
| `components/ui/data-table.tsx` | MeguisPet | Copy as-is |
| `components/ui/animated-card.tsx` | MeguisPet | Copy as-is |
| `components/ui/use-toast.tsx` | MeguisPet | Copy as-is |
| `components/modals/modal-host.tsx` | MeguisPet | Copy, update modal IDs |
| `pages/_app.tsx` | MeguisPet | Adapt for NextAuth SessionProvider |

---

## 10. New Environment Variables (.env.local additions)

```bash
# Already present (Neon)
DATABASE_URL=...  ✓

# Add:
NEXTAUTH_SECRET=<generate-with-openssl-rand-base64-32>
NEXTAUTH_URL=http://localhost:3000
```

---

## 11. Verification

1. `pnpm dev` → app starts on localhost:3000
2. Navigate to `/login` → can login with seeded admin user
3. Navigate to `/clientes` → can create client with CNPJ lookup
4. Navigate to `/tipos-papel` → can add paper type with m²  price
5. Navigate to `/orcamentos/new` → create quote, add items, see live pricing
6. Approve quote → convert to order → appears in `/pedidos`
7. Deploy to Vercel: push to main → check build passes, Neon connection works
