-- Migration 004: Popula campos de precificação nos tipos_papel já cadastrados
-- Fonte: Planilha TRENDS - TABELA PRODUCAO 2024.xlsx, aba PRECOS
-- IPI e ICMS armazenados como percentual (ex: 3.25 = 3.25%)
-- FRETE em R$ (valor da nota de compra)

-- ─── FASSON ────────────────────────────────────────────────────────────────

UPDATE tipos_papel SET
  pago = 2.95, icms = 0, ipi = 3.25, frete = 0.00, total = 3.04,
  data_compra = '2023-08-24', updated_at = NOW()
WHERE id = 1; -- FASSON ACRILICA S0518

UPDATE tipos_papel SET
  pago = 2.82, icms = 0, ipi = 3.25, frete = 0.00, total = 2.91,
  data_compra = '2024-03-05', updated_at = NOW()
WHERE id = 2; -- FASSON Borracha S2045

UPDATE tipos_papel SET
  pago = 3.71, icms = 0, ipi = 9.75, frete = 0.00, total = 4.07,
  data_compra = '2024-03-05', updated_at = NOW()
WHERE id = 3; -- FASSON BOPP Borracha C2075

UPDATE tipos_papel SET
  pago = 4.53, icms = 0, ipi = 3.25, frete = 0.00, total = 4.67,
  data_compra = '2022-10-11', updated_at = NOW()
WHERE id = 4; -- FASSON Térmico C/B Borracha

UPDATE tipos_papel SET
  pago = 5.79, icms = 0, ipi = 3.25, frete = 0.00, total = 5.97,
  data_compra = '2023-08-10', updated_at = NOW()
WHERE id = 5; -- FASSON Couché DFAN 430g

UPDATE tipos_papel SET
  pago = 9.60, icms = 0, ipi = 9.75, frete = 181.63, total = 13.05,
  data_compra = '2022-10-21', updated_at = NOW()
WHERE id = 6; -- FASSON BOPP DFAN 430g

UPDATE tipos_papel SET
  pago = 4.95, icms = 0, ipi = 9.75, frete = 0.00, total = 5.43,
  data_compra = '2024-01-03', updated_at = NOW()
WHERE id = 7; -- FASSON BOPP Metalizado

UPDATE tipos_papel SET
  pago = 4.63, icms = 0, ipi = 3.25, frete = 0.00, total = 4.78,
  data_compra = '2024-01-16', updated_at = NOW()
WHERE id = 8; -- FASSON Couché TRANSTHERM 2075

-- ─── FEDRIGONI ─────────────────────────────────────────────────────────────

UPDATE tipos_papel SET
  pago = 3.78, icms = 4, ipi = 3.25, frete = 0.00, total = 4.39,
  data_compra = '2024-04-17', updated_at = NOW()
WHERE id = 9; -- Couché Removível RE31

UPDATE tipos_papel SET
  pago = 3.23, icms = 12, ipi = 3.25, frete = 0.00, total = 3.15,
  data_compra = '2024-04-18', updated_at = NOW()
WHERE id = 10; -- Couché TÉRMICO ECO

UPDATE tipos_papel SET
  pago = 2.77, icms = 12, ipi = 3.25, frete = 0.00, total = 2.70,
  data_compra = '2024-04-16', updated_at = NOW()
WHERE id = 11; -- Couché Acrílico P7 SCK55

UPDATE tipos_papel SET
  pago = 3.01, icms = 12, ipi = 9.75, frete = 0.00, total = 3.30,
  data_compra = '2024-02-26', updated_at = NOW()
WHERE id = 12; -- BOPP Acrílico 60 PF1 WG55

-- ─── TODOPAPEL ─────────────────────────────────────────────────────────────

UPDATE tipos_papel SET
  pago = 3.11, icms = 0, ipi = 0, frete = 0.085, total = 3.19,
  data_compra = '2023-06-27', updated_at = NOW()
WHERE id = 13; -- TAG 210gr

UPDATE tipos_papel SET
  pago = 1.95, icms = 0, ipi = 0, frete = 0.15, total = 2.10,
  data_compra = '2024-04-17', updated_at = NOW()
WHERE id = 14; -- TAG 150g

UPDATE tipos_papel SET
  pago = 1.98, icms = 0, ipi = 0, frete = 75.00, total = 2.03,
  data_compra = '2022-05-03', updated_at = NOW()
WHERE id = 15; -- TAG AMARELA 145gr

UPDATE tipos_papel SET
  pago = 1.75, icms = 0, ipi = 0, frete = 1.15, total = 1.81,
  data_compra = '2023-08-15', updated_at = NOW()
WHERE id = 16; -- TAG AMARELA 130gr

UPDATE tipos_papel SET
  pago = 1.75, icms = 0, ipi = 0, frete = 0.06, total = 1.81,
  data_compra = '2023-10-24', updated_at = NOW()
WHERE id = 17; -- TAG BRANCA 130G

UPDATE tipos_papel SET
  pago = 1.95, icms = 0, ipi = 0, frete = 0.14, total = 2.10,
  data_compra = '2023-12-04', updated_at = NOW()
WHERE id = 18; -- TAG 150g - MODAZINE

UPDATE tipos_papel SET
  pago = 2.78, icms = 0, ipi = 0, frete = 0.15, total = 2.93,
  data_compra = '2023-04-17', updated_at = NOW()
WHERE id = 19; -- PETECH 100 MICRAS

UPDATE tipos_papel SET
  pago = 2.62, icms = 0, ipi = 0, frete = 0.06, total = 2.68,
  data_compra = '2023-10-24', updated_at = NOW()
WHERE id = 20; -- PETECH 100 MICRAS/110MM

-- ─── PROMOM ────────────────────────────────────────────────────────────────

UPDATE tipos_papel SET
  fornecedor = 'PROMOM',
  pago = 3.29, icms = 6, ipi = 15, frete = 135.00, total = 4.37,
  data_compra = '2021-03-10', updated_at = NOW()
WHERE id = 21; -- 100 MICRAS - PSAI

-- ─── ARCALD ────────────────────────────────────────────────────────────────

UPDATE tipos_papel SET
  fornecedor = 'ARCALD',
  preco_m2 = 5.00,
  pago = 3.98, icms = 4, ipi = 9.75, frete = 0.13, total = 5.01,
  data_compra = '2023-07-31', updated_at = NOW()
WHERE id = 22; -- BOPP Borracha NTC

-- ─── ARCONVERT (ids 23-27) sem dados de PRECOS na planilha ─────────────────
-- Apenas o preco_m2 já está correto. Não há linha de PAGO/ICMS/IPI/FRETE/TOTAL
-- individual para esses itens na aba PRECOS.
