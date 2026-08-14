-- Migration 015: Guardar as opções alternativas de quantidade por item de orçamento.
-- "Opções de Quantidade" na tela são cenários de comparação de preço (ex: 20 mil vs 30 mil),
-- não itens adicionais — só a primeira quantidade entra no valor_total do orçamento.
-- Sem essa coluna, salvar o orçamento descartava todas as opções exceto a primeira.

ALTER TABLE itens_orcamento ADD COLUMN IF NOT EXISTS quantidades_alt JSONB;

COMMENT ON COLUMN itens_orcamento.quantidades_alt IS 'Array de quantidades alternativas pra comparação (a quantidade[0] é sempre igual à coluna quantidade). Não conta pro valor_total.';
