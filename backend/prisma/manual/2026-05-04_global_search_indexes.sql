CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION public.wikicodex_search_normalize(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT lower(public.unaccent(coalesce(input, '')));
$$;

CREATE INDEX IF NOT EXISTS idx_personajes_search_nombre_trgm
  ON personajes USING gin (public.wikicodex_search_normalize(nombre) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_personajes_search_nombre_prefix
  ON personajes (public.wikicodex_search_normalize(nombre) text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_objetos_search_nombre_trgm
  ON objetos USING gin (public.wikicodex_search_normalize(nombre) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_objetos_search_nombre_prefix
  ON objetos (public.wikicodex_search_normalize(nombre) text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_lugares_search_nombre_trgm
  ON lugares USING gin (public.wikicodex_search_normalize(nombre) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_lugares_search_nombre_prefix
  ON lugares (public.wikicodex_search_normalize(nombre) text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_hechizos_search_nombre_trgm
  ON hechizos USING gin (public.wikicodex_search_normalize(nombre) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_hechizos_search_nombre_prefix
  ON hechizos (public.wikicodex_search_normalize(nombre) text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_poderes_search_nombre_trgm
  ON poderes USING gin (public.wikicodex_search_normalize(nombre) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_poderes_search_nombre_prefix
  ON poderes (public.wikicodex_search_normalize(nombre) text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_campanas_search_nombre_trgm
  ON campanas USING gin (public.wikicodex_search_normalize(nombre) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_campanas_search_nombre_prefix
  ON campanas (public.wikicodex_search_normalize(nombre) text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_usuarios_search_nombre_usuario_trgm
  ON usuarios USING gin (public.wikicodex_search_normalize(nombre_usuario::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_usuarios_search_nombre_usuario_prefix
  ON usuarios (public.wikicodex_search_normalize(nombre_usuario::text) text_pattern_ops);
