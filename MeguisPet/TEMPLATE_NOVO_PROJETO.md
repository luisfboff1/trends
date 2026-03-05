# TEMPLATE — Sistema de Gestão/Vendas (baseado em MeguisPet)

> **Propósito**: Este documento é um template completo para criar novos sistemas de gestão (ex: Trends), aproveitando toda a arquitetura, padrões, bibliotecas, lógicas e estrutura já validadas no projeto MeguisPet.

---

## 1. Stack Tecnológica (Exatamente como está aqui)

| Camada | Tecnologia | Versão usada aqui |
|---|---|---|
| Framework | Next.js (Pages Router, SSR) | ^16 |
| UI | React | ^19 |
| Linguagem | TypeScript (strict mode) | — |
| Estilização | Tailwind CSS v4 + Shadcn/ui | — |
| Animações | Framer Motion | ^12 |
| Estado global | Zustand 5 | — |
| Auth | Supabase Auth + @supabase/ssr | — |
| Database | Supabase (PostgreSQL + RLS) | — |
| HTTP Client | Axios (com interceptors) | — |
| Tabelas | @tanstack/react-table | 8 |
| Gráficos | Recharts | 3 |
| Forms | React Hook Form + Zod | — |
| PDF | jsPDF + jspdf-autotable | — |
| Icons | Lucide React | — |
| Notificações | Radix Toast (@radix-ui/react-toast) | — |
| Env Vars | Doppler (fallback .env.local) | — |
| Deploy | Vercel SSR | — |
| Package Manager | pnpm | — |

---

## 2. Estrutura de Pastas (Copiar 1:1)

```
novo-projeto/
├── pages/                    # Rotas (file-based routing Next.js)
│   ├── _app.tsx              # Layout global, NProgress, Toaster
│   ├── _document.tsx         # HTML base
│   ├── index.tsx             # Redirect para /dashboard
│   ├── login.tsx             # Página de login (sem layout)
│   ├── dashboard.tsx
│   ├── [entidade].tsx        # Páginas das entidades do negócio
│   └── api/                  # API routes Next.js
│       ├── auth/
│       ├── dashboard/
│       └── [entidade]/
│           └── index.ts
├── components/
│   ├── ui/                   # Shadcn/Radix base components
│   ├── forms/                # Formulários das entidades
│   ├── layout/               # header.tsx, sidebar.tsx, main-layout.tsx
│   ├── modals/               # modal-host.tsx + modais específicas
│   ├── charts/               # Gráficos Recharts
│   ├── tables/               # Tabelas reutilizáveis
│   └── dashboards/           # Widgets do dashboard
├── hooks/
│   ├── useAuth.ts
│   ├── useSidebar.ts
│   ├── useModal.ts
│   ├── usePermissions.ts
│   ├── useTheme.ts
│   └── useVersionCheck.ts
├── services/
│   ├── api.ts                # Axios instance + interceptors + todos os services
│   └── [entidade]Service.ts  # Opcional: separar por entidade
├── store/
│   ├── auth.ts               # Zustand: user, token, status
│   ├── modal.ts              # Zustand: modal centralizado
│   ├── sidebar.ts            # Zustand: sidebar state
│   └── theme.ts              # Zustand: light/dark/system
├── lib/
│   ├── supabase.ts           # Client Supabase (browser)
│   ├── supabase-auth.ts      # Server auth helpers
│   ├── supabase-middleware.ts # withSupabaseAuth, withRole HOF
│   ├── validation-middleware.ts # withValidation Zod HOF
│   ├── sanitization.ts       # DOMPurify XSS protection
│   ├── rate-limit.ts         # Rate limiter in-memory
│   ├── cache-manager.ts      # Cache in-memory com TTL
│   ├── retry-logic.ts        # Retry para chamadas de API
│   ├── utils.ts              # cn() Tailwind merge
│   └── validations/          # Schemas Zod por entidade
├── types/
│   ├── index.ts              # Todas as interfaces do domínio
│   └── permissions.ts        # UserRole, Permissoes interface
├── styles/
│   └── globals.css           # CSS variables, dark mode, classes custom
├── public/                   # Assets estáticos
├── supabase/                 # Migrations SQL
├── docs/                     # Documentação
├── .doppler.yaml             # Config Doppler
├── next.config.js            # Config Next (SSR, bundle split, Webpack)
├── tsconfig.json             # strict: true, paths aliases
├── postcss.config.cjs
└── package.json
```

---

## 3. Configuração Inicial (Checklist de Setup)

