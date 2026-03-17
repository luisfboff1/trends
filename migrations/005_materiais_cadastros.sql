-- Migration 005: Tabelas de cadastro de materiais
-- Facas, Cores Pantone, Tubetes, Acabamentos, Condições de Pagamento

-- ─── Facas ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS facas (
  id                       SERIAL PRIMARY KEY,
  nome                     VARCHAR(100) NOT NULL,
  tipo                     VARCHAR(20)  NOT NULL DEFAULT 'rotativa_160',  -- 'rotativa_160' | 'rotativa_250' | 'batida'
  largura_mm               DECIMAL(8,2) NOT NULL,    -- largura da etiqueta
  altura_mm                DECIMAL(8,2) NOT NULL,     -- altura da etiqueta
  largura_papel_mm         DECIMAL(8,2),              -- largura da bobina (máx 110mm p/ ribbon)
  colunas                  INTEGER NOT NULL DEFAULT 1, -- etiquetas lado a lado
  maquina                  VARCHAR(100),               -- máquina associada
  percentual_adicional     DECIMAL(5,2) DEFAULT 0,     -- % adicional p/ facas complexas
  velocidade_multiplicador DECIMAL(5,2) DEFAULT 1.0,   -- multiplicador de custo por velocidade
  ativo                    BOOLEAN DEFAULT true,
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_facas_tipo ON facas(tipo);
CREATE INDEX IF NOT EXISTS idx_facas_ativo ON facas(ativo);

-- ─── Cores Pantone ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cores_pantone (
  id                         SERIAL PRIMARY KEY,
  codigo                     VARCHAR(50) NOT NULL UNIQUE,  -- ex: "Pantone 186 C"
  nome                       VARCHAR(100),                  -- nome amigável
  custo_m2                   DECIMAL(10,4) DEFAULT 0.30,    -- custo adicional por m²
  percentual_hora_separacao  DECIMAL(5,2) DEFAULT 0,        -- % extra por hora separação
  ativo                      BOOLEAN DEFAULT true,
  created_at                 TIMESTAMPTZ DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Tubetes ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tubetes (
  id            SERIAL PRIMARY KEY,
  diametro_mm   INTEGER NOT NULL UNIQUE,     -- 25, 38, 76
  descricao     VARCHAR(100),
  custo_unidade DECIMAL(10,4) NOT NULL,       -- custo por unidade
  ativo         BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Acabamentos ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS acabamentos (
  id                   SERIAL PRIMARY KEY,
  nome                 VARCHAR(100) NOT NULL,
  percentual_adicional DECIMAL(5,2) NOT NULL,  -- % sobre custo
  descricao            VARCHAR(255),
  ativo                BOOLEAN DEFAULT true,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Condições de Pagamento ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS condicoes_pagamento (
  id         SERIAL PRIMARY KEY,
  nome       VARCHAR(100) NOT NULL,
  descricao  VARCHAR(255),
  ativo      BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Seed dados iniciais ────────────────────────────────────────────────────

-- Tubetes padrão
INSERT INTO tubetes (diametro_mm, descricao, custo_unidade) VALUES
  (25, 'Tubete 25mm', 0),
  (38, 'Tubete 38mm', 0),
  (76, 'Tubete 76mm', 0)
ON CONFLICT (diametro_mm) DO NOTHING;

-- Acabamentos iniciais
INSERT INTO acabamentos (nome, percentual_adicional, descricao) VALUES
  ('Serrilha', 0, 'Corte serrilhado entre etiquetas'),
  ('Verniz',   0, 'Aplicação de verniz protetor')
ON CONFLICT DO NOTHING;
