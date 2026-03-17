-- Migration 008: Reestruturar orcamentos e itens para novo sistema
-- Novos campos em itens_orcamento (faca, cor, tubete, acabamentos)
-- Novos campos em orcamentos (condição pagamento, frete)
-- Tabela histórico de frete

-- ─── Novos campos em itens_orcamento ────────────────────────────────────────

ALTER TABLE itens_orcamento
  ADD COLUMN IF NOT EXISTS tipo_produto       VARCHAR(20) DEFAULT 'etiqueta',  -- 'etiqueta' | 'rotulo' | 'tag'
  ADD COLUMN IF NOT EXISTS faca_id            INTEGER REFERENCES facas(id),
  ADD COLUMN IF NOT EXISTS cor_tipo           VARCHAR(10) DEFAULT 'branca',    -- 'branca' | 'pantone'
  ADD COLUMN IF NOT EXISTS cor_pantone_id     INTEGER REFERENCES cores_pantone(id),
  ADD COLUMN IF NOT EXISTS tubete_id          INTEGER REFERENCES tubetes(id),
  ADD COLUMN IF NOT EXISTS acabamentos_ids    INTEGER[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS quantidade_por_rolo INTEGER,
  ADD COLUMN IF NOT EXISTS quantidade_rolos   INTEGER,
  ADD COLUMN IF NOT EXISTS metragem_linear    DECIMAL(10,4);

-- ─── Novos campos em orcamentos ─────────────────────────────────────────────

ALTER TABLE orcamentos
  ADD COLUMN IF NOT EXISTS condicao_pagamento_id INTEGER REFERENCES condicoes_pagamento(id),
  ADD COLUMN IF NOT EXISTS frete_tipo            VARCHAR(20) DEFAULT 'automatico',  -- 'automatico' | 'manual' | 'historico'
  ADD COLUMN IF NOT EXISTS frete_valor           DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS frete_percentual      DECIMAL(5,2) DEFAULT 3.0;

-- ─── Histórico de Frete ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS historico_frete (
  id           SERIAL PRIMARY KEY,
  cliente_id   INTEGER NOT NULL REFERENCES clientes(id),
  valor        DECIMAL(12,2) NOT NULL,
  data         DATE NOT NULL DEFAULT CURRENT_DATE,
  orcamento_id INTEGER REFERENCES orcamentos(id),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_historico_frete_cliente ON historico_frete(cliente_id);

-- ─── Indexes nos novos campos ───────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_itens_faca ON itens_orcamento(faca_id);
CREATE INDEX IF NOT EXISTS idx_itens_cor ON itens_orcamento(cor_pantone_id);
CREATE INDEX IF NOT EXISTS idx_itens_tubete ON itens_orcamento(tubete_id);
