-- Trends Solutions — Schema Inicial
-- Execute against Neon PostgreSQL

CREATE TABLE IF NOT EXISTS usuarios (
  id         SERIAL PRIMARY KEY,
  nome       VARCHAR(255) NOT NULL,
  email      VARCHAR(255) UNIQUE NOT NULL,
  senha_hash VARCHAR(255) NOT NULL,
  tipo       VARCHAR(20)  NOT NULL DEFAULT 'vendedor',  -- 'admin' | 'vendedor'
  ativo      BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clientes (
  id           SERIAL PRIMARY KEY,
  razao_social VARCHAR(255) NOT NULL,
  cnpj         VARCHAR(18)  UNIQUE NOT NULL,
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

CREATE TABLE IF NOT EXISTS tipos_papel (
  id         SERIAL PRIMARY KEY,
  nome       VARCHAR(255) NOT NULL,
  descricao  TEXT,
  fornecedor VARCHAR(255),
  preco_m2   DECIMAL(10,4) NOT NULL,
  ativo      BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orcamentos (
  id          SERIAL PRIMARY KEY,
  numero      VARCHAR(50)  UNIQUE NOT NULL,
  cliente_id  INTEGER REFERENCES clientes(id),
  vendedor_id INTEGER REFERENCES usuarios(id),
  tipo_margem VARCHAR(20)  NOT NULL DEFAULT 'vendedor',
  status      VARCHAR(30)  NOT NULL DEFAULT 'rascunho',
  observacoes TEXT,
  valor_total DECIMAL(12,2),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS itens_orcamento (
  id            SERIAL PRIMARY KEY,
  orcamento_id  INTEGER REFERENCES orcamentos(id) ON DELETE CASCADE,
  tipo_papel_id INTEGER REFERENCES tipos_papel(id),
  largura_mm    DECIMAL(8,2) NOT NULL,
  altura_mm     DECIMAL(8,2) NOT NULL,
  colunas       INTEGER NOT NULL DEFAULT 1,
  quantidade    INTEGER NOT NULL,
  imagem_url    TEXT,
  observacoes   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pedidos (
  id           SERIAL PRIMARY KEY,
  numero       VARCHAR(50) UNIQUE NOT NULL,
  orcamento_id INTEGER REFERENCES orcamentos(id),
  cliente_id   INTEGER REFERENCES clientes(id),
  vendedor_id  INTEGER REFERENCES usuarios(id),
  status       VARCHAR(30) NOT NULL DEFAULT 'pendente',
  observacoes  TEXT,
  valor_total  DECIMAL(12,2),
  data_entrega DATE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_clientes_vendedor ON clientes(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_clientes_cnpj ON clientes(cnpj);
CREATE INDEX IF NOT EXISTS idx_orcamentos_cliente ON orcamentos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_vendedor ON orcamentos(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_status ON orcamentos(status);
CREATE INDEX IF NOT EXISTS idx_itens_orcamento ON itens_orcamento(orcamento_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_vendedor ON pedidos(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_status ON pedidos(status);

-- Seed admin user (password: admin123 — change after first login!)
-- bcrypt hash of 'admin123' with salt rounds 10
INSERT INTO usuarios (nome, email, senha_hash, tipo)
VALUES (
  'Administrador',
  'admin@trends.com.br',
  '$2b$10$sEEYQi16b4EgCLIxJnYv4u9Gt3U8GoT.p0ylkF4wVmad7KhWPu6mW',
  'admin'
) ON CONFLICT (email) DO NOTHING;
