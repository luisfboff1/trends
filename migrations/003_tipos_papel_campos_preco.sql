-- Migration 003: Adiciona campos de precificação em tipos_papel
-- Campos importados da planilha PRECOS: PAGO, ICMS, IPI%, FRETE, TOTAL, DATA DE COMPRA

ALTER TABLE tipos_papel
  ADD COLUMN IF NOT EXISTS pago        DECIMAL(10,4),
  ADD COLUMN IF NOT EXISTS icms        DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS ipi         DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS frete       DECIMAL(10,4),
  ADD COLUMN IF NOT EXISTS total       DECIMAL(10,4),
  ADD COLUMN IF NOT EXISTS data_compra DATE;
