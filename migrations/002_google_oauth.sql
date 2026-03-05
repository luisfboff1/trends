-- Add Google OAuth support to usuarios table
ALTER TABLE usuarios ALTER COLUMN senha_hash DROP NOT NULL;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS aprovado_por INTEGER REFERENCES usuarios(id);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS aprovado_em TIMESTAMPTZ;
