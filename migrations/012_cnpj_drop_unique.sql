-- Migration 012: Drop CNPJ UNIQUE constraint
-- Multiple Uniplus entities can share the same CNPJ (e.g. branches of the same company)
-- Keep the regular index for query performance

ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_cnpj_key;

-- idx_clientes_cnpj (non-unique) already exists from migration 009
