-- Metadatos de origen para rasgos guardados reutilizables.

ALTER TABLE rasgos
  ADD COLUMN IF NOT EXISTS origen_tipo text NULL,
  ADD COLUMN IF NOT EXISTS origen_entidad_id uuid NULL,
  ADD COLUMN IF NOT EXISTS origen_entidad_nombre text NULL,
  ADD COLUMN IF NOT EXISTS origen_grupo_id text NULL,
  ADD COLUMN IF NOT EXISTS origen_rasgo_clave text NULL,
  ADD COLUMN IF NOT EXISTS origen_rasgo_nombre text NULL,
  ADD COLUMN IF NOT EXISTS origen_datos jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_rasgos_reutilizables_origen
  ON rasgos(creador_usuario_id, es_reutilizable, origen_tipo, origen_entidad_id);

CREATE INDEX IF NOT EXISTS idx_rasgos_reutilizables_grupo
  ON rasgos(creador_usuario_id, es_reutilizable, origen_grupo_id);
