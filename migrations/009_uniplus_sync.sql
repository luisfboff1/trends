-- Migration 009: UniPlus ERP integration tables + sync columns
-- Adds uniplus_id mapping columns and creates config/log tables

-- ─── Colunas uniplus_id em tabelas existentes ──────────────────────────────

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS uniplus_id VARCHAR(50);
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS uniplus_updated_at TIMESTAMPTZ;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS celular VARCHAR(20);
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS cep VARCHAR(10);
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS bairro VARCHAR(100);

ALTER TABLE tipos_papel ADD COLUMN IF NOT EXISTS uniplus_id VARCHAR(50);
ALTER TABLE tipos_papel ADD COLUMN IF NOT EXISTS uniplus_updated_at TIMESTAMPTZ;

ALTER TABLE condicoes_pagamento ADD COLUMN IF NOT EXISTS uniplus_id VARCHAR(50);
ALTER TABLE condicoes_pagamento ADD COLUMN IF NOT EXISTS uniplus_updated_at TIMESTAMPTZ;

ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS uniplus_id VARCHAR(50);
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS uniplus_updated_at TIMESTAMPTZ;

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS uniplus_id VARCHAR(50);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS uniplus_updated_at TIMESTAMPTZ;

ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS uniplus_id VARCHAR(50);
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS uniplus_updated_at TIMESTAMPTZ;

-- ─── Indexes únicos para uniplus_id (WHERE NOT NULL) ───────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_uniplus_id ON clientes(uniplus_id) WHERE uniplus_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tipos_papel_uniplus_id ON tipos_papel(uniplus_id) WHERE uniplus_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_condicoes_pagamento_uniplus_id ON condicoes_pagamento(uniplus_id) WHERE uniplus_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_pedidos_uniplus_id ON pedidos(uniplus_id) WHERE uniplus_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_uniplus_id ON usuarios(uniplus_id) WHERE uniplus_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_orcamentos_uniplus_id ON orcamentos(uniplus_id) WHERE uniplus_id IS NOT NULL;

-- ─── Tabela de configuração UniPlus ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS uniplus_config (
  id           SERIAL PRIMARY KEY,
  server_url   VARCHAR(500) NOT NULL,
  auth_code    VARCHAR(500) NOT NULL,
  user_id      VARCHAR(50)  NOT NULL DEFAULT '24',
  user_password VARCHAR(50) NOT NULL DEFAULT '9637',
  ativo        BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Tabela de log de sincronização ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS uniplus_sync_log (
  id                    SERIAL PRIMARY KEY,
  tipo                  VARCHAR(50)  NOT NULL,  -- 'clientes' | 'produtos' | 'condicoes_pagamento' | 'vendas' | 'vendedores' | 'full'
  direcao               VARCHAR(10)  NOT NULL,  -- 'import' | 'export'
  status                VARCHAR(20)  NOT NULL DEFAULT 'running',  -- 'running' | 'success' | 'error' | 'partial'
  total_registros       INTEGER DEFAULT 0,
  registros_criados     INTEGER DEFAULT 0,
  registros_atualizados INTEGER DEFAULT 0,
  registros_erros       INTEGER DEFAULT 0,
  erros                 JSONB,
  iniciado_por          INTEGER REFERENCES usuarios(id),
  started_at            TIMESTAMPTZ DEFAULT NOW(),
  finished_at           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_uniplus_sync_log_tipo ON uniplus_sync_log(tipo);
CREATE INDEX IF NOT EXISTS idx_uniplus_sync_log_status ON uniplus_sync_log(status);
