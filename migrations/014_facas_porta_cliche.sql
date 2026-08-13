-- Migration 014: Z (número de dentes) e engrenagem por faca — cálculo de espaçamento real
-- Cada faca tem um Z (número de dentes) fixo que, junto com o tipo de engrenagem,
-- determina o espaçamento real entre etiquetas (substituindo o valor fixo de 3mm
-- usado até aqui no motor de precificação). Ver Docs/REGRAS_NEGOCIO.md.

ALTER TABLE facas ADD COLUMN IF NOT EXISTS numero_dentes INTEGER;
ALTER TABLE facas ADD COLUMN IF NOT EXISTS tipo_engrenagem VARCHAR(20);

COMMENT ON COLUMN facas.numero_dentes IS 'Z — número de dentes da engrenagem/faca, usado pra calcular o espaçamento real entre etiquetas';
COMMENT ON COLUMN facas.tipo_engrenagem IS 'M1 | 1/8CP | HELICOIDAL_20_M1 — só 1/8CP tem fórmula confirmada hoje, ver Docs/BUGS.md';
