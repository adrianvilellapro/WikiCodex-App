-- Separa el catalogo publico de clases de las clases libres escritas en fichas.

ALTER TABLE clases
  ADD COLUMN IF NOT EXISTS es_catalogo boolean NOT NULL DEFAULT false;

UPDATE clases
SET es_catalogo = true
WHERE COALESCE(fuente, 'manual') NOT IN ('manual', 'personaje_manual');

UPDATE clases
SET es_catalogo = false
WHERE COALESCE(fuente, 'manual') IN ('manual', 'personaje_manual')
  AND (
    EXISTS (
      SELECT 1
      FROM personaje_clases pc
      WHERE pc.clase_id = clases.id
    )
    OR creado_por_usuario_id IS NULL
  );

CREATE INDEX IF NOT EXISTS idx_clases_catalogo_idioma_nombre_id
  ON clases(es_catalogo, idioma_codigo, nombre, id);