### 3.1 next.config.js (padrão validado)
```js
// Copiar exatamente do MeguisPet:
// - transpilePackages: ['react-markdown', 'remark-gfm']
// - images.unoptimized: true
// - generateBuildId com timestamp (força cache bust no deploy)
// - compiler.removeConsole em production
// - webpack splitChunks para recharts, tanstack, supabase
// - env: NEXT_PUBLIC_API_URL
```

### 3.2 tsconfig.json (paths aliases obrigatórios)
```json
{
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

### 3.3 Variáveis de Ambiente
```bash
# Supabase (OBRIGATÓRIAS)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# API (opcional, padrão '/api')
NEXT_PUBLIC_API_URL=/api
```

---

## 4. Autenticação (Supabase Auth — padrão completo)

### 4.1 Middleware Edge (`middleware.ts`)
```typescript
// REGRA: Protege todas as rotas exceto /login e arquivos estáticos
// REGRA: Nunca escrever lógica entre createServerClient e supabase.auth.getUser()
// REGRA: Sempre retornar supabaseResponse para preservar cookies
// Usar lib/supabase-middleware.ts como base
import { createServerClient } from '@supabase/ssr'

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|login).*)',
  ],
}
```

### 4.2 HOFs de Proteção de API
```typescript
// lib/supabase-middleware.ts — copiar do MeguisPet

// Para proteger uma rota API:
export default withSupabaseAuth(async (req, res) => {
  // req.user.id, req.user.tipo_usuario, req.user.permissoes disponíveis
})

// Para exigir role específico:
export default withRole(['admin', 'gerente'])(handler)

// Para validar + autenticar:
export default withSupabaseAuth(withValidation(schema, handler))
```

### 4.3 Store Zustand (auth.ts)
```typescript
// Padrão SSR-safe com localStorage
// - user: Usuario | null
// - token: string | null
// - status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated'
// - setCredentials(), setStatus(), clear()
// Usar emptyStorage fallback para SSR
```

---

## 5. Sistema de Permissões (Copiar do MeguisPet)

### 5.1 `types/permissions.ts`
```typescript
// UserRole: 'admin' | 'gerente' | 'vendedor' | 'financeiro' | 'estoque' | 'operador' | 'visualizador'
// Interface Permissoes com index signature para acesso dinâmico
// Permissões granulares: dashboard, vendas, clientes, produtos, etc.
// Cada ação separada: vendas_criar, vendas_editar, vendas_deletar, vendas_visualizar_todas
```

### 5.2 Sidebar com filtro de permissões
```typescript
// Cada menu item tem permission?: keyof Permissoes
// useMemo filtra itens pelo hasPermission()
// Items sem permission = sempre visível (ex: Feedback)
```

### 5.3 usePermissions hook
```typescript
const { hasPermission, canCreate, canEdit, canDelete } = usePermissions()
// Usar em qualquer componente para controle fine-grained
```

---

## 6. API Service Layer (padrão `services/api.ts`)

```typescript
// 1. Criar instância Axios centralizada:
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '/api',
  timeout: 30000,
  withCredentials: true, // CRÍTICO para cookies
})

// 2. Interceptor de autenticação:
// - Lê token do localStorage (Supabase session)
// - Injeta Authorization: Bearer <token>
// - Fallback para token direto (retrocompatibilidade)

// 3. Interceptors de dev logging (só em development)

// 4. Services por entidade: dashboardService, clientesService, etc.
// Cada service agrupa: getAll, getById, create, update, delete
```

### Tipagem dos responses
```typescript
// SEMPRE tipar com:
ApiResponse<T>         // { success: boolean, data: T, message?: string }
PaginatedResponse<T>   // { success: boolean, data: T[], total: number, page: number }
```

---

## 7. State Management — Zustand Stores

### Stores obrigatórios (copiar do MeguisPet)
```typescript
// store/auth.ts    — user, token, status + SSR-safe localStorage
// store/modal.ts   — id, data, isOpen + open/close/setData
// store/sidebar.ts — isOpen, isCollapsed + responsive behavior
// store/theme.ts   — 'light' | 'dark' | 'system'
```

### Padrão SSR-safe (SEMPRE usar)
```typescript
const emptyStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
} as unknown as Storage

storage: createJSONStorage(() =>
  typeof window === 'undefined' ? emptyStorage : window.localStorage
)
```

---

## 8. Modal Host Pattern (Centralizado)

```typescript
// components/modals/modal-host.tsx
// - Único ponto de renderização de modais
// - React Portal para evitar z-index issues
// - Discriminated union para tipagem segura dos dados
// - Focus trap, ESC para fechar, restaurar focus

