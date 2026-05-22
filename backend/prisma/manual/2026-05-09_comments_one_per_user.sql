INSERT INTO tipos_entidad (codigo, nombre)
VALUES
  ('personaje', 'Personaje'),
  ('objeto', 'Objeto'),
  ('lugar', 'Lugar'),
  ('partida', 'Partida'),
  ('usuario', 'Usuario'),
  ('poder', 'Poder')
ON CONFLICT (codigo) DO UPDATE
SET nombre = EXCLUDED.nombre;

WITH ranked_comments AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY registro_entidad_id, usuario_id
      ORDER BY creado_en DESC, id DESC
    ) AS rn
  FROM comentarios
  WHERE comentario_padre_id IS NULL
    AND esta_borrado = false
)
UPDATE comentarios
SET
  esta_borrado = true,
  borrado_en = COALESCE(borrado_en, now()),
  actualizado_en = now()
WHERE id IN (
  SELECT id
  FROM ranked_comments
  WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_comentarios_registro_usuario_activo
  ON comentarios (registro_entidad_id, usuario_id)
  WHERE comentario_padre_id IS NULL
    AND esta_borrado = false;

CREATE INDEX IF NOT EXISTS idx_comentarios_registro_activos
  ON comentarios (registro_entidad_id, creado_en)
  WHERE comentario_padre_id IS NULL
    AND esta_borrado = false;
