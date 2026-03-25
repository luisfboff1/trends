-- RBAC: Add 'operador' role + granular permissions per user
-- Run against Neon PostgreSQL

-- 1. Allow 'operador' as user type (no constraint to alter — tipo is VARCHAR(20))
-- Already supports any string, but we document the valid values: 'admin' | 'operador' | 'vendedor'

-- 2. Create permissions table
CREATE TABLE IF NOT EXISTS usuario_permissoes (
  id          SERIAL PRIMARY KEY,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  feature     VARCHAR(50) NOT NULL,
  habilitado  BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(usuario_id, feature)
);

CREATE INDEX IF NOT EXISTS idx_usuario_permissoes_usuario ON usuario_permissoes(usuario_id);

-- 3. Seed permissions for existing users based on current tipo
-- Admin: all features ON
INSERT INTO usuario_permissoes (usuario_id, feature, habilitado)
SELECT u.id, f.feature, true
FROM usuarios u
CROSS JOIN (
  VALUES ('dashboard'), ('clientes'), ('orcamentos'), ('pedidos'), ('vendas'),
         ('materiais'), ('tabelas_margem'), ('condicoes_pagamento'), ('usuarios'), ('uniplus')
) AS f(feature)
WHERE u.tipo = 'admin'
ON CONFLICT (usuario_id, feature) DO NOTHING;

-- Vendedor: dashboard, clientes, orcamentos, pedidos, vendas ON; rest OFF
INSERT INTO usuario_permissoes (usuario_id, feature, habilitado)
SELECT u.id, f.feature,
  CASE WHEN f.feature IN ('dashboard', 'clientes', 'orcamentos', 'pedidos', 'vendas') THEN true ELSE false END
FROM usuarios u
CROSS JOIN (
  VALUES ('dashboard'), ('clientes'), ('orcamentos'), ('pedidos'), ('vendas'),
         ('materiais'), ('tabelas_margem'), ('condicoes_pagamento'), ('usuarios'), ('uniplus')
) AS f(feature)
WHERE u.tipo = 'vendedor'
ON CONFLICT (usuario_id, feature) DO NOTHING;
