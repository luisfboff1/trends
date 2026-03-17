-- Migration 006: Tabelas de margem configuráveis por vendedor
-- Cada vendedor é vinculado a uma tabela de margem pelo admin
-- Percentuais aplicados por quantidade de ROLOS (não etiquetas)

-- ─── Tabelas de Margem ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tabelas_margem (
  id         SERIAL PRIMARY KEY,
  nome       VARCHAR(100) NOT NULL,
  descricao  VARCHAR(255),
  ativo      BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Faixas de Margem (por rolos) ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS faixas_margem (
  id               SERIAL PRIMARY KEY,
  tabela_margem_id INTEGER NOT NULL REFERENCES tabelas_margem(id) ON DELETE CASCADE,
  min_rolos        INTEGER NOT NULL,        -- faixa mínima (inclusive)
  max_rolos        INTEGER,                 -- faixa máxima (NULL = sem limite)
  percentual       DECIMAL(6,2) NOT NULL,   -- ex: 250 para 250%
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_faixas_margem_tabela ON faixas_margem(tabela_margem_id);

-- ─── Vincular vendedor a tabela de margem ──────────────────────────────────

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS tabela_margem_id INTEGER REFERENCES tabelas_margem(id);

-- ─── Seed — 3 tabelas padrão ───────────────────────────────────────────────

INSERT INTO tabelas_margem (id, nome, descricao) VALUES
  (1, 'Padrão',  'Tabela padrão para vendedores'),
  (2, 'Gilmar',  'Tabela específica do Gilmar'),
  (3, 'Revenda', 'Tabela para Alana e Roberto')
ON CONFLICT DO NOTHING;

-- Faixas Padrão: 250% (4 rolos), 220% (10 rolos), 180% (20+ rolos)
INSERT INTO faixas_margem (tabela_margem_id, min_rolos, max_rolos, percentual) VALUES
  (1, 1,  3,    250),
  (1, 4,  9,    250),
  (1, 10, 19,   220),
  (1, 20, NULL, 180)
ON CONFLICT DO NOTHING;

-- Faixas Gilmar: 230% (4 rolos), 200% (10 rolos), 150% (20+ rolos)
INSERT INTO faixas_margem (tabela_margem_id, min_rolos, max_rolos, percentual) VALUES
  (2, 1,  3,    230),
  (2, 4,  9,    230),
  (2, 10, 19,   200),
  (2, 20, NULL, 150)
ON CONFLICT DO NOTHING;

-- Faixas Revenda: 220% (4 rolos), 190% (10 rolos), 110% (20+ rolos)
INSERT INTO faixas_margem (tabela_margem_id, min_rolos, max_rolos, percentual) VALUES
  (3, 1,  3,    220),
  (3, 4,  9,    220),
  (3, 10, 19,   190),
  (3, 20, NULL, 110)
ON CONFLICT DO NOTHING;

-- Resetar sequence do tabelas_margem para não conflitar com futuros inserts
SELECT setval('tabelas_margem_id_seq', (SELECT MAX(id) FROM tabelas_margem));
