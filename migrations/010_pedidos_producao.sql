-- Migration 010: Add production-specific columns to pedidos
-- For importing historical production data from Excel spreadsheet

-- Direct client name (for imported records without client_id)
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cliente_nome VARCHAR(255);

-- Production-specific fields
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS ordem_fabricacao VARCHAR(50);
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS material VARCHAR(100);
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS codigo_faca VARCHAR(50);
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS etiqueta_dimensao VARCHAR(50);
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS quantidade DECIMAL(12,3);
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS produzido_por VARCHAR(100);
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS tipo_producao VARCHAR(50);
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS ordem_compra VARCHAR(255);
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS data_producao DATE;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS mes_referencia VARCHAR(30);

-- Origin tracking: 'sistema' (default) or 'importacao'
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS origem VARCHAR(20) DEFAULT 'sistema';

-- Indexes for dashboard queries
CREATE INDEX IF NOT EXISTS idx_pedidos_mes_referencia ON pedidos(mes_referencia);
CREATE INDEX IF NOT EXISTS idx_pedidos_tipo_producao ON pedidos(tipo_producao);
CREATE INDEX IF NOT EXISTS idx_pedidos_origem ON pedidos(origem);
CREATE INDEX IF NOT EXISTS idx_pedidos_material ON pedidos(material);
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente_nome ON pedidos(cliente_nome);
