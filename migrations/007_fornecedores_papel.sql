-- Migration 007: Fornecedores de papel (múltiplos por tipo)
-- Cada tipo_papel pode ter vários fornecedores com preços diferentes
-- O admin escolhe qual usar ou usa o preço médio calculado

-- ─── Fornecedores de Papel ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fornecedores_papel (
  id            SERIAL PRIMARY KEY,
  tipo_papel_id INTEGER NOT NULL REFERENCES tipos_papel(id) ON DELETE CASCADE,
  fornecedor    VARCHAR(255) NOT NULL,
  preco_m2      DECIMAL(10,4) NOT NULL,
  pago          DECIMAL(10,4),
  icms          DECIMAL(5,2),
  ipi           DECIMAL(5,2),
  frete         DECIMAL(10,4),
  total         DECIMAL(10,4),
  data_compra   DATE,
  ativo         BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fornecedores_papel_tipo ON fornecedores_papel(tipo_papel_id);

-- ─── Novos campos em tipos_papel ────────────────────────────────────────────

ALTER TABLE tipos_papel
  ADD COLUMN IF NOT EXISTS nome_simplificado VARCHAR(100),
  ADD COLUMN IF NOT EXISTS preco_m2_medio    DECIMAL(10,4);

-- ─── Migrar dados existentes ────────────────────────────────────────────────
-- Cada tipos_papel que já tem fornecedor e preço vira 1 registro em fornecedores_papel

INSERT INTO fornecedores_papel (tipo_papel_id, fornecedor, preco_m2, pago, icms, ipi, frete, total, data_compra)
SELECT id, COALESCE(fornecedor, 'Sem fornecedor'), preco_m2, pago, icms, ipi, frete, total, data_compra
FROM tipos_papel
WHERE fornecedor IS NOT NULL AND fornecedor != ''
ON CONFLICT DO NOTHING;

-- Atualizar preço médio para tipos que já têm fornecedores
UPDATE tipos_papel tp SET
  preco_m2_medio = sub.media,
  nome_simplificado = tp.nome
FROM (
  SELECT tipo_papel_id, AVG(preco_m2) as media
  FROM fornecedores_papel
  WHERE ativo = true
  GROUP BY tipo_papel_id
) sub
WHERE tp.id = sub.tipo_papel_id;

-- Para tipos sem fornecedor, usar o preço existente como médio
UPDATE tipos_papel SET
  preco_m2_medio = preco_m2,
  nome_simplificado = nome
WHERE preco_m2_medio IS NULL;
