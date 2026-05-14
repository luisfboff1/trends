-- Migration 013: Add uniplus_cliente_codigo to pedidos for proper client linking
-- The Uniplus API vendas have codigoCliente which maps to entidade.codigo (stored as clientes.uniplus_id)
-- We need to persist this value to properly re-link vendas to clients

ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS uniplus_cliente_codigo VARCHAR(20);

-- Index for re-matching
CREATE INDEX IF NOT EXISTS idx_pedidos_uniplus_cliente_codigo ON pedidos(uniplus_cliente_codigo) WHERE uniplus_cliente_codigo IS NOT NULL;
