-- Migration 011: Tornar CNPJ nullable para suportar entidades do Uniplus sem CNPJ

-- Remove NOT NULL constraint
ALTER TABLE clientes ALTER COLUMN cnpj DROP NOT NULL;

-- Keep UNIQUE constraint but allow NULLs (PostgreSQL allows multiple NULLs in UNIQUE by default)
