
ALTER TABLE public.companies
  ADD COLUMN razao_social TEXT,
  ADD COLUMN cnpj TEXT,
  ADD COLUMN cep TEXT,
  ADD COLUMN logradouro TEXT,
  ADD COLUMN numero TEXT,
  ADD COLUMN bairro TEXT,
  ADD COLUMN cidade TEXT,
  ADD COLUMN estado TEXT,
  ADD COLUMN pais TEXT DEFAULT 'Brasil';