// Adicionar novo modal:
// 1. Adicionar ID no ModalId union (store/modal.ts)
// 2. Adicionar tipo de data no ModalData discriminated union
// 3. Adicionar case no switch do modal-host.tsx
// 4. Usar: const { open } = useModal(); open('nome-do-modal', { dado })
```

---

## 9. Formulários — Padrão de Herança

```typescript
// Criar PessoaForm.tsx (ou equivalente base) para campos comuns
// Estender em formulários específicos

interface EntityFormProps {
  mode: 'create' | 'edit'
  initialData?: EntityForm
  onSubmit: (data: EntityForm) => Promise<void>
  onCancel: () => void
}

// Validação: Zod schemas em lib/validations/
// Sanitização: sanitizeInput() antes de enviar
```

---

## 10. Sistema de Tipos (Domain Types)

### Padrão de interface para entidades
```typescript
// types/index.ts — TUDO centralizado aqui
interface Entidade {
  id: number
  nome: string
  ativo: boolean
  created_at: string
  updated_at: string
  // ... campos específicos
}

interface EntidadeForm {
  // Omit<Entidade, 'id' | 'created_at' | 'updated_at'>
  // Campos opcionais para criação
}
```

### Tipos de API response (sempre usar)
```typescript
interface ApiResponse<T = unknown> {
  success: boolean
  data: T
  message?: string
  error?: string
}

interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}
```

---

## 11. API Routes (Next.js) — Padrão de Implementação

```typescript
// pages/api/[entidade]/index.ts
import { withSupabaseAuth } from '@/lib/supabase-middleware'
import { withValidation } from '@/lib/validation-middleware'
import { withRateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { entidadeSchema } from '@/lib/validations/entidade'

export default withRateLimit(RateLimitPresets.GENERAL)(
  withSupabaseAuth(async (req, res) => {
    if (req.method === 'GET') { /* listar */ }
    if (req.method === 'POST') {
      return withValidation(entidadeSchema, async (req, res, data) => {
        // data é validado e sanitizado via Zod + DOMPurify
      })(req, res)
    }
  })
)
```

### Helpers de Supabase no servidor
```typescript
// Usar req.supabaseClient (já tem contexto do usuário para RLS)
const { data, error } = await req.supabaseClient
  .from('tabela')
  .select('*')
  .eq('ativo', true)
```

---

## 12. Segurança (OWASP Top 10 — já implementado)

| Vulnerabilidade | Solução implementada |
|---|---|
| Injeção SQL/XSS | Zod validation + DOMPurify sanitization |
| Auth quebrada | Supabase Auth + JWT + httpOnly cookies |
| Broken Access Control | withSupabaseAuth + withRole + RLS |
| Rate Limiting | lib/rate-limit.ts (por IP) |
| Dados sensíveis | HTTPS, secrets no Doppler/Vercel env |
| Tokens expostos | Supabase gerencia refresh automático |

```typescript
// NUNCA incluir em rotas sem proteção:
export default async function handler(req, res) { ... } // ❌

// SEMPRE usar:
export default withSupabaseAuth(handler) // ✅
```

---

## 13. Performance (padrões validados)

### Cache in-memory para APIs pesadas
```typescript
// lib/cache-manager.ts — TTL de 5 minutos
if (cacheManager.metricas.isValid()) {
  return res.json({ success: true, data: cacheManager.metricas.get()!.data })
}
// ... query pesada ...
cacheManager.metricas.set(resultado)
```

### Bundle Splitting (next.config.js)
```js
// Separar em chunks async: recharts, tanstack, supabase
// Usar next/dynamic para componentes pesados
```

### Data Loading
```typescript
// Dashboard: carregar dados em paralelo com Promise.all()
// Não usar await sequencial para dados independentes
const [metricas, topProdutos, vendasSemana] = await Promise.all([
  getMetricas(),
  getTopProdutos(),
  getVendasSemana(),
])
```

---

## 14. Layout Global (`_app.tsx`)

```typescript
// Padrão único:
// 1. NProgress nas mudanças de rota
// 2. ToastProvider envolvendo tudo
// 3. MainLayout com noLayoutPages (ex: /login)
// 4. useVersionCheck para forçar reload após deploy
// 5. Toaster (global notifications)

const noLayoutPages = ['/login', '/emergency-logout']
// MainLayout é aplicado automaticamente — páginas NÃO precisam se preocupar com isso
```

---

## 15. Sidebar Responsiva

```typescript
// Desktop: persistente (collapse state salvo no Zustand)
// Tablet/Mobile: overlay temporário (fecha ao navegar)
// Hook: useSidebar() — isOpen, isCollapsed, isTemporary, open/close/toggle
// Tecla ESC: fecha overlay no mobile
// Auto-close: fecha ao selecionar item no mobile (handleItemSelect)
```

---

## 16. Temas (Dark Mode)

```typescript
// store/theme.ts: 'light' | 'dark' | 'system'
// CSS variables em globals.css (--background, --foreground, etc.)
// useTheme hook: respeia preferência do sistema
// ThemeToggle component: botão para alternar
// SSR-safe: checar mounted antes de aplicar tema (evitar flash)
```

---

## 17. Toast Notifications

```typescript
// components/ui/use-toast.tsx — hook de controle
// components/ui/toaster.tsx — renderizador global
// Uso:
const { toast } = useToast()
toast({ title: 'Sucesso!', description: 'Operação realizada.', variant: 'success' })
// variants: 'default' | 'success' | 'destructive' (error) | 'info'
```

---

## 18. Tabelas de Dados (@tanstack/react-table)

```typescript
// components/ui/data-table.tsx — componente base reutilizável
// Funcionalidades já implementadas:
// - Paginação server-side
// - Ordenação por coluna
// - Busca/filtro
// - Seleção de linhas
// - Colunas customizáveis por entidade
// Definir colunas em components/tables/ ou no próprio form
```

---

## 19. Geração de PDF (jsPDF)

```typescript
// lib/pdf-generator.ts — helper centralizado
// jsPDF + jspdf-autotable para tabelas
// html2canvas para capturar componentes React como imagem
// Padrão: abrir preview em modal antes de baixar
// VendaPDFPreviewModal.tsx como referência de implementação
```

---

## 20. Integração de Serviços Externos (padrão)

### Estrutura de integração (ex: Bling ERP)
```
services/blingService.ts   — client TypeScript
pages/api/bling/           — proxy seguro (evita expor keys no frontend)
components/bling/          — componentes de UI da integração
lib/bling/                 — lógicas, mappers, validators
docs/bling/                — documentação da integração
```

**Regra**: Nunca chamar APIs externas diretamente do frontend. Sempre via API route Next.js (proxy seguro).

---

## 21. IA / Agente (LangChain + LangGraph)

```typescript
// Se o novo projeto precisar de IA:
// @langchain/core, @langchain/openai ou @langchain/anthropic
// @langchain/langgraph para workflows com estado
// lib/agent-provider-factory.ts — factory para trocar providers
// lib/agent-schema.ts — schemas dos tools do agente
// pages/api/agente/ — endpoints do agente
// components/agente/ — UI do chat/agente
```

---

## 22. Adicionando Nova Entidade (Checklist)

```
1. [ ] types/index.ts         — Interface Entidade + EntidadeForm
2. [ ] types/permissions.ts   — Adicionar permissões da entidade
3. [ ] lib/validations/       — Schema Zod da entidade
4. [ ] pages/api/[entidade]/  — CRUD endpoints (com withSupabaseAuth + withValidation)
5. [ ] services/api.ts        — Service functions (getAll, getById, create, update, delete)
6. [ ] components/forms/      — EntidadeForm.tsx
7. [ ] pages/[entidade].tsx   — Página listagem + filtros
8. [ ] components/layout/sidebar.tsx — Adicionar item no menu com permission
9. [ ] store/modal.ts         — Adicionar ModalId se precisar de modal
10.[ ] components/modals/modal-host.tsx — Handler do novo modal
```

---

## 23. Variáveis CSS Globais (globals.css)

```css
/* Copiar a estrutura de variáveis do MeguisPet: */
:root {
  --background: ...;
  --foreground: ...;
  --primary: ...;
  --secondary: ...;
  --muted: ...;
  --accent: ...;
  --destructive: ...;
  --border: ...;
  --radius: ...;
}
.dark { /* override para dark mode */ }

/* Classes custom do projeto: */
.projeto-gradient { /* gradiente da marca */ }
.projeto-card { /* card padrão */ }
.projeto-sidebar { /* sidebar */ }
```

---

## 24. Scripts npm/pnpm (package.json)

```json
{
  "scripts": {
    "dev": "doppler run -- next dev --webpack",
    "dev:local": "next dev --webpack",
    "build": "doppler run -- next build",
    "build:local": "next build",
    "start": "doppler run -- next start",
    "start:local": "next start",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "clean": "rimraf .next node_modules/.cache",
    "clean:build": "rimraf .next"
  }
}
```

---

## 25. Deploy (Vercel)

```
1. Push para branch main/master → deploy automático
2. Vercel detecta Next.js automaticamente
3. Configurar env vars no painel Vercel:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY
   - NEXT_PUBLIC_API_URL (opcional, padrão '/api')
4. Middleware Edge roda automaticamente na Vercel Edge Network
5. SSR habilitado (sem output: 'export')
```

---

## 26. Patterns a NUNCA Quebrar

```typescript
// ❌ NUNCA — fazer lógica entre createServerClient e getUser() no middleware
// ❌ NUNCA — não retornar supabaseResponse do middleware (quebra cookies)
// ❌ NUNCA — usar window/localStorage sem checar typeof window !== 'undefined'
// ❌ NUNCA — chamar API externa diretamente no frontend (sempre via API route)
// ❌ NUNCA — criar endpoint API sem withSupabaseAuth
// ❌ NUNCA — aceitar input de usuário sem sanitização (DOMPurify) + validação (Zod)
// ❌ NUNCA — expor SUPABASE_SERVICE_ROLE_KEY no frontend (só server-side)

// ✅ SEMPRE — usar cn() do lib/utils.ts para merge de classes Tailwind
// ✅ SEMPRE — tipar responses com ApiResponse<T> ou PaginatedResponse<T>
// ✅ SEMPRE — fechar modais após operações bem-sucedidas
// ✅ SEMPRE — resetar form state após create/edit
// ✅ SEMPRE — usar partialize no Zustand persist para não persistir dados sensíveis
// ✅ SEMPRE — checar mounted state antes de manipulação do DOM para evitar hydration errors
```

---

## 27. Referências de Código (MeguisPet → Novo Projeto)

| O que copiar | De onde | Para onde |
|---|---|---|
| Axios setup + interceptors | `services/api.ts` L1-100 | `services/api.ts` |
| Auth store Zustand SSR-safe | `store/auth.ts` | `store/auth.ts` |
| withSupabaseAuth HOF | `lib/supabase-middleware.ts` | `lib/supabase-middleware.ts` |
| withValidation HOF | `lib/validation-middleware.ts` | `lib/validation-middleware.ts` |
| Rate limiter | `lib/rate-limit.ts` | `lib/rate-limit.ts` |
| Cache manager | `lib/cache-manager.ts` | `lib/cache-manager.ts` |
| Sanitization | `lib/sanitization.ts` | `lib/sanitization.ts` |
| Modal host | `components/modals/modal-host.tsx` | `components/modals/modal-host.tsx` |
| MainLayout | `components/layout/main-layout.tsx` | `components/layout/main-layout.tsx` |
| Sidebar responsiva | `components/layout/sidebar.tsx` | `components/layout/sidebar.tsx` |
| _app.tsx padrão | `pages/_app.tsx` | `pages/_app.tsx` |
| Middleware Edge | `middleware.ts` | `middleware.ts` |
| CSS Variables | `styles/globals.css` | `styles/globals.css` (adaptar cores) |
| next.config.js | `next.config.js` | `next.config.js` (adaptar nome) |
| Permissões | `types/permissions.ts` | `types/permissions.ts` (adaptar roles) |
| Data Table | `components/ui/data-table.tsx` | `components/ui/data-table.tsx` |
| Toast | `components/ui/Toast.tsx` + `use-toast.tsx` + `toaster.tsx` | idem |
| Animated Card | `components/ui/animated-card.tsx` | idem |

---

## 28. Decisões de Arquitetura Importantes

1. **Pages Router** (não App Router) — evitar problemas de compatibilidade com SSR e middleware
2. **Supabase para auth** — JWT automático, refresh, RLS integrado no banco
3. **Doppler para secrets** — nunca commitar `.env` com valores reais
4. **Zustand em vez de Redux** — boilerplate mínimo, SSR-safe com persist
5. **Axios em vez de fetch** — interceptors facilitam injeção de token e logging
6. **Zod para validação** — type-safe, schema = documentação viva
7. **Radix UI base** — acessibilidade out-of-the-box (ARIA, keyboard navigation)
8. **Framer Motion respeitando prefers-reduced-motion** — acessibilidade
9. **Bundle splitting explícito** — recharts, tanstack, supabase em chunks separados
10. **Timestamp no buildId** — evita cache stale após deploy (sem hard refresh do usuário)
